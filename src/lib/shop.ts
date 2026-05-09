import "server-only";

import { GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "node:stream";
import { getInventorySnapshot, type InventoryViewItem } from "@/lib/inventory";
import { getMongoDb } from "@/lib/mongodb";
import type { InventoryItem, ShopDisplay, ShopDisplaySlot } from "@/lib/models";

const demoUserEmail = "test@gmail.com";
const sellableCategories = ["harvest", "preserves"] as const;
const shopImagesBucket = "shop_images";
const maxImageBytes = 4 * 1024 * 1024;
const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export type ShopDisplaySlotView = {
  id: string;
  inventoryItemId: string;
  position: number;
  displayAmount: number;
  displayUnit: string;
  priceCents: number;
  signText: string;
  visible: boolean;
  imageId?: string;
  imageUrl?: string;
  item: InventoryViewItem;
};

export type ShopSnapshot = {
  userEmail: string;
  displayName: string;
  theme: ShopDisplay["theme"];
  layoutMode: ShopDisplay["layoutMode"];
  sellableItems: InventoryViewItem[];
  slots: ShopDisplaySlotView[];
  lastUpdated: string;
};

export type ShopDisplaySaveSlot = {
  inventoryItemId: string;
  position?: number;
  displayAmount?: number;
  displayUnit?: string;
  priceCents?: number;
  signText?: string;
  visible?: boolean;
  imageId?: string | null;
};

export async function getShopSnapshot(): Promise<ShopSnapshot> {
  try {
    const db = await getMongoDb();
    const user = await db.collection("users").findOne({ email: demoUserEmail });

    if (!user) {
      return getFallbackShopSnapshot();
    }

    const [profile, inventoryItems, display] = await Promise.all([
      db.collection("profiles").findOne({ userId: user._id }),
      db
        .collection<InventoryItem>("inventory_items")
        .find({ userId: user._id, category: { $in: [...sellableCategories] } })
        .sort({ category: 1, status: 1, name: 1 })
        .toArray(),
      db.collection<ShopDisplay>("shop_displays").findOne({ userId: user._id }),
    ]);

    const sellableItems = inventoryItems.map(toInventoryViewItem);

    if (!sellableItems.length) {
      return getFallbackShopSnapshot();
    }

    return {
      userEmail: user.email,
      displayName: typeof profile?.displayName === "string" ? profile.displayName : "Test Farmer",
      theme: "farm-stand",
      layoutMode: "shelves",
      sellableItems,
      slots: buildShopSlots(sellableItems, display?.slots),
      lastUpdated: newestTimestamp(sellableItems, display?.updatedAt),
    };
  } catch {
    return getFallbackShopSnapshot();
  }
}

export async function saveShopDisplaySlots(slots: ShopDisplaySaveSlot[]) {
  const db = await getMongoDb();
  const user = await db.collection("users").findOne({ email: demoUserEmail });

  if (!user) {
    throw new Error("Seed the demo user before saving a shop display");
  }

  const sellableItems = await db
    .collection<InventoryItem>("inventory_items")
    .find({ userId: user._id, category: { $in: [...sellableCategories] } })
    .toArray();
  const sellableById = new Map(sellableItems.map((item) => [item._id.toString(), item]));
  const invalidSlot = slots.find((slot) => !sellableById.has(slot.inventoryItemId));

  if (invalidSlot) {
    throw new Error("Shop can only display produce-to-sell inventory items");
  }

  const normalizedSlots = slots
    .map((slot, index) => normalizeSaveSlot(slot, index, sellableById))
    .filter(isShopDisplaySlot);
  const now = new Date();

  await db.collection("shop_displays").createIndex({ userId: 1 }, { unique: true });
  await db.collection<ShopDisplay>("shop_displays").findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        userId: user._id,
        theme: "farm-stand",
        layoutMode: "shelves",
        slots: normalizedSlots,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  return getShopSnapshot();
}

async function getFallbackShopSnapshot() {
  const inventory = await getInventorySnapshot();
  const sellableItems = inventory.items.filter(isSellableInventoryItem);

  return {
    userEmail: inventory.userEmail,
    displayName: inventory.displayName,
    theme: "farm-stand" as const,
    layoutMode: "shelves" as const,
    sellableItems,
    slots: buildShopSlots(sellableItems),
    lastUpdated: inventory.lastUpdated,
  };
}

function buildShopSlots(items: InventoryViewItem[], savedSlots: ShopDisplaySlot[] = []) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const slots: ShopDisplaySlotView[] = [];

  for (const savedSlot of savedSlots.sort((left, right) => left.position - right.position)) {
    const item = itemById.get(savedSlot.inventoryItemId.toString());

    if (!item || seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    slots.push(toShopSlotView(item, savedSlot, slots.length));
  }

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }

    slots.push(toShopSlotView(item, undefined, slots.length));
  }

  return slots.map((slot, index) => ({ ...slot, position: index }));
}

function toShopSlotView(item: InventoryViewItem, savedSlot: ShopDisplaySlot | undefined, position: number) {
  const imageId = savedSlot?.imageId?.toString();

  return {
    id: `slot-${item.id}`,
    inventoryItemId: item.id,
    position,
    displayAmount: clampAmount(savedSlot?.displayAmount ?? item.quantity.amount, item.quantity.amount),
    displayUnit: savedSlot?.displayUnit || item.quantity.unit,
    priceCents: normalizePrice(savedSlot?.priceCents ?? suggestedPriceCents(item)),
    signText: savedSlot?.signText?.trim() || suggestedSignText(item),
    visible: savedSlot?.visible ?? false,
    imageId,
    imageUrl: imageId ? `/api/shop/image/${imageId}` : undefined,
    item,
  };
}

function normalizeSaveSlot(
  slot: ShopDisplaySaveSlot,
  index: number,
  sellableById: Map<string, InventoryItem>,
): ShopDisplaySlot | null {
  const item = sellableById.get(slot.inventoryItemId);

  if (!item || !ObjectId.isValid(slot.inventoryItemId)) {
    return null;
  }

  const imageId = typeof slot.imageId === "string" && ObjectId.isValid(slot.imageId)
    ? new ObjectId(slot.imageId)
    : undefined;
  const visible = slot.visible ?? false;

  if (visible && !imageId) {
    throw new ShopValidationError(
      `Add a photo for ${item.name} before placing it on the farm stand.`,
    );
  }

  return {
    inventoryItemId: new ObjectId(slot.inventoryItemId),
    position: Number.isFinite(slot.position) ? Number(slot.position) : index,
    displayAmount: clampAmount(slot.displayAmount ?? item.quantity.amount, item.quantity.amount),
    displayUnit: typeof slot.displayUnit === "string" && slot.displayUnit.trim()
      ? slot.displayUnit.trim().slice(0, 24)
      : item.quantity.unit,
    priceCents: normalizePrice(slot.priceCents ?? suggestedPriceCents(toInventoryViewItem(item))),
    signText: typeof slot.signText === "string" && slot.signText.trim()
      ? slot.signText.trim().slice(0, 60)
      : suggestedSignText(toInventoryViewItem(item)),
    visible,
    ...(imageId ? { imageId } : {}),
  };
}

export class ShopValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopValidationError";
  }
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

function isSellableInventoryItem(item: InventoryViewItem) {
  return sellableCategories.includes(item.category as (typeof sellableCategories)[number]);
}

function clampAmount(value: number, available: number) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return Math.max(0, Math.min(available, 1));
  }

  return Math.round(Math.min(amount, available) * 10) / 10;
}

function normalizePrice(value: number) {
  const price = Number(value);

  if (!Number.isFinite(price) || price < 0) {
    return 0;
  }

  return Math.round(price);
}

function suggestedPriceCents(item: InventoryViewItem) {
  const unit = item.quantity.unit.toLowerCase();
  const name = item.name.toLowerCase();

  if (unit.includes("lb")) {
    return name.includes("tomato") ? 550 : 450;
  }

  if (unit.includes("head")) {
    return 325;
  }

  if (unit.includes("jar")) {
    return 850;
  }

  return 400;
}

function suggestedSignText(item: InventoryViewItem) {
  const name = item.name.replace(/\s+/g, " ").trim();

  if (name.toLowerCase().includes("tomato")) {
    return "Sun-warmed and ready";
  }

  if (name.toLowerCase().includes("lettuce")) {
    return "Crisp morning harvest";
  }

  if (name.toLowerCase().includes("jam")) {
    return "Small-batch pantry jars";
  }

  return `Fresh ${name}`;
}

function newestTimestamp(items: InventoryViewItem[], displayUpdatedAt?: Date) {
  return [
    ...items.map((item) => item.updatedAt),
    displayUpdatedAt?.toISOString(),
  ]
    .filter(Boolean)
    .sort((left, right) => String(right).localeCompare(String(left)))[0] ?? new Date().toISOString();
}

function isShopDisplaySlot(slot: ShopDisplaySlot | null): slot is ShopDisplaySlot {
  return slot !== null;
}

export type UploadedShopImage = {
  imageId: string;
  imageUrl: string;
  contentType: string;
  size: number;
};

export async function uploadShopImage({
  inventoryItemId,
  fileName,
  mimeType,
  bytes,
}: {
  inventoryItemId: string;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<UploadedShopImage> {
  if (!ObjectId.isValid(inventoryItemId)) {
    throw new ShopValidationError("Unknown inventory item for shop image");
  }
  if (!allowedImageMimeTypes.has(mimeType)) {
    throw new ShopValidationError("Image must be PNG, JPEG, WEBP, or GIF");
  }
  if (bytes.byteLength === 0) {
    throw new ShopValidationError("Image file is empty");
  }
  if (bytes.byteLength > maxImageBytes) {
    throw new ShopValidationError("Image must be 4 MB or smaller");
  }

  const db = await getMongoDb();
  const user = await db.collection("users").findOne({ email: demoUserEmail });

  if (!user) {
    throw new Error("Seed the demo user before uploading shop images");
  }

  const item = await db
    .collection<InventoryItem>("inventory_items")
    .findOne({ _id: new ObjectId(inventoryItemId), userId: user._id });

  if (!item) {
    throw new ShopValidationError("Inventory item not found for current user");
  }

  const bucket = new GridFSBucket(db, { bucketName: shopImagesBucket });
  const uploadStream = bucket.openUploadStream(fileName || "shop-image", {
    metadata: {
      userId: user._id,
      inventoryItemId: item._id,
      contentType: mimeType,
      uploadedAt: new Date(),
    },
  });

  await new Promise<void>((resolve, reject) => {
    uploadStream.on("error", reject);
    uploadStream.on("finish", () => resolve());
    Readable.from(Buffer.from(bytes)).pipe(uploadStream);
  });

  const imageId = uploadStream.id.toString();
  return {
    imageId,
    imageUrl: `/api/shop/image/${imageId}`,
    contentType: mimeType,
    size: bytes.byteLength,
  };
}

export type ShopImageStream = {
  stream: NodeJS.ReadableStream;
  contentType: string;
  contentLength: number;
};

export async function openShopImageStream(imageId: string): Promise<ShopImageStream | null> {
  if (!ObjectId.isValid(imageId)) {
    return null;
  }

  const db = await getMongoDb();
  const bucket = new GridFSBucket(db, { bucketName: shopImagesBucket });
  const file = await db
    .collection<{ _id: ObjectId; length: number; metadata?: { contentType?: string } }>(`${shopImagesBucket}.files`)
    .findOne({ _id: new ObjectId(imageId) });

  if (!file) {
    return null;
  }

  return {
    stream: bucket.openDownloadStream(new ObjectId(imageId)),
    contentType: file.metadata?.contentType ?? "application/octet-stream",
    contentLength: file.length,
  };
}
