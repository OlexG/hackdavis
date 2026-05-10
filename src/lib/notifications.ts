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
  source?: OfferNotification["source"];
  socialOfferId?: string;
  offeringName: string;
  farmName?: string;
  recipientUserUuid: string;
  actorUserUuid: string;
  actorName: string;
  mode: OfferNotification["mode"];
  cashOfferCents?: number;
  barterListingIds: string[];
  quantity?: string;
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

type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  channelId?: string;
  priority?: "default" | "normal" | "high";
  data: Record<string, string>;
};

type ExpoPushTicket = {
  status?: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
};

export type CreateSocialOfferNotificationInput = {
  offerId: string;
  inventoryItemId?: string;
  recipientUserUuid: string;
  actorUserUuid: string;
  actorName: string;
  itemName: string;
  quantity: string;
  priceCents?: number;
  message?: string;
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
    source: "shop",
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

export async function createSocialOfferNotification(input: CreateSocialOfferNotificationInput) {
  const db = await getMongoDb();
  await ensureNotificationIndexes();

  const now = new Date();
  const doc: OfferNotification = {
    _id: new ObjectId(),
    type: "offer",
    status: "pending",
    source: "social",
    socialOfferId: input.offerId,
    listingId: input.inventoryItemId ?? input.offerId,
    offeringName: input.itemName,
    recipientUserUuid: input.recipientUserUuid,
    actorUserUuid: input.actorUserUuid,
    actorName: input.actorName,
    mode: "cash",
    cashOfferCents: input.priceCents,
    barterListingIds: [],
    quantity: input.quantity,
    note: input.message,
    pushEvents: { offerMadeAt: now },
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<OfferNotification>("notifications").insertOne(doc);
  const push = await sendPushNotificationToUserUuid(input.recipientUserUuid, {
    title: "New Sunpatch offer",
    body: `${input.actorName} sent an offer for ${input.itemName}.`,
    data: { notificationId: doc._id.toString(), offerId: input.offerId, type: "social_offer" },
  });

  return {
    notification: toOfferNotificationView(doc),
    sent: push.sent,
  };
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
    channelId: "default",
    priority: "high",
    data: {
      type: "social_offer",
      offerId,
    },
  }) satisfies ExpoPushMessage);
  const result = await sendExpoPushMessages(messages);
  await pruneInvalidPushTokens(result.invalidTokens);

  return { sent: result.sent };
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
    db.collection<OfferNotification>("notifications").createIndex({ socialOfferId: 1, createdAt: -1 }),
  ]);
}

async function sendPushNotificationToUserUuid(
  userUuid: string,
  message: { title: string; body: string; data: Record<string, string> },
) {
  const db = await getMongoDb();
  const recipient = await db.collection<User>("users").findOne({ uuid: userUuid });

  if (!recipient) {
    return { sent: 0 };
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
  const uniqueTokens = Array.from(new Set(tokens));

  if (!uniqueTokens.length) {
    return { sent: 0 };
  }

  const messages = uniqueTokens.map((to) => ({
    to,
    sound: "default",
    channelId: "default",
    priority: "high",
    ...message,
  }) satisfies ExpoPushMessage);
  const result = await sendExpoPushMessages(messages);
  await pruneInvalidPushTokens(result.invalidTokens);

  return { sent: result.sent };
}

async function sendExpoPushMessages(messages: ExpoPushMessage[]) {
  if (!messages.length) {
    return { sent: 0, invalidTokens: [] as string[] };
  }

  const response = await fetch(expoPushEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
  }).catch((error) => {
    console.warn("[notifications] Expo push request failed:", error);
    return null;
  });

  if (!response?.ok) {
    const status = response ? `${response.status} ${response.statusText}` : "network failure";
    const body = response ? await response.text().catch(() => "") : "";
    console.warn("[notifications] Expo push request rejected:", status, body.slice(0, 300));
    return { sent: 0, invalidTokens: [] as string[] };
  }

  const payload = await response.json().catch((error) => {
    console.warn("[notifications] Expo push response was not JSON:", error);
    return null;
  });
  const tickets: ExpoPushTicket[] = Array.isArray(payload?.data)
    ? payload.data
    : payload?.data
      ? [payload.data]
      : [];
  const invalidTokens: string[] = [];
  let sent = 0;

  tickets.forEach((ticket, index) => {
    if (ticket.status === "ok") {
      sent += 1;
      return;
    }

    const token = messages[index]?.to;
    if (token && ticket.details?.error === "DeviceNotRegistered") {
      invalidTokens.push(token);
    }

    console.warn("[notifications] Expo push ticket failed:", ticket.message ?? "Unknown Expo push error", ticket.details);
  });

  return { sent, invalidTokens };
}

async function pruneInvalidPushTokens(tokens: string[]) {
  const uniqueTokens = Array.from(new Set(tokens.filter(isLikelyExpoPushToken)));

  if (!uniqueTokens.length) {
    return;
  }

  const db = await getMongoDb();

  await Promise.all([
    db.collection<PushDeviceToken>("push_device_tokens").deleteMany({ token: { $in: uniqueTokens } }),
    db.collection<{ pushTokens?: string[] }>("users").updateMany(
      { pushTokens: { $in: uniqueTokens } },
      { $pull: { pushTokens: { $in: uniqueTokens } } },
    ),
  ]);
}

function toOfferNotificationView(doc: OfferNotification): OfferNotificationView {
  return {
    id: doc._id.toString(),
    type: "offer",
    status: doc.status,
    listingId: doc.listingId,
    source: doc.source,
    socialOfferId: doc.socialOfferId,
    offeringName: doc.offeringName,
    farmName: doc.farmName,
    recipientUserUuid: doc.recipientUserUuid,
    actorUserUuid: doc.actorUserUuid,
    actorName: doc.actorName,
    mode: doc.mode,
    cashOfferCents: doc.cashOfferCents,
    barterListingIds: doc.barterListingIds ?? [],
    quantity: doc.quantity,
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
