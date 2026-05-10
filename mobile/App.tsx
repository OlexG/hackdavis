import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  type ImageSourcePropType,
  KeyboardAvoidingView,
  Platform,
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
import { fetchShopSnapshot, uploadShopImage, type ShopDisplaySlotView, type ShopSnapshot } from "./lib/shop";
import {
  fetchSocialOffers,
  fetchSocialSnapshot,
  postFarmReview,
  postSocialOffer,
  type SocialFarmCard,
  type SocialFarmReview,
  type SocialOffer,
  type SocialSnapshot,
} from "./lib/social";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import MapView, { Marker, UrlTile, type Region } from "react-native-maps";
import { registerForPushNotifications } from "./lib/notifications";
import sunpatchLogo from "./assets/sunpatch-logo.png";
import basketIcon from "./assets/app-icons/basket.png";
import leafIcon from "./assets/app-icons/leaf.png";
import ledgerIcon from "./assets/app-icons/ledger.png";
import scrollIcon from "./assets/app-icons/scroll.png";
import shopIcon from "./assets/app-icons/shop.png";
import socialIcon from "./assets/app-icons/social.png";
import wagonIcon from "./assets/app-icons/wagon.png";

type MainTab = "social" | "shop";
type AuthMode = "login" | "signup";
type SocialView = "list" | "map";
type PixelGlyphName = "basket" | "leaf" | "ledger" | "scroll" | "shop" | "social" | "wagon";
type LoadState =
  | { status: "idle" | "loading" }
  | { status: "ready"; social: SocialSnapshot; shop: ShopSnapshot; offers: SocialOffer[] }
  | { status: "error"; message: string; social?: SocialSnapshot; shop?: ShopSnapshot; offers?: SocialOffer[] };

type ReviewDraft = {
  reviewerName: string;
  rating: number;
  comment: string;
};
type OfferDraft = {
  inventoryItemId: string;
  quantity: string;
  price: string;
  message: string;
};
type ShopImageSource = "camera" | "library";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

const glyphSources: Record<PixelGlyphName, ImageSourcePropType> = {
  basket: basketIcon,
  leaf: leafIcon,
  ledger: ledgerIcon,
  scroll: scrollIcon,
  shop: shopIcon,
  social: socialIcon,
  wagon: wagonIcon,
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

const shopImagePickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.72,
};

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [activeTab, setActiveTab] = useState<MainTab>("social");
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });

  const loadData = useCallback(async () => {
    setLoadState((current) => (current.status === "ready" ? current : { status: "loading" }));

    try {
      const [social, shop, offers] = await Promise.all([
        fetchSocialSnapshot(),
        fetchShopSnapshot(),
        fetchSocialOffers("inbox"),
      ]);
      setLoadState({ status: "ready", social, shop, offers: offers.offers });
    } catch (error) {
      setLoadState((current) => ({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to load Sunpatch data",
        social: "social" in current ? current.social : undefined,
        shop: "shop" in current ? current.shop : undefined,
        offers: "offers" in current ? current.offers : undefined,
      }));
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
      registerForPushNotifications().catch(() => undefined);
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
  const offers = loadState.status === "ready" || loadState.status === "error" ? loadState.offers ?? [] : [];

  return (
    <Shell>
      <View style={styles.topBar}>
        <LogoMark size="small" />
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
            offers={offers}
            refreshing={loadState.status === "loading"}
            onRefresh={loadData}
          />
        )}
      </View>

      <View style={styles.tabBar}>
        <TabButton active={activeTab === "social"} icon="social" label="Social" onPress={() => setActiveTab("social")} />
        <TabButton active={activeTab === "shop"} icon="shop" label="My Shop" onPress={() => setActiveTab("shop")} />
      </View>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
        style={styles.keyboardRoot}
      >
        <StatusBar barStyle="dark-content" />
        <View style={styles.app}>{children}</View>
      </KeyboardAvoidingView>
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
        <LogoMark size="large" />
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
  const [view, setView] = useState<SocialView>("list");
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
  const farmsWithCoords = farms.filter((farm) => farm.snapshot.details.pickupCoords);

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
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Panel tone="meadow">
        <View style={styles.heroHeader}>
          <IconBadge name="social" size="large" />
          <View style={styles.cardTitleBlock}>
            <Text style={styles.eyebrow}>Social</Text>
            <Text style={styles.title}>Top farms nearby</Text>
            <Text style={styles.bodyText}>
              {view === "list"
                ? `${farms.length} public ${farms.length === 1 ? "shelf" : "shelves"} to browse`
                : `${farmsWithCoords.length} pinned on the map`}
            </Text>
          </View>
        </View>
        <SegmentedControl
          value={view}
          options={[
            { label: "List", value: "list" },
            { label: "Map", value: "map" },
          ]}
          onChange={setView}
        />
      </Panel>

      {view === "list" ? (
        farms.map((farm) => (
          <FarmCard key={farm.userId} farm={farm} onSelect={() => setSelectedUserId(farm.userId)} />
        ))
      ) : (
        <FarmsMapView farms={farmsWithCoords} allFarmsCount={farms.length} onSelect={setSelectedUserId} />
      )}
    </ScrollView>
  );
}

function FarmCard({ farm, onSelect }: { farm: SocialFarmCard; onSelect: () => void }) {
  const visibleSlots = farm.snapshot.slots.filter((slot) => slot.visible).slice(0, 3);

  return (
    <Pressable accessibilityRole="button" onPress={onSelect} style={styles.farmCard}>
      <ShopImageRow slots={visibleSlots} />
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleBlock}>
          <Text style={styles.cardTitle} numberOfLines={1}>{farm.farmName}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaStrong}>{farm.distanceLabel}</Text>
            <Text style={styles.metaDot}>|</Text>
            <Text style={styles.metaGold}>★ {farm.rating ? farm.rating.toFixed(1) : "New"}</Text>
            <Text style={styles.metaDot}>|</Text>
            <Text style={styles.cardMeta}>{farm.reviewCount} reviews</Text>
          </View>
        </View>
        <IconBadge name="wagon" size="medium" />
      </View>
      <Text style={styles.bodyText} numberOfLines={2}>{farm.bio}</Text>
      <View style={styles.chipRow}>
        {farm.tags.slice(0, 4).map((tag, index) => (
          <Chip key={`${tag}-${index}`} label={tag} tone="cream" />
        ))}
      </View>
    </Pressable>
  );
}

function FarmsMapView({
  farms,
  allFarmsCount,
  onSelect,
}: {
  farms: SocialFarmCard[];
  allFarmsCount: number;
  onSelect: (userId: string) => void;
}) {
  const [activeUserId, setActiveUserId] = useState<string | null>(farms[0]?.userId ?? null);
  const activeFarm = farms.find((farm) => farm.userId === activeUserId) ?? farms[0];
  const mapRegion = useMemo(() => getFarmMapRegion(farms), [farms]);

  if (!farms.length) {
    return (
      <Panel>
        <IconBadge name="wagon" size="large" />
        <Text style={styles.sectionLabel}>No farms have dropped a pin yet</Text>
        <Text style={styles.bodyText}>
          {allFarmsCount} farms are listed but none have shared a pickup location. Browse the list view for now.
        </Text>
      </Panel>
    );
  }

  return (
    <View style={styles.mapStack}>
      <View style={styles.mapPanel}>
        <MapView
          style={styles.nativeMap}
          initialRegion={mapRegion}
          mapType="none"
          showsCompass={false}
          showsMyLocationButton={false}
          toolbarEnabled={false}
        >
          <UrlTile
            urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            tileSize={256}
          />
          {farms.map((farm) => {
            const coords = farm.snapshot.details.pickupCoords;
            if (!coords) return null;
            const active = farm.userId === activeFarm.userId;
            return (
              <Marker
                key={farm.userId}
                coordinate={{ latitude: coords.lat, longitude: coords.lng }}
                title={farm.farmName}
                description={farm.snapshot.details.pickupLocation || farm.distanceLabel}
                onPress={() => setActiveUserId(farm.userId)}
                zIndex={active ? 2 : 1}
              >
                <View style={[styles.mapPin, active && styles.mapPinActive]}>
                  <Image source={wagonIcon} style={styles.mapPinIcon} resizeMode="contain" />
                </View>
              </Marker>
            );
          })}
        </MapView>
      </View>

      {activeFarm ? (
        <View style={styles.mapCallout}>
          <ShopImageRow slots={activeFarm.snapshot.slots.filter((slot) => slot.visible).slice(0, 3)} compact />
          <View style={styles.cardTitleBlock}>
            <Text style={styles.cardTitle} numberOfLines={1}>{activeFarm.farmName}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {activeFarm.distanceLabel} | ★ {activeFarm.rating ? activeFarm.rating.toFixed(1) : "New"} | {activeFarm.reviewCount} reviews
            </Text>
            <Text style={styles.bodyText} numberOfLines={1}>
              {activeFarm.snapshot.details.pickupLocation || "Pickup details on the shopfront"}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => onSelect(activeFarm.userId)} style={styles.visitButton}>
            <PixelIcon name="wagon" size={14} />
            <Text style={styles.visitButtonText}>Visit</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
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
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
        <PixelIcon name="basket" size={14} />
        <Text style={styles.backButtonText}>Farms</Text>
      </Pressable>

      <ShopfrontPanel
        snapshot={farm.snapshot}
        fallbackName={farm.farmName}
        modeLabel="Public shop preview"
        statusLabel={`${farm.distanceLabel} | ${farm.rating ? farm.rating.toFixed(1) : "New"} rating`}
        visibleSlots={visibleSlots}
      />

      <OfferPanel farm={farm} visibleSlots={visibleSlots} />

      <Panel>
        <View style={styles.panelTitleRow}>
          <PixelIcon name="basket" size={18} />
          <Text style={styles.sectionLabel}>Reviews</Text>
          <Chip label={`${farm.rating ? farm.rating.toFixed(1) : "New"} | ${farm.reviewCount}`} tone="gold" />
        </View>
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

function OfferPanel({
  farm,
  visibleSlots,
}: {
  farm: SocialFarmCard;
  visibleSlots: ShopDisplaySlotView[];
}) {
  const firstSlot = visibleSlots[0];
  const [draft, setDraft] = useState<OfferDraft>({
    inventoryItemId: firstSlot?.inventoryItemId ?? "",
    quantity: firstSlot ? `${firstSlot.displayAmount} ${firstSlot.displayUnit}` : "",
    price: firstSlot ? (firstSlot.priceCents / 100).toFixed(2) : "",
    message: firstSlot ? `Hi, I would like to make an offer for ${firstSlot.item.name}.` : "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const selectedSlot = visibleSlots.find((slot) => slot.inventoryItemId === draft.inventoryItemId) ?? firstSlot;

  async function submitOffer() {
    setStatus("saving");
    setError(null);

    try {
      await postSocialOffer({
        farmUserId: farm.userId,
        inventoryItemId: selectedSlot?.inventoryItemId,
        itemName: selectedSlot?.item.name ?? farm.farmName,
        quantity: draft.quantity,
        priceCents: draft.price ? Math.round(Number(draft.price) * 100) : undefined,
        message: draft.message,
      });
      setDraft((current) => ({ ...current, quantity: "", price: "", message: "" }));
      setStatus("sent");
    } catch (offerError) {
      setStatus("error");
      setError(offerError instanceof Error ? offerError.message : "Unable to send offer");
    }
  }

  return (
    <Panel tone="sky">
      <View style={styles.panelTitleRow}>
        <PixelIcon name="wagon" size={18} />
        <Text style={styles.sectionLabel}>Send an offer</Text>
        <Chip label="Notifies seller" tone="blue" />
      </View>
      {!visibleSlots.length ? (
        <Text style={styles.bodyText}>This farm does not have visible shop items right now.</Text>
      ) : (
        <View style={styles.offerForm}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.offerItemScroller}>
            {visibleSlots.map((slot) => {
              const active = slot.inventoryItemId === draft.inventoryItemId;
              return (
                <Pressable
                  key={slot.inventoryItemId}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setDraft((current) => ({
                      ...current,
                      inventoryItemId: slot.inventoryItemId,
                      quantity: `${slot.displayAmount} ${slot.displayUnit}`,
                      price: (slot.priceCents / 100).toFixed(2),
                      message: `Hi, I would like to make an offer for ${slot.item.name}.`,
                    }));
                  }}
                  style={[styles.offerItemButton, active && styles.offerItemButtonActive]}
                >
                  <ProduceImage slot={slot} size={42} />
                  <Text style={[styles.offerItemText, active && styles.offerItemTextActive]} numberOfLines={1}>
                    {slot.item.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.offerFieldsRow}>
            <View style={styles.offerFieldHalf}>
              <Field label="Quantity" value={draft.quantity} onChangeText={(quantity) => setDraft((current) => ({ ...current, quantity }))} />
            </View>
            <View style={styles.offerFieldHalf}>
              <Field label="Offer $" value={draft.price} onChangeText={(price) => setDraft((current) => ({ ...current, price }))} keyboardType="decimal-pad" />
            </View>
          </View>
          <Field
            label="Message"
            value={draft.message}
            onChangeText={(message) => setDraft((current) => ({ ...current, message }))}
            multiline
          />
          {status === "error" && error ? <Text style={styles.errorText}>{error}</Text> : null}
          {status === "sent" ? <Text style={styles.savedText}>Offer sent. The seller will get a notification if their app is registered.</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={status === "saving"}
            onPress={submitOffer}
            style={[styles.primaryButton, status === "saving" && styles.buttonDisabled]}
          >
            <Text style={styles.primaryButtonText}>{status === "saving" ? "Sending..." : "Send offer"}</Text>
          </Pressable>
        </View>
      )}
    </Panel>
  );
}

function ShopScreen({
  snapshot,
  offers,
  refreshing,
  onRefresh,
}: {
  snapshot?: ShopSnapshot;
  offers: SocialOffer[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [imageOverrides, setImageOverrides] = useState<Record<string, { imageId: string; imageUrl: string }>>({});
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const slots = useMemo(
    () =>
      (snapshot?.slots ?? []).map((slot) => {
        const override = imageOverrides[slot.inventoryItemId];
        return override ? { ...slot, ...override } : slot;
      }),
    [imageOverrides, snapshot?.slots],
  );

  const visibleSlots = useMemo(
    () => slots.filter((slot) => slot.visible).sort((left, right) => left.position - right.position),
    [slots],
  );
  const hiddenSlots = useMemo(
    () => slots.filter((slot) => !slot.visible).sort((left, right) => left.position - right.position),
    [slots],
  );
  const totalDisplayed = visibleSlots.reduce((total, slot) => total + slot.displayAmount, 0);

  async function pickAndUploadShopImage(slot: ShopDisplaySlotView, source: ShopImageSource) {
    setImageError(null);

    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        throw new Error(
          source === "camera"
            ? "Camera access is needed to photograph shop items."
            : "Photo library access is needed to choose a shop image.",
        );
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync(shopImagePickerOptions)
          : await ImagePicker.launchImageLibraryAsync(shopImagePickerOptions);

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? inferImageMimeType(asset.uri);
      setUploadingItemId(slot.inventoryItemId);
      const uploaded = await uploadShopImage({
        inventoryItemId: slot.inventoryItemId,
        uri: asset.uri,
        fileName: asset.fileName ?? buildShopImageFileName(slot, mimeType),
        mimeType,
      });

      setImageOverrides((current) => ({
        ...current,
        [slot.inventoryItemId]: { imageId: uploaded.imageId, imageUrl: uploaded.imageUrl },
      }));
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Unable to update shop image");
    } finally {
      setUploadingItemId(null);
    }
  }

  if (!snapshot) {
    return <EmptyState title="Loading shop" body="Fetching your web shop display." />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.screenScroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <ShopfrontPanel
        snapshot={snapshot}
        fallbackName={snapshot.displayName}
        modeLabel="My shopfront"
        statusLabel={snapshot.isPublished ? "Published" : "Draft"}
        visibleSlots={visibleSlots}
        stats={[
          `${visibleSlots.length} on shelf`,
          `${Math.round(totalDisplayed * 10) / 10} units`,
          `${hiddenSlots.length} back stock`,
        ]}
        imageError={imageError}
        uploadingItemId={uploadingItemId}
        onPickImage={pickAndUploadShopImage}
      />

      <ReceivedOffersPanel offers={offers} />

      <BackStockPanel
        slots={hiddenSlots}
        uploadingItemId={uploadingItemId}
        onPickImage={pickAndUploadShopImage}
      />
    </ScrollView>
  );
}

function ShopfrontPanel({
  snapshot,
  fallbackName,
  modeLabel,
  statusLabel,
  visibleSlots,
  stats = [],
  imageError,
  uploadingItemId,
  onPickImage,
}: {
  snapshot: ShopSnapshot;
  fallbackName: string;
  modeLabel: string;
  statusLabel: string;
  visibleSlots: ShopDisplaySlotView[];
  stats?: string[];
  imageError?: string | null;
  uploadingItemId?: string | null;
  onPickImage?: (slot: ShopDisplaySlotView, source: ShopImageSource) => void;
}) {
  const shopName = snapshot.details.shopName || fallbackName;

  return (
    <View style={styles.shopfrontFrame}>
      <Awning />
      <View style={styles.shopHero}>
        <View style={styles.heroHeaderCentered}>
          <IconBadge name="wagon" size="large" />
          <View style={styles.centerCopy}>
            <Text style={styles.title} numberOfLines={2}>{shopName}</Text>
            <Text style={styles.bodyText}>{modeLabel}</Text>
          </View>
        </View>
        <View style={styles.centerChipRow}>
          <Chip label={statusLabel} tone={statusLabel === "Draft" ? "gold" : "green"} />
          {stats.map((stat) => <Chip key={stat} label={stat} tone="cream" />)}
        </View>
      </View>

      <View style={styles.infoStrip}>
        <View style={styles.detailGrid}>
          <DetailLine label="Hours" value={snapshot.details.hours || "Hours not set"} />
          <DetailLine label="Pickup" value={snapshot.details.pickupLocation || "Pickup not set"} />
          <DetailLine label="Payment" value={snapshot.details.paymentOptions || "Payment not set"} />
        </View>
        {snapshot.details.availabilityNote ? (
          <View style={styles.notePanel}>
            <PixelIcon name="leaf" size={18} />
            <Text style={styles.signText}>{snapshot.details.availabilityNote}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.shelfDeck}>
        {imageError ? (
          <View style={styles.imageErrorPanel}>
            <Text style={styles.errorText}>{imageError}</Text>
          </View>
        ) : null}
        {visibleSlots.length ? (
          visibleSlots.map((slot) => (
            <ShelfCard
              key={slot.id}
              slot={slot}
              canEditImage={Boolean(onPickImage)}
              isUploadingImage={uploadingItemId === slot.inventoryItemId}
              onPickImage={onPickImage}
            />
          ))
        ) : (
          <View style={styles.emptyShelf}>
            <PixelIcon name="basket" size={30} />
            <Text style={styles.sectionLabel}>No produce listed</Text>
            <Text style={styles.bodyText}>Check back when this shopfront has produce on the shelf.</Text>
          </View>
        )}
      </View>
      <View style={styles.shopFooter}>
        <Text style={styles.shopFooterText}>{snapshot.details.hours || "Hours not set"}</Text>
      </View>
    </View>
  );
}

function BackStockPanel({
  slots,
  uploadingItemId,
  onPickImage,
}: {
  slots: ShopDisplaySlotView[];
  uploadingItemId?: string | null;
  onPickImage?: (slot: ShopDisplaySlotView, source: ShopImageSource) => void;
}) {
  return (
    <Panel>
      <View style={styles.panelTitleRow}>
        <PixelIcon name="basket" size={18} />
        <Text style={styles.sectionLabel}>Back stock</Text>
        <Chip label={`${slots.length}`} tone="blue" />
      </View>
      {slots.length ? (
        slots.map((slot) => (
          <ShelfCard
            key={slot.id}
            slot={slot}
            compact
            canEditImage={Boolean(onPickImage)}
            isUploadingImage={uploadingItemId === slot.inventoryItemId}
            onPickImage={onPickImage}
          />
        ))
      ) : (
        <Text style={styles.bodyText}>No hidden sellable items.</Text>
      )}
    </Panel>
  );
}

function ReceivedOffersPanel({ offers }: { offers: SocialOffer[] }) {
  return (
    <Panel>
      <View style={styles.panelTitleRow}>
        <PixelIcon name="wagon" size={18} />
        <Text style={styles.sectionLabel}>Offers</Text>
        <Chip label={`${offers.length}`} tone="gold" />
      </View>
      {offers.length ? (
        <View style={styles.offerList}>
          {offers.slice(0, 6).map((offer) => (
            <View key={offer.id} style={styles.receivedOfferCard}>
              <View style={styles.shelfTopLine}>
                <Text style={styles.itemName}>{offer.itemName}</Text>
                <Chip label={offer.status} tone="cream" />
              </View>
              <Text style={styles.itemMeta}>
                {offer.quantity}
                {offer.priceCents !== undefined ? ` | ${formatMoney(offer.priceCents)}` : ""}
              </Text>
              <Text style={styles.signText}>{offer.message}</Text>
              <Text style={styles.cardMeta}>From {offer.senderName}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.bodyText}>New offers from neighbors will appear here after they send one from Social.</Text>
      )}
    </Panel>
  );
}

function ShelfCard({
  slot,
  compact,
  canEditImage,
  isUploadingImage,
  onPickImage,
}: {
  slot: ShopDisplaySlotView;
  compact?: boolean;
  canEditImage?: boolean;
  isUploadingImage?: boolean;
  onPickImage?: (slot: ShopDisplaySlotView, source: ShopImageSource) => void;
}) {
  return (
    <View style={[styles.shelfCard, compact && styles.shelfCardCompact]}>
      <ProduceImage slot={slot} size={compact ? 46 : 58} />
      <View style={styles.shelfCopy}>
        <View style={styles.shelfTopLine}>
          <Text style={styles.itemName}>{slot.item.name}</Text>
          <Chip label={categoryLabels[slot.item.category] ?? slot.item.category} tone="cream" />
        </View>
        <Text style={styles.itemMeta}>
          {slot.displayAmount} {slot.displayUnit} | {formatMoney(slot.priceCents)}/{singularUnit(slot.displayUnit)}
        </Text>
        <Text style={styles.signText}>{slot.signText}</Text>
        {canEditImage ? (
          <View style={styles.imageActionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={isUploadingImage}
              onPress={() => onPickImage?.(slot, "camera")}
              style={[styles.imageActionButton, isUploadingImage && styles.buttonDisabled]}
            >
              <Text style={styles.imageActionText}>{isUploadingImage ? "Uploading..." : slot.imageUrl ? "Retake" : "Camera"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isUploadingImage}
              onPress={() => onPickImage?.(slot, "library")}
              style={[styles.imageActionButtonSecondary, isUploadingImage && styles.buttonDisabled]}
            >
              <Text style={styles.imageActionTextSecondary}>Library</Text>
            </Pressable>
          </View>
        ) : null}
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

function LogoMark({ size }: { size: "small" | "large" }) {
  return (
    <View style={size === "large" ? styles.logoMarkLarge : styles.logoMark}>
      <Image source={sunpatchLogo} style={size === "large" ? styles.logoImageLarge : styles.logoImage} resizeMode="contain" />
    </View>
  );
}

function PixelIcon({ name, size = 16 }: { name: PixelGlyphName; size?: number }) {
  return (
    <Image
      source={glyphSources[name]}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

function IconBadge({ name, size }: { name: PixelGlyphName; size: "medium" | "large" }) {
  const dimensions = size === "large" ? styles.iconBadgeLarge : styles.iconBadgeMedium;
  return (
    <View style={[styles.iconBadge, dimensions]}>
      <PixelIcon name={name} size={size === "large" ? 26 : 18} />
    </View>
  );
}

function Awning() {
  return (
    <View style={styles.awning}>
      {Array.from({ length: 8 }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.awningStripe,
            { backgroundColor: index % 2 === 0 ? colors.red : colors.cream },
          ]}
        />
      ))}
    </View>
  );
}

function ShopImageRow({ slots, compact }: { slots: ShopDisplaySlotView[]; compact?: boolean }) {
  if (!slots.length) {
    return (
      <View style={[styles.shopImageRow, compact && styles.shopImageRowCompact]}>
        <View style={styles.shopImagePlaceholder}>
          <PixelIcon name="basket" size={22} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.shopImageRow, compact && styles.shopImageRowCompact]}>
      {slots.map((slot) => (
        <ProduceImage key={slot.id} slot={slot} size={compact ? 42 : 58} />
      ))}
    </View>
  );
}

function ProduceImage({ slot, size }: { slot: ShopDisplaySlotView; size: number }) {
  const imageUri = slot.imageUrl ? absoluteApiUrl(slot.imageUrl) : null;

  return (
    <View style={[styles.itemSwatch, { width: size, height: size, backgroundColor: `${slot.item.color || colors.gold}33` }]}>
      {imageUri ? (
        <RemoteProduceImage key={imageUri} imageUri={imageUri} />
      ) : (
        <View style={[styles.itemSwatchCore, { backgroundColor: slot.item.color || colors.gold }]} />
      )}
    </View>
  );
}

function RemoteProduceImage({ imageUri }: { imageUri: string }) {
  const [isLoadingImage, setIsLoadingImage] = useState(true);

  return (
    <>
      <Image
        source={{ uri: imageUri }}
        style={styles.producePhoto}
        resizeMode="cover"
        onLoadStart={() => setIsLoadingImage(true)}
        onLoadEnd={() => setIsLoadingImage(false)}
      />
      {isLoadingImage ? (
        <View style={styles.producePhotoLoading}>
          <ActivityIndicator color={colors.soil} />
        </View>
      ) : null}
    </>
  );
}

function Panel({ children, tone }: { children: ReactNode; tone?: "mint" | "sky" | "meadow" }) {
  return (
    <View style={[styles.panel, tone === "mint" && styles.panelMint, tone === "sky" && styles.panelSky, tone === "meadow" && styles.panelMeadow]}>
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
  keyboardType?: "default" | "email-address" | "decimal-pad";
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

function TabButton({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: PixelGlyphName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tabButton, active && styles.tabButtonActive]}
    >
      <PixelIcon name={icon} size={18} />
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

function getFarmMapRegion(farms: SocialFarmCard[]): Region {
  const coords = farms
    .map((farm) => farm.snapshot.details.pickupCoords)
    .filter((point): point is { lat: number; lng: number } => Boolean(point));
  const lats = coords.map((point) => point.lat);
  const lngs = coords.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latitudeDelta = Math.max((maxLat - minLat) * 1.8, 0.02);
  const longitudeDelta = Math.max((maxLng - minLng) * 1.8, 0.02);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta,
    longitudeDelta,
  };
}

function absoluteApiUrl(url: string) {
  if (url.startsWith("http")) {
    return url;
  }

  return `${getApiBaseUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
}

function inferImageMimeType(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function buildShopImageFileName(slot: ShopDisplaySlotView, mimeType: string) {
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  return `${slot.item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "shop-item"}-${Date.now()}.${ext}`;
}

function recomputeRating(farm: SocialFarmCard, review: SocialFarmReview, reviewCount: number) {
  const replaced = farm.reviews.find((item) => item.id === review.id);
  const previousTotal = farm.rating * farm.reviewCount - (replaced?.rating ?? 0);
  return Math.round(((previousTotal + review.rating) / Math.max(reviewCount, 1)) * 10) / 10;
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
  keyboardRoot: {
    flex: 1,
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
  logoImage: {
    height: 36,
    width: 34,
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
  logoImageLarge: {
    height: 56,
    width: 52,
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
  panelMeadow: {
    backgroundColor: "#eef8df",
  },
  heroHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  heroHeaderCentered: {
    alignItems: "center",
    gap: 8,
  },
  centerCopy: {
    alignItems: "center",
    gap: 2,
  },
  centerChipRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    justifyContent: "center",
  },
  iconBadge: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderColor: colors.soil,
    borderWidth: 2,
    justifyContent: "center",
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  iconBadgeMedium: {
    height: 42,
    width: 42,
  },
  iconBadgeLarge: {
    height: 52,
    width: 52,
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
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 2,
  },
  metaStrong: {
    color: "#335a2d",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  metaGold: {
    color: "#a8761c",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  metaDot: {
    color: "#7a6843",
    fontSize: 10,
    fontWeight: "900",
  },
  farmCard: {
    backgroundColor: colors.cream,
    borderColor: colors.woodLight,
    borderWidth: 2,
    gap: 9,
    padding: 10,
    shadowColor: "#b29c66",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
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
  shopImageRow: {
    flexDirection: "row",
    gap: 7,
  },
  shopImageRowCompact: {
    flexShrink: 0,
  },
  shopImagePlaceholder: {
    alignItems: "center",
    backgroundColor: colors.shelf,
    borderColor: colors.woodLight,
    borderWidth: 2,
    height: 58,
    justifyContent: "center",
    width: 58,
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
    overflow: "hidden",
    width: 50,
  },
  producePhoto: {
    height: "100%",
    width: "100%",
  },
  producePhotoLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(255, 253, 245, 0.78)",
    justifyContent: "center",
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
  panelTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  awning: {
    borderBottomColor: colors.soil,
    borderBottomWidth: 2,
    flexDirection: "row",
    height: 20,
  },
  awningStripe: {
    flex: 1,
    borderRightColor: colors.soil,
    borderRightWidth: 1,
  },
  shopfrontFrame: {
    backgroundColor: colors.cream,
    borderColor: colors.soil,
    borderWidth: 2,
    overflow: "hidden",
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  shopHero: {
    alignItems: "center",
    backgroundColor: colors.sky,
    borderBottomColor: colors.soil,
    borderBottomWidth: 2,
    gap: 10,
    padding: 14,
  },
  infoStrip: {
    backgroundColor: "#fffaf0",
    gap: 9,
    padding: 10,
  },
  detailGrid: {
    gap: 7,
  },
  notePanel: {
    alignItems: "flex-start",
    backgroundColor: colors.cream,
    borderColor: colors.soil,
    borderWidth: 2,
    flexDirection: "row",
    gap: 8,
    padding: 9,
  },
  shelfDeck: {
    backgroundColor: colors.shelf,
    borderTopColor: colors.soil,
    borderTopWidth: 2,
    gap: 9,
    minHeight: 220,
    padding: 10,
  },
  imageErrorPanel: {
    backgroundColor: "#fff0e6",
    borderColor: colors.red,
    borderWidth: 2,
    padding: 9,
  },
  emptyShelf: {
    alignItems: "center",
    backgroundColor: "#fffdf5cc",
    borderColor: colors.woodLight,
    borderStyle: "dashed",
    borderWidth: 2,
    gap: 7,
    justifyContent: "center",
    minHeight: 160,
    padding: 18,
  },
  imageActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 8,
  },
  imageActionButton: {
    backgroundColor: colors.leaf,
    borderColor: colors.soil,
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  imageActionButtonSecondary: {
    backgroundColor: colors.sun,
    borderColor: colors.soil,
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  imageActionText: {
    color: colors.cream,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  imageActionTextSecondary: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  shopFooter: {
    alignItems: "center",
    backgroundColor: colors.wood,
    borderTopColor: colors.soil,
    borderTopWidth: 2,
    padding: 8,
  },
  shopFooterText: {
    color: colors.cream,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  mapStack: {
    gap: 10,
  },
  mapPanel: {
    backgroundColor: "#dff4e1",
    borderColor: colors.soil,
    borderWidth: 2,
    height: 310,
    overflow: "hidden",
    position: "relative",
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  nativeMap: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPin: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderColor: colors.soil,
    borderWidth: 2,
    height: 34,
    justifyContent: "center",
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    width: 34,
  },
  mapPinActive: {
    backgroundColor: colors.sun,
    transform: [{ scale: 1.14 }],
  },
  mapPinIcon: {
    height: 18,
    width: 18,
  },
  mapCallout: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderColor: colors.soil,
    borderWidth: 2,
    flexDirection: "row",
    gap: 10,
    padding: 10,
    shadowColor: colors.soil,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  visitButton: {
    alignItems: "center",
    backgroundColor: colors.leaf,
    borderColor: colors.soil,
    borderWidth: 2,
    flexDirection: "row",
    gap: 5,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  visitButtonText: {
    color: colors.cream,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  reviewForm: {
    gap: 10,
  },
  offerForm: {
    gap: 10,
  },
  offerItemScroller: {
    gap: 8,
    paddingRight: 8,
  },
  offerItemButton: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderColor: colors.woodLight,
    borderWidth: 2,
    gap: 6,
    minWidth: 92,
    padding: 7,
  },
  offerItemButtonActive: {
    backgroundColor: colors.leaf,
    borderColor: colors.soil,
  },
  offerItemText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "900",
    maxWidth: 80,
    textTransform: "uppercase",
  },
  offerItemTextActive: {
    color: colors.cream,
  },
  offerFieldsRow: {
    flexDirection: "row",
    gap: 8,
  },
  offerFieldHalf: {
    flex: 1,
    minWidth: 0,
  },
  offerList: {
    gap: 8,
  },
  receivedOfferCard: {
    backgroundColor: colors.shelf,
    borderColor: colors.woodLight,
    borderWidth: 2,
    gap: 5,
    padding: 9,
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
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.cream,
    borderColor: colors.soil,
    borderWidth: 2,
    flexDirection: "row",
    gap: 7,
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
    flexDirection: "row",
    gap: 7,
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
