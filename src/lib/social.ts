import "server-only";

import { ObjectId, type WithId } from "mongodb";
import { AuthenticationError, requireUserSession } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";
import type {
  Farm,
  FarmReview,
  InventoryItem,
  Profile,
  ShopDisplay,
  ShopDisplayDetails,
  ShopDisplaySlot,
  SocialOffer,
  User,
} from "@/lib/models";
import { sendOfferNotification } from "@/lib/notifications";
import type { InventoryViewItem } from "@/lib/inventory";
import type { ShopDisplaySlotView, ShopSnapshot } from "@/lib/shop";

const sellableCategories = ["harvest", "preserves"] as const;

export type SocialFarmCard = {
  userId: string;
  farmName: string;
  displayName: string;
  bio: string;
  distanceLabel: string;
  rating: number;
  reviewCount: number;
  availablePreview: string[];
  tags: string[];
  snapshot: ShopSnapshot;
  reviews: SocialFarmReview[];
};

export type SocialFarmReview = {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  tags: string[];
  createdAt: string;
};

export type SocialSnapshot = {
  farms: SocialFarmCard[];
  lastUpdated: string;
};

export type CreateFarmReviewInput = {
  farmUserId: string;
  reviewerName: string;
  rating: number;
  comment: string;
};

export type CreateFarmReviewResult = {
  review: SocialFarmReview;
  created: boolean;
};

export type SocialOfferView = {
  id: string;
  farmUserId: string;
  senderUserId: string;
  senderName: string;
  inventoryItemId?: string;
  itemName: string;
  quantity: string;
  priceCents?: number;
  message: string;
  status: SocialOffer["status"];
  createdAt: string;
};

export type CreateSocialOfferInput = {
  farmUserId: string;
  inventoryItemId?: string;
  itemName: string;
  quantity: string;
  priceCents?: number;
  message: string;
};

export type CreateSocialOfferResult = {
  offer: SocialOfferView;
  notificationSent: boolean;
};

export type SocialOfferBox = "inbox" | "sent";

export async function getSocialSnapshot(): Promise<SocialSnapshot> {
  try {
    const db = await getMongoDb();
    const currentUser = await requireUserSession();
    const users = await db
      .collection<User>("users")
      .find({ _id: { $ne: currentUser.userId } })
      .sort({ createdAt: 1 })
      .toArray();

    if (!users.length) {
      return getFallbackSocialSnapshot();
    }

    const userIds = users.map((user) => user._id);
    const [profiles, farms, displays, inventoryItems, reviews] = await Promise.all([
      db.collection<Profile>("profiles").find({ userId: { $in: userIds } }).toArray(),
      db.collection<Farm>("farms").find({ userId: { $in: userIds } }).toArray(),
      db.collection<ShopDisplay>("shop_displays").find({ userId: { $in: userIds } }).toArray(),
      db
        .collection<InventoryItem>("inventory_items")
        .find({ userId: { $in: userIds }, category: { $in: [...sellableCategories] } })
        .sort({ category: 1, status: 1, name: 1 })
        .toArray(),
      db.collection<FarmReview>("farm_reviews").find({ farmUserId: { $in: userIds } }).toArray(),
    ]);

    const profilesByUser = byUserId(profiles);
    const farmsByUser = byUserId(farms);
    const displaysByUser = byUserId(displays);
    const itemsByUser = groupByUserId(inventoryItems);
    const reviewsByUser = groupReviewsByFarmUserId(reviews);

    const farmCards = users
      .map((user, index) => {
        const profile = profilesByUser.get(user._id.toString());
        const farm = farmsByUser.get(user._id.toString());
        const display = displaysByUser.get(user._id.toString());
        const items = itemsByUser.get(user._id.toString()) ?? [];

        if (!display || !items.length) {
          return null;
        }

        const displayName = profile?.displayName || "Neighbor Farmer";
        const viewItems = items.map(toInventoryViewItem);
        const slots = buildPublicShopSlots(viewItems, display.slots);
        const visibleSlots = slots.filter((slot) => slot.visible);
        const farmReviews = (reviewsByUser.get(user._id.toString()) ?? [])
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
        const rating = farmReviews.length
          ? farmReviews.reduce((sum, review) => sum + review.rating, 0) / farmReviews.length
          : 0;

        return {
          userId: user._id.toString(),
          farmName: farm?.name || display.details?.shopName || `${displayName}'s Farm`,
          displayName,
          bio: profile?.bio || "Local grower sharing extra harvest with nearby neighbors.",
          distanceLabel: `${(0.4 + index * 0.35).toFixed(1)} mi away`,
          rating: Math.round(rating * 10) / 10,
          reviewCount: farmReviews.length,
          availablePreview: visibleSlots.slice(0, 4).map((slot) => slot.item.name),
          tags: buildFarmTags(visibleSlots, farmReviews),
          snapshot: {
            userEmail: user.email,
            displayName,
            isPublished: Boolean(display),
            theme: display.theme,
            layoutMode: display.layoutMode,
            details: normalizePublicDetails(display.details, displayName),
            sellableItems: viewItems,
            slots,
            lastUpdated: newestTimestamp(viewItems, display.updatedAt),
          },
          reviews: farmReviews.slice(0, 3).map(toSocialReview),
        } satisfies SocialFarmCard;
      })
      .filter((farm): farm is SocialFarmCard => farm !== null)
      .sort((left, right) => right.rating - left.rating || right.reviewCount - left.reviewCount);

    if (!farmCards.length) {
      return getFallbackSocialSnapshot();
    }

    return {
      farms: farmCards,
      lastUpdated: farmCards.map((farm) => farm.snapshot.lastUpdated).sort().at(-1) ?? new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return getFallbackSocialSnapshot();
  }
}

export async function createFarmReview(input: CreateFarmReviewInput): Promise<CreateFarmReviewResult> {
  if (!ObjectId.isValid(input.farmUserId)) {
    throw new SocialReviewError("Choose a valid farm to review");
  }

  const reviewerName = normalizeReviewText(input.reviewerName, 36);
  const comment = normalizeReviewText(input.comment, 220);
  const rating = Math.trunc(Number(input.rating));

  if (!reviewerName) {
    throw new SocialReviewError("Add your name before posting a review");
  }
  if (!comment || comment.length < 8) {
    throw new SocialReviewError("Write a short review before posting");
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new SocialReviewError("Choose a 1 to 5 star rating");
  }

  const db = await getMongoDb();
  const currentUser = await requireUserSession();
  const farmUserId = new ObjectId(input.farmUserId);

  if (farmUserId.equals(currentUser.userId)) {
    throw new SocialReviewError("You cannot review your own farm");
  }

  const [targetUser, display] = await Promise.all([
    db.collection<User>("users").findOne({ _id: farmUserId }),
    db.collection<ShopDisplay>("shop_displays").findOne({ userId: farmUserId }),
  ]);

  if (!targetUser || !display) {
    throw new SocialReviewError("That public farm was not found");
  }

  const now = new Date();
  const tags = inferReviewTags(comment);
  const existing = await db.collection<FarmReview>("farm_reviews").findOne({ farmUserId, reviewerName });
  const review = await db.collection<FarmReview>("farm_reviews").findOneAndUpdate(
    { farmUserId, reviewerName },
    {
      $set: {
        farmUserId,
        reviewerName,
        rating,
        comment,
        tags,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!review) {
    throw new Error("Review was saved but could not be loaded");
  }

  return {
    review: toSocialReview(review),
    created: !existing,
  };
}

export async function createSocialOffer(input: CreateSocialOfferInput): Promise<CreateSocialOfferResult> {
  if (!ObjectId.isValid(input.farmUserId)) {
    throw new SocialOfferError("Choose a valid farm for the offer");
  }

  const db = await getMongoDb();
  const currentUser = await requireUserSession();
  const farmUserId = new ObjectId(input.farmUserId);

  if (farmUserId.equals(currentUser.userId)) {
    throw new SocialOfferError("You cannot send an offer to your own farm");
  }

  const quantity = normalizeReviewText(input.quantity, 48);
  const message = normalizeReviewText(input.message, 220);
  const requestedItemName = normalizeReviewText(input.itemName, 80);
  const priceCents =
    typeof input.priceCents === "number" && Number.isFinite(input.priceCents) && input.priceCents >= 0
      ? Math.round(input.priceCents)
      : undefined;

  if (!quantity) {
    throw new SocialOfferError("Add a quantity for the offer");
  }
  if (!message || message.length < 8) {
    throw new SocialOfferError("Write a short offer note");
  }

  const [targetUser, display, profile] = await Promise.all([
    db.collection<User>("users").findOne({ _id: farmUserId }),
    db.collection<ShopDisplay>("shop_displays").findOne({ userId: farmUserId }),
    db.collection<Profile>("profiles").findOne({ userId: currentUser.userId }),
  ]);

  if (!targetUser || !display) {
    throw new SocialOfferError("That public farm was not found");
  }

  const inventoryItemId =
    input.inventoryItemId && ObjectId.isValid(input.inventoryItemId)
      ? new ObjectId(input.inventoryItemId)
      : undefined;
  let itemName = requestedItemName;

  if (inventoryItemId) {
    const item = await db.collection<InventoryItem>("inventory_items").findOne({
      _id: inventoryItemId,
      userId: farmUserId,
      category: { $in: [...sellableCategories] },
    });

    if (!item) {
      throw new SocialOfferError("That shop item is no longer available");
    }

    const visibleSlot = display.slots.some(
      (slot) => slot.visible && slot.inventoryItemId.equals(inventoryItemId),
    );

    if (!visibleSlot) {
      throw new SocialOfferError("That shop item is not currently listed");
    }

    itemName = item.name;
  }

  if (!itemName) {
    throw new SocialOfferError("Choose an item for the offer");
  }

  const now = new Date();
  const offer: SocialOffer = {
    _id: new ObjectId(),
    farmUserId,
    senderUserId: currentUser.userId,
    senderName: profile?.displayName || currentUser.displayName || currentUser.email,
    ...(inventoryItemId ? { inventoryItemId } : {}),
    itemName,
    quantity,
    ...(priceCents !== undefined ? { priceCents } : {}),
    message,
    status: "sent",
    createdAt: now,
    updatedAt: now,
  };

  await Promise.all([
    db.collection<SocialOffer>("social_offers").createIndex({ farmUserId: 1, createdAt: -1 }),
    db.collection<SocialOffer>("social_offers").createIndex({ senderUserId: 1, createdAt: -1 }),
  ]);
  await db.collection<SocialOffer>("social_offers").insertOne(offer);

  const notification = await sendOfferNotification({
    recipientUserId: farmUserId,
    senderName: offer.senderName,
    itemName: offer.itemName,
    offerId: offer._id.toString(),
  });

  return {
    offer: toSocialOfferView(offer),
    notificationSent: notification.sent > 0,
  };
}

export async function getSocialOffers(box: SocialOfferBox = "inbox") {
  const db = await getMongoDb();
  const currentUser = await requireUserSession();
  const selector = box === "sent"
    ? { senderUserId: currentUser.userId }
    : { farmUserId: currentUser.userId };

  const offers = await db
    .collection<SocialOffer>("social_offers")
    .find(selector)
    .sort({ createdAt: -1 })
    .limit(20)
    .toArray();

  return {
    offers: offers.map(toSocialOfferView),
    box,
    lastUpdated: offers[0]?.updatedAt.toISOString() ?? new Date().toISOString(),
  };
}

export class SocialReviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialReviewError";
  }
}

export class SocialOfferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SocialOfferError";
  }
}

function byUserId<T extends { userId?: ObjectId }>(items: T[]) {
  return new Map(
    items
      .filter((item): item is T & { userId: ObjectId } => item.userId instanceof ObjectId)
      .map((item) => [item.userId.toString(), item]),
  );
}

function groupByUserId<T extends { userId?: ObjectId }>(items: T[]) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    if (!(item.userId instanceof ObjectId)) {
      continue;
    }
    const key = item.userId.toString();
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return groups;
}

function groupReviewsByFarmUserId(reviews: FarmReview[]) {
  const groups = new Map<string, FarmReview[]>();

  for (const review of reviews) {
    const key = review.farmUserId.toString();
    groups.set(key, [...(groups.get(key) ?? []), review]);
  }

  return groups;
}

function buildPublicShopSlots(items: InventoryViewItem[], savedSlots: ShopDisplaySlot[]) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const slots: ShopDisplaySlotView[] = [];

  for (const savedSlot of [...savedSlots].sort((left, right) => left.position - right.position)) {
    const item = itemById.get(savedSlot.inventoryItemId.toString());

    if (!item) {
      continue;
    }

    const imageId = savedSlot.imageId?.toString();
    slots.push({
      id: `slot-${item.id}`,
      inventoryItemId: item.id,
      listingId: savedSlot.listingId ?? item.id,
      position: slots.length,
      displayAmount: savedSlot.displayAmount,
      displayUnit: savedSlot.displayUnit,
      priceCents: savedSlot.priceCents,
      signText: savedSlot.signText,
      visible: savedSlot.visible,
      imageId,
      imageUrl: imageId ? `/api/shop/image/${imageId}` : undefined,
      item,
    });
  }

  return slots;
}

function toInventoryViewItem(item: InventoryItem): InventoryViewItem {
  return {
    id: item._id.toString(),
    name: item.name,
    category: item.category,
    status: item.status,
    quantity: item.quantity,
    reorderAt: item.reorderAt,
    location: item.location,
    source: item.source,
    notes: item.notes,
    color: item.color,
    useBy: item.useBy?.toISOString(),
    acquiredAt: item.acquiredAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function normalizePublicDetails(details: ShopDisplay["details"], displayName: string): ShopDisplayDetails {
  return {
    shopName: details?.shopName || `${displayName}'s Stand`,
    hours: details?.hours || "Sat and Sun, 9 AM - 1 PM",
    pickupLocation: details?.pickupLocation || "Porch cooler",
    ...(details?.pickupCoords ? { pickupCoords: details.pickupCoords } : {}),
    pickupInstructions: details?.pickupInstructions || "",
    paymentOptions: details?.paymentOptions || "Cash, Venmo, or trade",
    contact: details?.contact || "",
    availabilityNote: details?.availabilityNote || "Small-batch produce posted when harvested.",
  };
}

function buildFarmTags(slots: ShopDisplaySlotView[], reviews: FarmReview[]) {
  const categoryTags = Array.from(new Set(slots.map((slot) => slot.item.category))).slice(0, 2);
  const reviewTags = Array.from(new Set(reviews.flatMap((review) => review.tags))).slice(0, 2);
  return [...categoryTags, ...reviewTags].map(toTitleCase).slice(0, 4);
}

function toSocialReview(review: FarmReview | WithId<FarmReview>): SocialFarmReview {
  return {
    id: review._id.toString(),
    reviewerName: review.reviewerName,
    rating: review.rating,
    comment: review.comment,
    tags: review.tags,
    createdAt: review.createdAt.toISOString(),
  };
}

function toSocialOfferView(offer: SocialOffer): SocialOfferView {
  return {
    id: offer._id.toString(),
    farmUserId: offer.farmUserId.toString(),
    senderUserId: offer.senderUserId.toString(),
    senderName: offer.senderName,
    inventoryItemId: offer.inventoryItemId?.toString(),
    itemName: offer.itemName,
    quantity: offer.quantity,
    priceCents: offer.priceCents,
    message: offer.message,
    status: offer.status,
    createdAt: offer.createdAt.toISOString(),
  };
}

function normalizeReviewText(value: string, limit: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function inferReviewTags(comment: string) {
  const lower = comment.toLowerCase();
  const tags = [
    lower.includes("pickup") || lower.includes("easy") ? "easy pickup" : "",
    lower.includes("fresh") || lower.includes("crisp") || lower.includes("sweet") ? "fresh" : "",
    lower.includes("tomato") ? "tomatoes" : "",
    lower.includes("egg") ? "eggs" : "",
    lower.includes("mushroom") ? "mushrooms" : "",
    lower.includes("jam") || lower.includes("jar") || lower.includes("sauce") ? "preserves" : "",
    lower.includes("flower") || lower.includes("bouquet") ? "flowers" : "",
    lower.includes("herb") || lower.includes("basil") ? "herbs" : "",
    lower.includes("green") || lower.includes("lettuce") || lower.includes("salad") ? "greens" : "",
  ].filter(Boolean);

  return Array.from(new Set(tags)).slice(0, 3);
}

function newestTimestamp(items: InventoryViewItem[], displayUpdatedAt?: Date) {
  return [
    ...items.map((item) => item.updatedAt),
    displayUpdatedAt?.toISOString(),
  ]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? new Date().toISOString();
}

function toTitleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function getFallbackSocialSnapshot(): SocialSnapshot {
  return {
    farms: [],
    lastUpdated: new Date().toISOString(),
  };
}
