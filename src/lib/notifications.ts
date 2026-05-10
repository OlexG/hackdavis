import "server-only";

import { ObjectId } from "mongodb";
import { requireUserSession } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";
import type { PushDeviceToken } from "@/lib/models";

const expoPushEndpoint = "https://exp.host/--/api/v2/push/send";

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
