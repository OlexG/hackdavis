import "server-only";

import { ObjectId } from "mongodb";
import { AuthenticationError, getCurrentUser, requireUserSession } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";
import type { OfferNotification, PushDeviceToken, ShopOffering, User } from "@/lib/models";

const expoPushEndpoint = "https://exp.host/--/api/v2/push/send";

export type OfferNotificationView = {
  id: string;
  type: "offer";
  status: OfferNotification["status"];
  listingId: string;
  offeringName: string;
  farmName?: string;
  recipientUserUuid: string;
  actorUserUuid: string;
  actorName: string;
  mode: OfferNotification["mode"];
  cashOfferCents?: number;
  barterListingIds: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateOfferPayload = {
  listingId: string;
  farmId?: string;
  farmName?: string;
  actorUserUuid?: string;
  actorName?: string;
  mode: "cash" | "barter";
  cashOfferCents?: number;
  barterListingIds?: string[];
  note?: string;
};

export type RegisterPushTokenInput = {
  token: string;
  platform?: string;
  deviceName?: string;
};

export async function registerPushToken(input: RegisterPushTokenInput) {
  const token = normalizePushToken(input.token);

  if (!isLikelyExpoPushToken(token)) {
    throw new PushTokenError("Invalid Expo push token");
  }

  const db = await getMongoDb();
  const currentUser = await requireUserSession();
  const now = new Date();

  await db.collection<PushDeviceToken>("push_device_tokens").createIndex({ token: 1 }, { unique: true });
  await db.collection<PushDeviceToken>("push_device_tokens").createIndex({ userId: 1, updatedAt: -1 });
  await db.collection<PushDeviceToken>("push_device_tokens").updateOne(
    { token },
    {
      $set: {
        userId: currentUser.userId,
        token,
        platform: normalizeOptionalText(input.platform, 32),
        deviceName: normalizeOptionalText(input.deviceName, 80),
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        createdAt: now,
      },
    },
    { upsert: true },
  );

  return { ok: true };
}

export async function listOfferNotifications(input: { userUuid?: string } = {}) {
  const db = await getMongoDb();
  const currentUser = await getCurrentUser();
  const userUuid = input.userUuid ?? currentUser?.uuid;

  if (!userUuid) {
    throw new AuthenticationError("Sign in to view offers");
  }

  await ensureNotificationIndexes();

  const docs = await db
    .collection<OfferNotification>("notifications")
    .find({
      type: "offer",
      $or: [
        { recipientUserUuid: userUuid },
        { actorUserUuid: userUuid },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  return docs.map(toOfferNotificationView);
}

export async function createOfferNotification(payload: CreateOfferPayload) {
  const db = await getMongoDb();
  await ensureNotificationIndexes();

  const listingId = normalizeText(payload.listingId, 80);
  if (!listingId) {
    throw new Error("Missing listing ID");
  }

  const offering = await db.collection<ShopOffering>("shop_offerings").findOne({ listingId });
  if (!offering) {
    throw new Error("Offering not found");
  }

  const currentUser = await getCurrentUser();
  const actorUserUuid = normalizeText(payload.actorUserUuid, 80) ?? currentUser?.uuid ?? "mobile-guest";
  const actorName = normalizeText(payload.actorName, 80) ?? currentUser?.displayName ?? "Mobile shopper";
  const now = new Date();

  const doc: OfferNotification = {
    _id: new ObjectId(),
    type: "offer",
    status: "pending",
    listingId,
    offeringName: offering.name,
    farmId: ObjectId.isValid(payload.farmId ?? "") ? new ObjectId(payload.farmId) : undefined,
    farmName: normalizeText(payload.farmName, 120) ?? undefined,
    recipientUserUuid: offering.userUuid,
    actorUserUuid,
    actorName,
    mode: payload.mode === "barter" ? "barter" : "cash",
    cashOfferCents: normalizeCents(payload.cashOfferCents),
    barterListingIds: (payload.barterListingIds ?? []).map((id) => normalizeText(id, 80)).filter(Boolean) as string[],
    note: normalizeText(payload.note, 240) ?? undefined,
    pushEvents: { offerMadeAt: now },
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<OfferNotification>("notifications").insertOne(doc);
  await sendPushNotificationToUserUuid(offering.userUuid, {
    title: "New offer",
    body: `${actorName} made an offer for ${offering.name}.`,
    data: { notificationId: doc._id.toString(), listingId, type: "offer" },
  });

  return toOfferNotificationView(doc);
}

export async function acceptOfferNotification(notificationId: string) {
  if (!ObjectId.isValid(notificationId)) {
    throw new Error("Invalid offer ID");
  }

  const db = await getMongoDb();
  const currentUser = await requireUserSession();
  const now = new Date();
  const result = await db.collection<OfferNotification>("notifications").findOneAndUpdate(
    {
      _id: new ObjectId(notificationId),
      type: "offer",
      recipientUserUuid: currentUser.uuid,
    },
    {
      $set: {
        status: "accepted",
        "pushEvents.offerAcceptedAt": now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    throw new Error("Offer not found");
  }

  await sendPushNotificationToUserUuid(result.actorUserUuid, {
    title: "Offer accepted",
    body: `${currentUser.displayName} accepted your offer for ${result.offeringName}.`,
    data: { notificationId: result._id.toString(), listingId: result.listingId, type: "offer" },
  });

  return toOfferNotificationView(result);
}

export async function sendOfferNotification({
  recipientUserId,
  senderName,
  itemName,
  offerId,
}: {
  recipientUserId: ObjectId;
  senderName: string;
  itemName: string;
  offerId: string;
}) {
  const db = await getMongoDb();
  const tokens = await db
    .collection<PushDeviceToken>("push_device_tokens")
    .find({ userId: recipientUserId })
    .sort({ updatedAt: -1 })
    .limit(8)
    .toArray();

  if (!tokens.length) {
    return { sent: 0 };
  }

  const messages = tokens.map((token) => ({
    to: token.token,
    sound: "default",
    title: "New Sunpatch offer",
    body: `${senderName} sent an offer for ${itemName}.`,
    data: {
      type: "social_offer",
      offerId,
    },
  }));

  const response = await fetch(expoPushEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
  }).catch(() => null);

  return { sent: response?.ok ? messages.length : 0 };
}

export class PushTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PushTokenError";
  }
}

async function ensureNotificationIndexes() {
  const db = await getMongoDb();
  await Promise.all([
    db.collection<OfferNotification>("notifications").createIndex({ type: 1, recipientUserUuid: 1, createdAt: -1 }),
    db.collection<OfferNotification>("notifications").createIndex({ type: 1, actorUserUuid: 1, createdAt: -1 }),
    db.collection<OfferNotification>("notifications").createIndex({ listingId: 1, createdAt: -1 }),
  ]);
}

async function sendPushNotificationToUserUuid(
  userUuid: string,
  message: { title: string; body: string; data: Record<string, string> },
) {
  const db = await getMongoDb();
  const recipient = await db.collection<User>("users").findOne({ uuid: userUuid });

  if (!recipient) {
    return;
  }

  const savedTokens = await db
    .collection<PushDeviceToken>("push_device_tokens")
    .find({ userId: recipient._id })
    .sort({ updatedAt: -1 })
    .limit(8)
    .toArray();
  const tokens = [
    ...savedTokens.map((token) => token.token),
    ...(recipient.pushTokens ?? []),
  ].filter(isLikelyExpoPushToken);

  if (!tokens.length) {
    return;
  }

  await fetch(expoPushEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tokens.map((to) => ({ to, sound: "default", ...message }))),
  }).catch((error) => {
    console.warn("[notifications] Expo push failed:", error);
  });
}

function toOfferNotificationView(doc: OfferNotification): OfferNotificationView {
  return {
    id: doc._id.toString(),
    type: "offer",
    status: doc.status,
    listingId: doc.listingId,
    offeringName: doc.offeringName,
    farmName: doc.farmName,
    recipientUserUuid: doc.recipientUserUuid,
    actorUserUuid: doc.actorUserUuid,
    actorName: doc.actorName,
    mode: doc.mode,
    cashOfferCents: doc.cashOfferCents,
    barterListingIds: doc.barterListingIds ?? [],
    note: doc.note ?? "",
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function normalizePushToken(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function isLikelyExpoPushToken(value: string) {
  return /^ExponentPushToken\[[\w-]+\]$/.test(value) || /^ExpoPushToken\[[\w-]+\]$/.test(value);
}

function normalizeOptionalText(value: string | undefined, limit: number) {
  const normalized = value?.replace(/\s+/g, " ").trim().slice(0, limit);
  return normalized || undefined;
}

function normalizeText(value: unknown, limit: number) {
  return typeof value === "string" && value.trim()
    ? value.replace(/\s+/g, " ").trim().slice(0, limit)
    : null;
}

function normalizeCents(value: unknown) {
  const cents = Number(value);
  return Number.isFinite(cents) && cents >= 0 ? Math.round(cents) : undefined;
}
