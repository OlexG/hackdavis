import "server-only";

import { randomUUID } from "node:crypto";
import { GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "node:stream";
import { AuthenticationError, requireUserSession } from "@/lib/auth";
import { getInventorySnapshot, type InventoryViewItem } from "@/lib/inventory";
import { getMongoDb } from "@/lib/mongodb";
import type {
  InventoryItem,
  Farm,
  ShopDisplay,
  ShopDisplayDetails,
  ShopDisplaySlot,
  ShopOffering,
  ShopHoursSchedule,
  ShopPaymentDetails,
  ShopPaymentMethod,
  ShopPaymentMethodKind,
  ShopPickupCoords,
} from "@/lib/models";

const sellableCategories = ["harvest", "preserves"] as const;
const shopImagesBucket = "shop_images";
const maxImageBytes = 4 * 1024 * 1024;
const allowedImageMimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
type ShopDetailStringKey =
  | "shopName"
  | "hours"
  | "pickupLocation"
  | "pickupInstructions"
  | "paymentOptions"
  | "contact"
  | "availabilityNote";

const detailLimits = {
  shopName: 60,
  hours: 80,
  pickupLocation: 80,
  pickupInstructions: 160,
  paymentOptions: 120,
  contact: 100,
  availabilityNote: 160,
} satisfies Record<ShopDetailStringKey, number>;

export type ShopDisplaySlotView = {
  id: string;
  inventoryItemId: string;
  listingId: string;
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
  isPublished: boolean;
  theme: ShopDisplay["theme"];
  layoutMode: ShopDisplay["layoutMode"];
  details: ShopDisplayDetails;
  sellableItems: InventoryViewItem[];
  slots: ShopDisplaySlotView[];
  lastUpdated: string;
};

export type ShopDisplaySaveDetails = Partial<{
  shopName: string;
  hours: string;
  hoursSchedule: ShopHoursSchedule | null;
  pickupLocation: string;
  pickupCoords: ShopPickupCoords | null;
  pickupInstructions: string;
  paymentOptions: string;
  payment: ShopPaymentDetails | null;
  contact: string;
  availabilityNote: string;
}>;

const paymentMethodKinds: readonly ShopPaymentMethodKind[] = [
  "venmo",
  "cashapp",
  "zelle",
  "paypal",
  "cash",
  "card",
  "check",
  "trade",
];

const paymentMethodLabels: Record<ShopPaymentMethodKind, string> = {
  venmo: "Venmo",
  cashapp: "Cash App",
  zelle: "Zelle",
  paypal: "PayPal",
  cash: "Cash",
  card: "Card",
  check: "Check",
  trade: "Trade",
};

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type ShopDisplaySavePayload = {
  slots: ShopDisplaySaveSlot[];
  details?: ShopDisplaySaveDetails;
};

export type ShopDisplaySaveSlot = {
  inventoryItemId: string;
  listingId?: string;
  position?: number;
  displayAmount?: number;
  displayUnit?: string;
  priceCents?: number;
  signText?: string;
  visible?: boolean;
  imageId?: string | null;
};

type InventoryShopSyncInput = {
  item: InventoryItem;
  userUuid: string;
  previousItem?: InventoryItem | null;
};

type InventoryShopRemovalInput = {
  userId: ObjectId;
  itemId: ObjectId;
};

export async function getShopSnapshot(): Promise<ShopSnapshot> {
  try {
    const db = await getMongoDb();
    const currentUser = await requireUserSession();

    const [profile, inventoryItems, display] = await Promise.all([
      db.collection("profiles").findOne({ userId: currentUser.userId }),
      db
        .collection<InventoryItem>("inventory_items")
        .find({ userId: currentUser.userId, category: { $in: [...sellableCategories] } })
        .sort({ category: 1, status: 1, name: 1 })
        .toArray(),
      db.collection<ShopDisplay>("shop_displays").findOne({ userId: currentUser.userId }),
    ]);

    const sellableItems = inventoryItems.map(toInventoryViewItem);
    const offerings = await ensureShopOfferingsForItems({
      inventoryItems,
      display,
      userId: currentUser.userId,
      userUuid: currentUser.uuid,
    });

    const displayName = typeof profile?.displayName === "string" ? profile.displayName : currentUser.displayName;
    return {
      userEmail: currentUser.email,
      displayName,
      isPublished: Boolean(display),
      theme: "farm-stand",
      layoutMode: "shelves",
      details: normalizeDetails(display?.details, displayName),
      sellableItems,
      slots: buildShopSlots(sellableItems, display?.slots, offerings),
      lastUpdated: newestTimestamp(sellableItems, display?.updatedAt),
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return getFallbackShopSnapshot();
  }
}

export async function saveShopDisplay({ slots, details }: ShopDisplaySavePayload) {
  const db = await getMongoDb();
  const currentUser = await requireUserSession();

  const sellableItems = await db
    .collection<InventoryItem>("inventory_items")
    .find({ userId: currentUser.userId, category: { $in: [...sellableCategories] } })
    .toArray();
  const sellableById = new Map(sellableItems.map((item) => [item._id.toString(), item]));
  const invalidSlot = slots.find((slot) => !sellableById.has(slot.inventoryItemId));

  if (invalidSlot) {
    throw new Error("Shop can only display produce-to-sell inventory items");
  }

  const normalizedSlots = slots
    .map((slot, index) => normalizeSaveSlot(slot, index, sellableById))
    .filter(isShopDisplaySlot);
  const profile = await db.collection("profiles").findOne({ userId: currentUser.userId });
  const displayName = typeof profile?.displayName === "string" ? profile.displayName : currentUser.displayName;
  const normalizedDetails = normalizeDetails(details, displayName);
  const now = new Date();
  await syncShopOfferings({
    userId: currentUser.userId,
    userUuid: currentUser.uuid,
    slots: normalizedSlots,
    sellableById,
    now,
  });

  await db.collection("shop_displays").createIndex({ userId: 1 }, { unique: true });
  await db.collection<ShopDisplay>("shop_displays").findOneAndUpdate(
    { userId: currentUser.userId },
    {
      $set: {
        userId: currentUser.userId,
        theme: "farm-stand",
        layoutMode: "shelves",
        details: normalizedDetails,
        slots: normalizedSlots,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  // Ensure a farms document exists so this shop appears in the marketplace.
  await ensureFarmForUser({
    userId: currentUser.userId,
    userUuid: currentUser.uuid,
    displayName,
    details: normalizedDetails,
    now,
  });

  return getShopSnapshot();
}

export async function syncInventoryItemToShop({ item, userUuid, previousItem }: InventoryShopSyncInput) {
  const db = await getMongoDb();
  const now = new Date();
  const itemId = item._id;
  const display = await db.collection<ShopDisplay>("shop_displays").findOne({ userId: item.userId });
  const displaySlot = display?.slots.find((slot) => slot.inventoryItemId.equals(itemId));
  const offerings = db.collection<ShopOffering>("shop_offerings");

  await Promise.all([
    offerings.createIndex({ listingId: 1 }, { unique: true }),
    offerings.createIndex({ userUuid: 1, position: 1 }),
    offerings.createIndex({ userId: 1, inventoryItemId: 1 }, { unique: true }),
  ]);

  if (!isSellableInventoryItem(toInventoryViewItem(item))) {
    await Promise.all([
      offerings.updateOne(
        { userId: item.userId, inventoryItemId: itemId },
        {
          $set: {
            name: item.name,
            category: item.category,
            amount: item.quantity.amount,
            unit: item.quantity.unit,
            visible: false,
            updatedAt: now,
          },
        },
      ),
      db.collection<ShopDisplay>("shop_displays").updateOne(
        { userId: item.userId },
        {
          $pull: { slots: { inventoryItemId: itemId } },
          $set: { updatedAt: now },
        },
      ),
    ]);
    return;
  }

  const existingOffering = await offerings.findOne({ userId: item.userId, inventoryItemId: itemId });
  const existingAmount = displaySlot?.displayAmount ?? existingOffering?.amount;
  const existingUnit = displaySlot?.displayUnit ?? existingOffering?.unit;
  const amount = syncedDisplayAmount(existingAmount, item, previousItem);
  const unit = syncedDisplayUnit(existingUnit, item, previousItem);
  const listingId = normalizeListingId(displaySlot?.listingId ?? existingOffering?.listingId) ?? randomUUID();
  const visible = displaySlot?.visible ?? existingOffering?.visible ?? true;
  const viewItem = toInventoryViewItem(item);

  await offerings.updateOne(
    { userId: item.userId, inventoryItemId: itemId },
    {
      $set: {
        listingId,
        userId: item.userId,
        userUuid,
        inventoryItemId: itemId,
        name: item.name,
        category: item.category,
        amount,
        unit,
        priceCents: existingOffering?.priceCents ?? displaySlot?.priceCents ?? suggestedPriceCents(viewItem),
        signText: existingOffering?.signText ?? displaySlot?.signText ?? suggestedSignText(viewItem),
        visible,
        position: displaySlot?.position ?? existingOffering?.position ?? 0,
        ...(displaySlot?.imageId ?? existingOffering?.imageId ? { imageId: displaySlot?.imageId ?? existingOffering?.imageId } : {}),
        ...(displaySlot?.imageMimeType ?? existingOffering?.imageMimeType
          ? { imageMimeType: displaySlot?.imageMimeType ?? existingOffering?.imageMimeType }
          : {}),
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        createdAt: now,
      },
    },
    { upsert: true },
  );

  if (displaySlot) {
    await db.collection<ShopDisplay>("shop_displays").updateOne(
      { userId: item.userId, "slots.inventoryItemId": itemId },
      {
        $set: {
          "slots.$.displayAmount": amount,
          "slots.$.displayUnit": unit,
          updatedAt: now,
        },
      },
    );
  }
}

export async function removeInventoryItemFromShop({ userId, itemId }: InventoryShopRemovalInput) {
  const db = await getMongoDb();
  const now = new Date();

  await Promise.all([
    db.collection<ShopOffering>("shop_offerings").deleteOne({ userId, inventoryItemId: itemId }),
    db.collection<ShopDisplay>("shop_displays").updateOne(
      { userId },
      {
        $pull: { slots: { inventoryItemId: itemId } },
        $set: { updatedAt: now },
      },
    ),
  ]);
}

async function getFallbackShopSnapshot() {
  const inventory = await getInventorySnapshot();
  const sellableItems = inventory.items.filter(isSellableInventoryItem);

  return {
    userEmail: inventory.userEmail,
    displayName: inventory.displayName,
    isPublished: false,
    theme: "farm-stand" as const,
    layoutMode: "shelves" as const,
    details: normalizeDetails(undefined, inventory.displayName),
    sellableItems,
    slots: buildShopSlots(sellableItems),
    lastUpdated: inventory.lastUpdated,
  };
}

function buildShopSlots(
  items: InventoryViewItem[],
  savedSlots: ShopDisplaySlot[] = [],
  offerings: ShopOffering[] = [],
) {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const offeringByItemId = new Map(offerings.map((offering) => [offering.inventoryItemId.toString(), offering]));
  const seen = new Set<string>();
  const slots: ShopDisplaySlotView[] = [];

  for (const savedSlot of savedSlots.sort((left, right) => left.position - right.position)) {
    const item = itemById.get(savedSlot.inventoryItemId.toString());
    const offering = offeringByItemId.get(savedSlot.inventoryItemId.toString());

    if (!item || seen.has(item.id)) {
      continue;
    }

    seen.add(item.id);
    slots.push(toShopSlotView(item, offering ?? savedSlot, slots.length));
  }

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }

    slots.push(toShopSlotView(item, offeringByItemId.get(item.id), slots.length));
  }

  return slots.map((slot, index) => ({ ...slot, position: index }));
}

function toShopSlotView(item: InventoryViewItem, savedSlot: (ShopDisplaySlot | ShopOffering) | undefined, position: number) {
  const imageId = savedSlot?.imageId?.toString();
  const displayAmount = savedSlot
    ? "displayAmount" in savedSlot
      ? savedSlot.displayAmount
      : savedSlot.amount
    : item.quantity.amount;
  const displayUnit = savedSlot
    ? "displayUnit" in savedSlot
      ? savedSlot.displayUnit
      : savedSlot.unit
    : item.quantity.unit;

  return {
    id: `slot-${item.id}`,
    inventoryItemId: item.id,
    listingId: savedSlot?.listingId ?? randomUUID(),
    position,
    displayAmount: clampAmount(displayAmount, item.quantity.amount),
    displayUnit: displayUnit || item.quantity.unit,
    priceCents: normalizePrice(savedSlot?.priceCents ?? suggestedPriceCents(item)),
    signText: savedSlot?.signText?.trim() || suggestedSignText(item),
    visible: savedSlot?.visible ?? true,
    imageId,
    imageUrl: imageId ? `/api/shop/image/${imageId}` : undefined,
    item,
  };
}

function normalizeDetails(details: ShopDisplaySaveDetails | undefined, displayName: string): ShopDisplayDetails {
  const hoursSchedule = normalizeHoursSchedule(details?.hoursSchedule);
  const payment = normalizePayment(details?.payment);
  const pickupCoords = normalizePickupCoords(details?.pickupCoords);

  const derivedHours = hoursSchedule ? formatHoursLabel(hoursSchedule) : "";
  const derivedPayment = payment ? formatPaymentLabel(payment) : "";

  return {
    shopName: normalizeDetailField(details?.shopName, detailLimits.shopName, displayName),
    hours: normalizeDetailField(
      details?.hours,
      detailLimits.hours,
      derivedHours,
    ) || derivedHours,
    ...(hoursSchedule ? { hoursSchedule } : {}),
    pickupLocation: normalizeDetailField(details?.pickupLocation, detailLimits.pickupLocation),
    ...(pickupCoords ? { pickupCoords } : {}),
    pickupInstructions: normalizeDetailField(details?.pickupInstructions, detailLimits.pickupInstructions),
    paymentOptions: normalizeDetailField(
      details?.paymentOptions,
      detailLimits.paymentOptions,
      derivedPayment,
    ) || derivedPayment,
    ...(payment ? { payment } : {}),
    contact: normalizeDetailField(details?.contact, detailLimits.contact),
    availabilityNote: normalizeDetailField(details?.availabilityNote, detailLimits.availabilityNote),
  };
}

function normalizeHoursSchedule(value: ShopHoursSchedule | null | undefined): ShopHoursSchedule | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const days = Array.isArray(value.days)
    ? Array.from(
        new Set(
          value.days
            .map((day) => Math.trunc(Number(day)))
            .filter((day) => Number.isFinite(day) && day >= 0 && day <= 6),
        ),
      ).sort((left, right) => left - right)
    : [];

  const openMinutes = clampMinutes(value.openMinutes);
  const closeMinutes = clampMinutes(value.closeMinutes);

  if (!days.length) {
    return undefined;
  }

  const note = typeof value.note === "string"
    ? value.note.replace(/\s+/g, " ").trim().slice(0, 80)
    : undefined;

  return {
    days,
    openMinutes,
    closeMinutes,
    ...(note ? { note } : {}),
  };
}

function normalizePayment(value: ShopPaymentDetails | null | undefined): ShopPaymentDetails | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const seen = new Set<ShopPaymentMethodKind>();
  const methods: ShopPaymentMethod[] = [];

  if (Array.isArray(value.methods)) {
    for (const method of value.methods) {
      if (!method || typeof method !== "object") continue;
      const kind = paymentMethodKinds.includes(method.kind) ? method.kind : null;
      if (!kind || seen.has(kind)) continue;
      seen.add(kind);
      const handle = typeof method.handle === "string"
        ? method.handle.replace(/\s+/g, " ").trim().slice(0, 40)
        : "";
      methods.push(handle ? { kind, handle } : { kind });
    }
  }

  const note = typeof value.note === "string"
    ? value.note.replace(/\s+/g, " ").trim().slice(0, 120)
    : "";

  if (!methods.length && !note) {
    return undefined;
  }

  return {
    methods,
    ...(note ? { note } : {}),
  };
}

function normalizePickupCoords(value: ShopPickupCoords | null | undefined): ShopPickupCoords | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return undefined;
  }
  return {
    lat: Math.round(lat * 1_000_000) / 1_000_000,
    lng: Math.round(lng * 1_000_000) / 1_000_000,
  };
}

function clampMinutes(value: unknown) {
  const minutes = Math.trunc(Number(value));
  if (!Number.isFinite(minutes)) return 0;
  return Math.max(0, Math.min(24 * 60 - 1, minutes));
}

export function formatHoursLabel(schedule: ShopHoursSchedule): string {
  const dayLabel = formatDayList(schedule.days);
  if (!dayLabel) {
    return schedule.note ?? "";
  }
  if (schedule.openMinutes === schedule.closeMinutes) {
    return schedule.note ? `${dayLabel} · ${schedule.note}` : dayLabel;
  }
  const range = `${formatTime(schedule.openMinutes)} – ${formatTime(schedule.closeMinutes)}`;
  return schedule.note ? `${dayLabel} · ${range} · ${schedule.note}` : `${dayLabel} · ${range}`;
}

function formatDayList(days: number[]): string {
  if (!days.length) return "";
  const sorted = [...days].sort((left, right) => left - right);
  if (sorted.length === 7) return "Every day";
  // Detect contiguous run.
  const isContiguous = sorted.every((day, index) => index === 0 || day - sorted[index - 1] === 1);
  if (isContiguous && sorted.length >= 3) {
    return `${dayLabels[sorted[0]]}–${dayLabels[sorted[sorted.length - 1]]}`;
  }
  if (sorted.length === 2) {
    return `${dayLabels[sorted[0]]} & ${dayLabels[sorted[1]]}`;
  }
  return sorted.map((day) => dayLabels[day]).join(", ");
}

function formatTime(minutes: number) {
  const total = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  const period = hours >= 12 ? "PM" : "AM";
  const display = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${display}:${mins.toString().padStart(2, "0")} ${period}`;
}

export function formatPaymentLabel(payment: ShopPaymentDetails): string {
  const labels = payment.methods.map((method) => {
    const base = paymentMethodLabels[method.kind];
    return method.handle ? `${base} (${method.handle})` : base;
  });
  if (!labels.length) {
    return payment.note ?? "";
  }
  return payment.note ? `${labels.join(", ")} · ${payment.note}` : labels.join(", ");
}

export const shopPaymentMethodKinds = paymentMethodKinds;
export const shopPaymentMethodLabels = paymentMethodLabels;
export const shopDayLabels = dayLabels;

function normalizeDetailField(value: unknown, limit: number, fallback = "") {
  if (typeof value !== "string") {
    return fallback.slice(0, limit);
  }

  return value.replace(/\s+/g, " ").trim().slice(0, limit);
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
  const listingId = normalizeListingId(slot.listingId) ?? randomUUID();
  const visible = slot.visible ?? false;

  return {
    inventoryItemId: new ObjectId(slot.inventoryItemId),
    listingId,
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

async function ensureShopOfferingsForItems({
  inventoryItems,
  display,
  userId,
  userUuid,
}: {
  inventoryItems: InventoryItem[];
  display: ShopDisplay | null;
  userId: ObjectId;
  userUuid: string;
}) {
  const db = await getMongoDb();
  const now = new Date();
  const offerings = db.collection<ShopOffering>("shop_offerings");

  await Promise.all([
    offerings.createIndex({ listingId: 1 }, { unique: true }),
    offerings.createIndex({ userUuid: 1, position: 1 }),
    offerings.createIndex({ userId: 1, inventoryItemId: 1 }, { unique: true }),
  ]);

  const existing = await offerings
    .find({ userId, inventoryItemId: { $in: inventoryItems.map((item) => item._id) } })
    .toArray();
  const existingByItemId = new Map(existing.map((offering) => [offering.inventoryItemId.toString(), offering]));
  const displayByItemId = new Map((display?.slots ?? []).map((slot) => [slot.inventoryItemId.toString(), slot]));

  for (const [index, item] of inventoryItems.entries()) {
    const existingOffering = existingByItemId.get(item._id.toString());
    const displaySlot = displayByItemId.get(item._id.toString());

    if (existingOffering) {
      if (existingOffering.userUuid !== userUuid) {
        await offerings.updateOne(
          { _id: existingOffering._id },
          { $set: { userUuid, updatedAt: now } },
        );
      }
      continue;
    }

    const listingId = normalizeListingId(displaySlot?.listingId) ?? randomUUID();
    await offerings.insertOne({
      _id: new ObjectId(),
      listingId,
      userId,
      userUuid,
      inventoryItemId: item._id,
      name: item.name,
      category: item.category,
      amount: clampAmount(displaySlot?.displayAmount ?? item.quantity.amount, item.quantity.amount),
      unit: displaySlot?.displayUnit || item.quantity.unit,
      priceCents: normalizePrice(displaySlot?.priceCents ?? suggestedPriceCents(toInventoryViewItem(item))),
      signText: displaySlot?.signText || suggestedSignText(toInventoryViewItem(item)),
      visible: displaySlot?.visible ?? true,
      position: displaySlot?.position ?? index,
      ...(displaySlot?.imageId ? { imageId: displaySlot.imageId } : {}),
      ...(displaySlot?.imageMimeType ? { imageMimeType: displaySlot.imageMimeType } : {}),
      createdAt: now,
      updatedAt: now,
    });
  }

  return offerings
    .find({ userId, inventoryItemId: { $in: inventoryItems.map((item) => item._id) } })
    .sort({ position: 1, updatedAt: -1 })
    .toArray();
}

async function syncShopOfferings({
  userId,
  userUuid,
  slots,
  sellableById,
  now,
}: {
  userId: ObjectId;
  userUuid: string;
  slots: ShopDisplaySlot[];
  sellableById: Map<string, InventoryItem>;
  now: Date;
}) {
  const db = await getMongoDb();
  const offerings = db.collection<ShopOffering>("shop_offerings");

  await Promise.all([
    offerings.createIndex({ listingId: 1 }, { unique: true }),
    offerings.createIndex({ userUuid: 1, position: 1 }),
    offerings.createIndex({ userId: 1, inventoryItemId: 1 }, { unique: true }),
  ]);

  await Promise.all(slots.map((slot) => {
    const item = sellableById.get(slot.inventoryItemId.toString());
    if (!item) {
      return Promise.resolve();
    }

    return offerings.updateOne(
      { userId, inventoryItemId: item._id },
      {
        $set: {
          listingId: slot.listingId,
          userId,
          userUuid,
          inventoryItemId: item._id,
          name: item.name,
          category: item.category,
          amount: slot.displayAmount,
          unit: slot.displayUnit,
          priceCents: slot.priceCents,
          signText: slot.signText,
          visible: slot.visible,
          position: slot.position,
          ...(slot.imageId ? { imageId: slot.imageId } : {}),
          updatedAt: now,
        },
        $setOnInsert: {
          _id: new ObjectId(),
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }));
}

function normalizeListingId(value: unknown) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 80)
    : null;
}

function clampAmount(value: number, available: number) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return Math.max(0, Math.min(available, 1));
  }

  return Math.round(Math.min(amount, available) * 10) / 10;
}

function syncedDisplayAmount(value: number | undefined, item: InventoryItem, previousItem?: InventoryItem | null) {
  if (value === undefined || shouldMirrorPreviousAmount(value, previousItem)) {
    return clampAmount(item.quantity.amount, item.quantity.amount);
  }

  return clampAmount(value, item.quantity.amount);
}

function shouldMirrorPreviousAmount(value: number, previousItem?: InventoryItem | null) {
  if (!previousItem) {
    return false;
  }

  return Math.abs(Number(value) - previousItem.quantity.amount) < 0.01;
}

function syncedDisplayUnit(value: string | undefined, item: InventoryItem, previousItem?: InventoryItem | null) {
  const normalized = typeof value === "string" ? value.trim().slice(0, 24) : "";

  if (!normalized || normalized === previousItem?.quantity.unit) {
    return item.quantity.unit;
  }

  return normalized;
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
  listingId: string;
  contentType: string;
  size: number;
};

export async function uploadShopImage({
  inventoryItemId,
  listingId,
  fileName,
  mimeType,
  bytes,
}: {
  inventoryItemId: string;
  listingId?: string;
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
  const currentUser = await requireUserSession();

  const item = await db
    .collection<InventoryItem>("inventory_items")
    .findOne({ _id: new ObjectId(inventoryItemId), userId: currentUser.userId });

  if (!item) {
    throw new ShopValidationError("Inventory item not found for current user");
  }

  const now = new Date();
  const normalizedListingId = normalizeListingId(listingId) ?? randomUUID();
  await db.collection<ShopOffering>("shop_offerings").updateOne(
    { userId: currentUser.userId, inventoryItemId: item._id },
    {
      $set: {
        listingId: normalizedListingId,
        userId: currentUser.userId,
        userUuid: currentUser.uuid,
        inventoryItemId: item._id,
        name: item.name,
        category: item.category,
        amount: item.quantity.amount,
        unit: item.quantity.unit,
        visible: true,
        updatedAt: now,
      },
      $setOnInsert: {
        _id: new ObjectId(),
        priceCents: suggestedPriceCents(toInventoryViewItem(item)),
        signText: suggestedSignText(toInventoryViewItem(item)),
        position: 0,
        createdAt: now,
      },
    },
    { upsert: true },
  );

  const bucket = new GridFSBucket(db, { bucketName: shopImagesBucket });
  const uploadStream = bucket.openUploadStream(fileName || "shop-image", {
    metadata: {
      userId: currentUser.userId,
      userUuid: currentUser.uuid,
      listingId: normalizedListingId,
      inventoryItemId: item._id,
      contentType: mimeType,
      uploadedAt: now,
    },
  });

  await new Promise<void>((resolve, reject) => {
    uploadStream.on("error", reject);
    uploadStream.on("finish", () => resolve());
    Readable.from(Buffer.from(bytes)).pipe(uploadStream);
  });

  const imageId = uploadStream.id.toString();
  await Promise.all([
    db.collection(`${shopImagesBucket}.files`).updateOne(
      { _id: uploadStream.id },
      { $set: { listingId: normalizedListingId, "metadata.listingId": normalizedListingId } },
    ),
    db.collection(`${shopImagesBucket}.chunks`).updateMany(
      { files_id: uploadStream.id },
      { $set: { listingId: normalizedListingId } },
    ),
    db.collection<ShopOffering>("shop_offerings").updateOne(
      { userId: currentUser.userId, inventoryItemId: item._id },
      {
        $set: {
          imageId: uploadStream.id,
          imageMimeType: mimeType,
          updatedAt: new Date(),
        },
      },
    ),
    db.collection<ShopDisplay>("shop_displays").updateOne(
      { userId: currentUser.userId, "slots.inventoryItemId": item._id },
      {
        $set: {
          "slots.$.listingId": normalizedListingId,
          "slots.$.imageId": uploadStream.id,
          "slots.$.imageMimeType": mimeType,
          updatedAt: new Date(),
        },
      },
    ),
  ]);

  return {
    imageId,
    imageUrl: `/api/shop/image/${imageId}`,
    listingId: normalizedListingId,
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
  const currentUser = await requireUserSession();
  const objectId = new ObjectId(imageId);
  const bucket = new GridFSBucket(db, { bucketName: shopImagesBucket });
  const file = await db
    .collection<{ _id: ObjectId; length: number; metadata?: { contentType?: string; userId?: ObjectId } }>(`${shopImagesBucket}.files`)
    .findOne({ _id: objectId });

  if (!file) {
    return null;
  }

  const ownsImage = file.metadata?.userId?.equals(currentUser.userId);

  if (!ownsImage) {
    const publicDisplay = await db.collection<ShopDisplay>("shop_displays").findOne({
      slots: { $elemMatch: { imageId: objectId, visible: true } },
    });

    if (!publicDisplay) {
      return null;
    }
  }

  return {
    stream: bucket.openDownloadStream(objectId),
    contentType: file.metadata?.contentType ?? "application/octet-stream",
    contentLength: file.length,
  };
}


async function ensureFarmForUser({
  userId,
  userUuid,
  displayName,
  details,
  now,
}: {
  userId: ObjectId;
  userUuid: string;
  displayName: string;
  details: ShopDisplayDetails;
  now: Date;
}) {
  const db = await getMongoDb();

  const shopName = details.shopName || displayName;
  const pickupCoords = details.pickupCoords;

  // Build location from pickup coordinates if available, otherwise use a
  // default so the farm appears in marketplace queries that filter on location.
  const defaultCoords = { lat: 38.5449, lng: -121.7405 }; // Davis, CA center
  const coords = pickupCoords ?? defaultCoords;
  const location = { type: "Point" as const, coordinates: [coords.lng, coords.lat] as [number, number] };
  const coordinates = { latitude: coords.lat, longitude: coords.lng, x: 50, y: 50 };

  const updateFields: Record<string, unknown> = {
    userId,
    userUuid,
    name: shopName,
    location,
    coordinates,
    units: "feet" as const,
    bounds: { width: 100, height: 100 },
    updatedAt: now,
  };

  if (details.pickupLocation) {
    updateFields.neighborhood = details.pickupLocation;
  }

  if (details.hours) {
    updateFields.response = details.hours;
  }

  // Use userUuid + isShopFarm flag to find/create the shop-specific farm doc.
  // Users may have other farm docs from the farm planner, so we don't use a
  // unique index on userId.
  await db.collection<Farm>("farms").updateOne(
    { userUuid, isShopFarm: true },
    {
      $set: updateFields,
      $setOnInsert: {
        _id: new ObjectId(),
        slug: `shop-${userUuid}`,
        isShopFarm: true,
        rating: 5,
        reviews: 0,
        ratings: { quality: 5, fairness: 5, pickup: 5 },
        sortOrder: 100,
        createdAt: now,
      },
    },
    { upsert: true },
  );
}
