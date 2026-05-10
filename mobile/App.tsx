import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getApiBaseUrl } from "./lib/api";
import { login, logout, signup, type CurrentUser } from "./lib/auth";
import { fetchShopSnapshot, type ShopDisplaySlotView, type ShopSnapshot } from "./lib/shop";
import {
  fetchSocialSnapshot,
  postFarmReview,
  type SocialFarmCard,
  type SocialFarmReview,
  type SocialSnapshot,
} from "./lib/social";

type MainTab = "social" | "shop";
type AuthMode = "login" | "signup";
type LoadState =
  | { status: "idle" | "loading" }
  | { status: "ready"; social: SocialSnapshot; shop: ShopSnapshot }
  | { status: "error"; message: string; social?: SocialSnapshot; shop?: ShopSnapshot };

type ReviewDraft = {
  reviewerName: string;
  rating: number;
  comment: string;
};

const colors = {
  parchment: "#fbf6e8",
  cream: "#fffdf5",
  shelf: "#fcf6e4",
  soil: "#3b2a14",
  text: "#2d2313",
  leaf: "#2f6f4e",
  mint: "#d8ecd6",
  blue: "#68b8c9",
  sky: "#e4f7f8",
  gold: "#f2bd4b",
  sun: "#ffe89a",
  orange: "#e9823a",
  red: "#c1492f",
  pink: "#c95b76",
  wood: "#8b6f3e",
  woodLight: "#c9b88a",
};

const categoryLabels: Record<string, string> = {
  harvest: "Harvest",
  preserves: "Preserves",
  livestock: "Livestock",
  seeds: "Seeds",
  starts: "Starts",
  feed: "Feed",
  amendments: "Soil",
  tools: "Tools",
};

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>("social");
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });

  const loadData = useCallback(async () => {
    setLoadState((current) => (current.status === "ready" ? current : { status: "loading" }));

    try {
      const [social, shop] = await Promise.all([fetchSocialSnapshot(), fetchShopSnapshot()]);
      setLoadState({ status: "ready", social, shop });
    } catch (error) {
      setLoadState((current) => ({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to load Sunpatch data",
        social: "social" in current ? current.social : undefined,
        shop: "shop" in current ? current.shop : undefined,
      }));
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [loadData, user]);

  async function handleLogout() {
    await logout();
    setUser(null);
    setLoadState({ status: "idle" });
    setActiveTab("social");
  }

  if (!user) {
    return (
      <Shell>
        <AuthScreen
          onAuthenticated={(nextUser) => {
            setUser(nextUser);
            setActiveTab("social");
          }}
        />
      </Shell>
    );
  }

  const social = loadState.status === "ready" || loadState.status === "error" ? loadState.social : undefined;
  const shop = loadState.status === "ready" || loadState.status === "error" ? loadState.shop : undefined;

  return (
    <Shell>
      <View style={styles.topBar}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>SP</Text>
        </View>
        <View style={styles.topCopy}>
          <Text style={styles.brandText}>Sunpatch</Text>
          <Text style={styles.brandSubtext}>{user.displayName}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={handleLogout} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>Sign out</Text>
        </Pressable>
      </View>

      {loadState.status === "loading" ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.soil} />
          <Text style={styles.noticeText}>Loading your shop and social feed...</Text>
        </View>
      ) : null}

      {loadState.status === "error" ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Could not refresh data.</Text>
          <Text style={styles.noticeMeta}>{loadState.message}</Text>
          <Text style={styles.noticeMeta}>API: {getApiBaseUrl()}</Text>
          <Pressable accessibilityRole="button" onPress={loadData} style={styles.inlineButton}>
            <Text style={styles.inlineButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.screen}>
        {activeTab === "social" ? (
          <SocialScreen
            snapshot={social}
            refreshing={loadState.status === "loading"}
            onRefresh={loadData}
          />
        ) : (
          <ShopScreen
            snapshot={shop}
            refreshing={loadState.status === "loading"}
            onRefresh={loadData}
          />
        )}
      </View>

      <View style={styles.tabBar}>
        <TabButton active={activeTab === "social"} label="Social" onPress={() => setActiveTab("social")} />
        <TabButton active={activeTab === "shop"} label="My Shop" onPress={() => setActiveTab("shop")} />
      </View>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.app}>{children}</View>
    </SafeAreaView>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: CurrentUser) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setStatus("saving");
    setError(null);

    try {
      const response =
        mode === "login"
          ? await login(identifier, password)
          : await signup({ username, email, displayName, password });

      onAuthenticated(response.user);
    } catch (authError) {
      setStatus("error");
      setError(authError instanceof Error ? authError.message : "Unable to authenticate");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
      <View style={styles.authHero}>
        <View style={styles.logoMarkLarge}>
          <Text style={styles.logoTextLarge}>SP</Text>
        </View>
        <Text style={styles.authTitle}>Sunpatch</Text>
        <Text style={styles.authSubtitle}>Use the same account as the web app.</Text>
      </View>

      <Panel>
        <SegmentedControl
          value={mode}
          options={[
            { label: "Login", value: "login" },
            { label: "Sign up", value: "signup" },
          ]}
          onChange={(next) => {
            setMode(next);
            setError(null);
            setStatus("idle");
          }}
        />

        {mode === "login" ? (
          <Field label="Username or email" value={identifier} onChangeText={setIdentifier} autoCapitalize="none" />
        ) : (
          <>
            <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <Field label="Display name" value={displayName} onChangeText={setDisplayName} />
          </>
        )}

        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />

        {status === "error" && error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={status === "saving"}
          onPress={submit}
          style={[styles.primaryButton, status === "saving" && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>{status === "saving" ? "Working..." : mode === "login" ? "Login" : "Create account"}</Text>
        </Pressable>
      </Panel>
    </ScrollView>
  );
}

function SocialScreen({
  snapshot,
  refreshing,
  onRefresh,
}: {
  snapshot?: SocialSnapshot;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reviewOverrides, setReviewOverrides] = useState<Record<string, Partial<SocialFarmCard>>>({});
  const farms = useMemo(
    () =>
      (snapshot?.farms ?? []).map((farm) => ({
        ...farm,
        ...(reviewOverrides[farm.userId] ?? {}),
      })),
    [reviewOverrides, snapshot],
  );
  const selectedFarm = selectedUserId ? farms.find((farm) => farm.userId === selectedUserId) : null;

  function applyReview(farmUserId: string, review: SocialFarmReview, created: boolean) {
    const farm = farms.find((item) => item.userId === farmUserId);

    if (!farm) {
      return;
    }

    const replaced = farm.reviews.some((item) => item.id === review.id);
    const reviewCount = created && !replaced ? farm.reviewCount + 1 : farm.reviewCount;
    setReviewOverrides((current) => {
      return {
        ...current,
        [farmUserId]: {
          rating: recomputeRating(farm, review, reviewCount),
          reviewCount,
          reviews: [review, ...farm.reviews.filter((item) => item.id !== review.id)].slice(0, 6),
          tags: Array.from(new Set([...review.tags, ...farm.tags])).slice(0, 4),
        },
      };
    });
  }

  if (!snapshot && refreshing) {
    return <EmptyState title="Loading farms" body="Fetching public shopfronts from the web app." />;
  }

  if (!farms.length) {
    return (
      <ScrollView
        contentContainerStyle={styles.screenScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <EmptyState title="No public farms yet" body="Publish a shop from the web app or seed sample farm data." />
      </ScrollView>
    );
  }

  if (selectedFarm) {
    return (
      <FarmDetailScreen
        farm={selectedFarm}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onBack={() => setSelectedUserId(null)}
        onReviewPosted={(review, created) => applyReview(selectedFarm.userId, review, created)}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screenScroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <Panel tone="mint">
        <Text style={styles.eyebrow}>Social</Text>
        <Text style={styles.title}>Top farms nearby</Text>
        <View style={styles.chipRow}>
          <Chip label={`${farms.length} public shops`} tone="green" />
          <Chip label={`${totalVisibleSlots(farms)} shelf items`} tone="gold" />
        </View>
      </Panel>

      {farms.map((farm) => (
        <Pressable key={farm.userId} accessibilityRole="button" onPress={() => setSelectedUserId(farm.userId)}>
          <Panel>
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(farm.farmName)}</Text>
              </View>
              <View style={styles.cardTitleBlock}>
                <Text style={styles.cardTitle}>{farm.farmName}</Text>
                <Text style={styles.cardMeta}>
                  {farm.distanceLabel} | {farm.displayName}
                </Text>
              </View>
              <Score value={farm.rating ? farm.rating.toFixed(1) : "New"} label={`${farm.reviewCount} reviews`} />
            </View>
            <Text style={styles.bodyText}>{farm.bio}</Text>
            <ShopSlotPreview slots={farm.snapshot.slots.filter((slot) => slot.visible).slice(0, 3)} />
            <View style={styles.chipRow}>
              {farm.tags.slice(0, 4).map((tag, index) => (
                <Chip key={`${tag}-${index}`} label={tag} tone="cream" />
              ))}
            </View>
          </Panel>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function FarmDetailScreen({
  farm,
  refreshing,
  onRefresh,
  onBack,
  onReviewPosted,
}: {
  farm: SocialFarmCard;
  refreshing: boolean;
  onRefresh: () => void;
  onBack: () => void;
  onReviewPosted: (review: SocialFarmReview, created: boolean) => void;
}) {
  const [draft, setDraft] = useState<ReviewDraft>({ reviewerName: "", rating: 5, comment: "" });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const visibleSlots = farm.snapshot.slots.filter((slot) => slot.visible).sort((left, right) => left.position - right.position);

  async function submitReview() {
    setStatus("saving");
    setError(null);

    try {
      const result = await postFarmReview({
        farmUserId: farm.userId,
        reviewerName: draft.reviewerName,
        rating: draft.rating,
        comment: draft.comment,
      });
      onReviewPosted(result.review, result.created);
      setDraft({ reviewerName: "", rating: 5, comment: "" });
      setStatus("saved");
    } catch (reviewError) {
      setStatus("error");
      setError(reviewError instanceof Error ? reviewError.message : "Unable to post review");
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screenScroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>Back to farms</Text>
      </Pressable>

      <Panel tone="mint">
        <View style={styles.cardHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>{initials(farm.farmName)}</Text>
          </View>
          <View style={styles.cardTitleBlock}>
            <Text style={styles.title}>{farm.farmName}</Text>
            <Text style={styles.cardMeta}>{farm.distanceLabel}</Text>
          </View>
          <Score value={farm.rating ? farm.rating.toFixed(1) : "New"} label={`${farm.reviewCount} reviews`} />
        </View>
        <Text style={styles.bodyText}>{farm.bio}</Text>
        <DetailLine label="Hours" value={farm.snapshot.details.hours} />
        <DetailLine label="Pickup" value={farm.snapshot.details.pickupLocation} />
        <DetailLine label="Payment" value={farm.snapshot.details.paymentOptions} />
        {farm.snapshot.details.availabilityNote ? (
          <DetailLine label="Note" value={farm.snapshot.details.availabilityNote} />
        ) : null}
      </Panel>

      <Panel>
        <Text style={styles.sectionLabel}>Shop items</Text>
        {visibleSlots.length ? (
          visibleSlots.map((slot) => <ShelfCard key={slot.id} slot={slot} />)
        ) : (
          <Text style={styles.bodyText}>No visible shelf items right now.</Text>
        )}
      </Panel>

      <Panel>
        <Text style={styles.sectionLabel}>Reviews</Text>
        <View style={styles.reviewForm}>
          <Field label="Your name" value={draft.reviewerName} onChangeText={(reviewerName) => setDraft((current) => ({ ...current, reviewerName }))} />
          <View style={styles.ratingPicker}>
            {[1, 2, 3, 4, 5].map((rating) => (
              <Pressable
                key={rating}
                accessibilityRole="button"
                onPress={() => setDraft((current) => ({ ...current, rating }))}
                style={[styles.ratingButton, draft.rating === rating && styles.ratingButtonActive]}
              >
                <Text style={[styles.ratingButtonText, draft.rating === rating && styles.ratingButtonTextActive]}>{rating}</Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Review"
            value={draft.comment}
            onChangeText={(comment) => setDraft((current) => ({ ...current, comment }))}
            multiline
          />
          {status === "error" && error ? <Text style={styles.errorText}>{error}</Text> : null}
          {status === "saved" ? <Text style={styles.savedText}>Review posted.</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={status === "saving"}
            onPress={submitReview}
            style={[styles.primaryButton, status === "saving" && styles.buttonDisabled]}
          >
            <Text style={styles.primaryButtonText}>{status === "saving" ? "Posting..." : "Post review"}</Text>
          </Pressable>
        </View>

        <View style={styles.reviewList}>
          {farm.reviews.length ? (
            farm.reviews.map((review) => <ReviewCard key={review.id} review={review} />)
          ) : (
            <Text style={styles.bodyText}>No reviews yet.</Text>
          )}
        </View>
      </Panel>
    </ScrollView>
  );
}

function ShopScreen({
  snapshot,
  refreshing,
  onRefresh,
}: {
  snapshot?: ShopSnapshot;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const visibleSlots = useMemo(
    () => snapshot?.slots.filter((slot) => slot.visible).sort((left, right) => left.position - right.position) ?? [],
    [snapshot],
  );
  const hiddenSlots = useMemo(
    () => snapshot?.slots.filter((slot) => !slot.visible).sort((left, right) => left.position - right.position) ?? [],
    [snapshot],
  );
  const totalDisplayed = visibleSlots.reduce((total, slot) => total + slot.displayAmount, 0);

  if (!snapshot) {
    return <EmptyState title="Loading shop" body="Fetching your web shop display." />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screenScroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <Panel tone="sky">
        <Text style={styles.eyebrow}>My shop</Text>
        <Text style={styles.title}>{snapshot.details.shopName}</Text>
        <Text style={styles.bodyText}>{snapshot.displayName} | {snapshot.userEmail}</Text>
        <View style={styles.chipRow}>
          <Chip label={snapshot.isPublished ? "Published" : "Draft"} tone={snapshot.isPublished ? "green" : "gold"} />
          <Chip label={`${visibleSlots.length} shelf cards`} tone="green" />
          <Chip label={`${totalDisplayed} units`} tone="gold" />
          <Chip label={`${hiddenSlots.length} back stock`} tone="blue" />
        </View>
        <DetailLine label="Hours" value={snapshot.details.hours || "Not set"} />
        <DetailLine label="Pickup" value={snapshot.details.pickupLocation || "Not set"} />
        <DetailLine label="Payment" value={snapshot.details.paymentOptions || "Not set"} />
      </Panel>

      <Panel>
        <Text style={styles.sectionLabel}>Current shelf</Text>
        {visibleSlots.length ? (
          visibleSlots.map((slot) => <ShelfCard key={slot.id} slot={slot} />)
        ) : (
          <Text style={styles.bodyText}>No visible shelf cards. Add sellable inventory and publish it from the web shop editor.</Text>
        )}
      </Panel>

      <Panel>
        <Text style={styles.sectionLabel}>Back stock</Text>
        {hiddenSlots.length ? (
          hiddenSlots.map((slot) => <ShelfCard key={slot.id} slot={slot} compact />)
        ) : (
          <Text style={styles.bodyText}>No hidden sellable items.</Text>
        )}
      </Panel>
    </ScrollView>
  );
}

function ShopSlotPreview({ slots }: { slots: ShopDisplaySlotView[] }) {
  if (!slots.length) {
    return <Text style={styles.bodyText}>No visible shelf items right now.</Text>;
  }

  return (
    <View style={styles.previewRow}>
      {slots.map((slot) => (
        <View key={slot.id} style={styles.previewItem}>
          <View style={[styles.colorSwatch, { backgroundColor: slot.item.color || colors.gold }]} />
          <Text style={styles.previewName} numberOfLines={1}>{slot.item.name}</Text>
          <Text style={styles.previewPrice}>{formatMoney(slot.priceCents)}</Text>
        </View>
      ))}
    </View>
  );
}

function ShelfCard({ slot, compact }: { slot: ShopDisplaySlotView; compact?: boolean }) {
  return (
    <View style={[styles.shelfCard, compact && styles.shelfCardCompact]}>
      <View style={[styles.itemSwatch, { backgroundColor: `${slot.item.color || colors.gold}33` }]}>
        <View style={[styles.itemSwatchCore, { backgroundColor: slot.item.color || colors.gold }]} />
      </View>
      <View style={styles.shelfCopy}>
        <View style={styles.shelfTopLine}>
          <Text style={styles.itemName}>{slot.item.name}</Text>
          <Chip label={categoryLabels[slot.item.category] ?? slot.item.category} tone="cream" />
        </View>
        <Text style={styles.itemMeta}>
          {slot.displayAmount} {slot.displayUnit} | {formatMoney(slot.priceCents)}/{singularUnit(slot.displayUnit)}
        </Text>
        <Text style={styles.signText}>{slot.signText}</Text>
      </View>
    </View>
  );
}

function ReviewCard({ review }: { review: SocialFarmReview }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Text style={styles.reviewName}>{review.reviewerName}</Text>
        <Text style={styles.reviewRating}>{review.rating}/5</Text>
      </View>
      <Text style={styles.bodyText}>{review.comment}</Text>
      <View style={styles.chipRow}>
        {review.tags.map((tag, index) => <Chip key={`${tag}-${index}`} label={tag} tone="cream" />)}
      </View>
    </View>
  );
}

function Panel({ children, tone }: { children: ReactNode; tone?: "mint" | "sky" }) {
  return (
    <View style={[styles.panel, tone === "mint" && styles.panelMint, tone === "sky" && styles.panelSky]}>
      {children}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor="#9a8a66"
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            style={[styles.segmentButton, active && styles.segmentButtonActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TabButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, tone }: { label: string; tone: "green" | "gold" | "blue" | "cream" }) {
  const toneStyle =
    tone === "green"
      ? styles.chipGreen
      : tone === "gold"
        ? styles.chipGold
        : tone === "blue"
          ? styles.chipBlue
          : styles.chipCream;

  return (
    <View style={[styles.chip, toneStyle]}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function Score({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.score}>
      <Text style={styles.scoreValue}>{value}</Text>
      <Text style={styles.scoreLabel}>{label}</Text>
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.bodyText}>{body}</Text>
    </View>
  );
}

function totalVisibleSlots(farms: SocialFarmCard[]) {
  return farms.reduce((sum, farm) => sum + farm.snapshot.slots.filter((slot) => slot.visible).length, 0);
}

function recomputeRating(farm: SocialFarmCard, review: SocialFarmReview, reviewCount: number) {
  const replaced = farm.reviews.find((item) => item.id === review.id);
  const previousTotal = farm.rating * farm.reviewCount - (replaced?.rating ?? 0);
  return Math.round(((previousTotal + review.rating) / Math.max(reviewCount, 1)) * 10) / 10;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "SP";
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function singularUnit(unit: string) {
  return unit.endsWith("s") ? unit.slice(0, -1) : unit;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  app: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  screen: {
    flex: 1,
  },
  screenScroll: {
    gap: 14,
    padding: 14,
    paddingBottom: 28,
  },
  authScroll: {
    gap: 16,
    padding: 18,
    paddingTop: 36,
  },
  authHero: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
  },
  authTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
  },
  authSubtitle: {
    color: "#5f563f",
    fontSize: 14,
    fontWeight: "700",
  },
  logoMark: {
    alignItems: "center",
    backgroundColor: colors.sun,
    borderColor: colors.soil,
    borderWidth: 2,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  logoMarkLarge: {
    alignItems: "center",
    backgroundColor: colors.sun,
    borderColor: colors.soil,
    borderWidth: 2,
    height: 64,
    justifyContent: "center",
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    width: 64,
  },
  logoText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  logoTextLarge: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  topBar: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderBottomColor: colors.soil,
    borderBottomWidth: 2,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandText: {
    color: "#34432b",
    fontSize: 17,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  brandSubtext: {
    color: "#5f563f",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  panel: {
    backgroundColor: colors.cream,
    borderColor: colors.soil,
    borderWidth: 2,
    gap: 10,
    padding: 12,
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  panelMint: {
    backgroundColor: colors.mint,
  },
  panelSky: {
    backgroundColor: colors.sky,
  },
  eyebrow: {
    color: colors.leaf,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 29,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  bodyText: {
    color: "#5f563f",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.leaf,
    borderColor: colors.soil,
    borderWidth: 2,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  avatarLarge: {
    alignItems: "center",
    backgroundColor: colors.leaf,
    borderColor: colors.soil,
    borderWidth: 2,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  avatarText: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: "900",
  },
  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 21,
  },
  cardMeta: {
    color: "#5f563f",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  score: {
    alignItems: "center",
    backgroundColor: colors.sun,
    borderColor: colors.soil,
    borderWidth: 2,
    minWidth: 58,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  scoreValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 20,
  },
  scoreLabel: {
    color: colors.text,
    fontSize: 8,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  chip: {
    borderWidth: 2,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  chipGreen: {
    backgroundColor: "#eef8df",
    borderColor: "#9bc278",
  },
  chipGold: {
    backgroundColor: "#fff1dc",
    borderColor: "#efb16b",
  },
  chipBlue: {
    backgroundColor: colors.sky,
    borderColor: colors.blue,
  },
  chipCream: {
    backgroundColor: colors.shelf,
    borderColor: colors.woodLight,
  },
  chipText: {
    color: "#5e4a26",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  previewRow: {
    gap: 8,
  },
  previewItem: {
    alignItems: "center",
    backgroundColor: colors.shelf,
    borderColor: colors.woodLight,
    borderWidth: 2,
    flexDirection: "row",
    gap: 8,
    padding: 8,
  },
  colorSwatch: {
    borderColor: colors.soil,
    borderWidth: 2,
    height: 20,
    width: 20,
  },
  previewName: {
    color: colors.text,
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  previewPrice: {
    color: colors.leaf,
    fontSize: 12,
    fontWeight: "900",
  },
  shelfCard: {
    alignItems: "flex-start",
    backgroundColor: colors.shelf,
    borderColor: colors.woodLight,
    borderWidth: 2,
    flexDirection: "row",
    gap: 10,
    padding: 9,
  },
  shelfCardCompact: {
    opacity: 0.86,
  },
  itemSwatch: {
    alignItems: "center",
    borderColor: colors.soil,
    borderWidth: 2,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  itemSwatchCore: {
    borderColor: colors.soil,
    borderWidth: 2,
    height: 26,
    width: 26,
  },
  shelfCopy: {
    flex: 1,
    minWidth: 0,
  },
  shelfTopLine: {
    alignItems: "flex-start",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  itemName: {
    color: "#2d311f",
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 19,
    minWidth: 140,
  },
  itemMeta: {
    color: "#5e4a26",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  signText: {
    color: "#6f3f1c",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 5,
  },
  detailLine: {
    backgroundColor: colors.cream,
    borderColor: colors.woodLight,
    borderWidth: 2,
    gap: 3,
    padding: 8,
  },
  detailLabel: {
    color: colors.leaf,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  detailValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  reviewForm: {
    gap: 10,
  },
  reviewList: {
    gap: 8,
    marginTop: 4,
  },
  reviewCard: {
    backgroundColor: colors.shelf,
    borderColor: colors.woodLight,
    borderWidth: 2,
    gap: 6,
    padding: 9,
  },
  reviewHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reviewName: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
  },
  reviewRating: {
    color: colors.leaf,
    fontSize: 12,
    fontWeight: "900",
  },
  field: {
    gap: 5,
  },
  fieldLabel: {
    color: colors.leaf,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: colors.cream,
    borderColor: colors.woodLight,
    borderWidth: 2,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  segmented: {
    backgroundColor: colors.cream,
    borderColor: colors.wood,
    borderWidth: 2,
    flexDirection: "row",
    padding: 2,
  },
  segmentButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 10,
  },
  segmentButtonActive: {
    backgroundColor: colors.leaf,
  },
  segmentText: {
    color: "#7a6843",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  segmentTextActive: {
    color: colors.cream,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.sun,
    borderColor: colors.soil,
    borderWidth: 2,
    minHeight: 44,
    justifyContent: "center",
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  smallButton: {
    backgroundColor: colors.shelf,
    borderColor: colors.soil,
    borderWidth: 2,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  smallButtonText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  inlineButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.sun,
    borderColor: colors.soil,
    borderWidth: 2,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  inlineButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.cream,
    borderColor: colors.soil,
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  ratingPicker: {
    flexDirection: "row",
    gap: 7,
  },
  ratingButton: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderColor: colors.woodLight,
    borderWidth: 2,
    height: 36,
    justifyContent: "center",
    width: 42,
  },
  ratingButtonActive: {
    backgroundColor: colors.leaf,
    borderColor: colors.soil,
  },
  ratingButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  ratingButtonTextActive: {
    color: colors.cream,
  },
  notice: {
    backgroundColor: "#fff4dc",
    borderBottomColor: "#d8a05a",
    borderBottomWidth: 2,
    gap: 4,
    padding: 10,
  },
  loadingBlock: {
    alignItems: "center",
    backgroundColor: "#f3eccd",
    borderBottomColor: colors.woodLight,
    borderBottomWidth: 2,
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  noticeText: {
    color: "#7a461f",
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  noticeMeta: {
    color: "#5e4a26",
    fontSize: 10,
    fontWeight: "700",
  },
  errorText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: "800",
  },
  savedText: {
    color: colors.leaf,
    fontSize: 12,
    fontWeight: "900",
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    gap: 8,
    justifyContent: "center",
    padding: 28,
  },
  tabBar: {
    backgroundColor: colors.cream,
    borderTopColor: colors.soil,
    borderTopWidth: 2,
    flexDirection: "row",
    gap: 10,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  tabButton: {
    alignItems: "center",
    backgroundColor: colors.shelf,
    borderColor: colors.woodLight,
    borderWidth: 2,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  tabButtonActive: {
    backgroundColor: colors.leaf,
    borderColor: colors.soil,
  },
  tabText: {
    color: "#7a6843",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  tabTextActive: {
    color: colors.cream,
  },
});
