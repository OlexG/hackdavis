import { NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import {
  getShopSnapshot,
  saveShopDisplay,
  ShopValidationError,
  type ShopDisplaySaveDetails,
  type ShopDisplaySaveSlot,
} from "@/lib/shop";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getShopSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to load shop display") },
      { status: error instanceof AuthenticationError ? 401 : 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = normalizeRequest(await request.json());
    const snapshot = await saveShopDisplay(payload);

    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to save shop display") },
      { status: error instanceof AuthenticationError ? 401 : isRequestError(error) || error instanceof ShopValidationError ? 400 : 500 },
    );
  }
}

function normalizeRequest(raw: unknown): { slots: ShopDisplaySaveSlot[]; details?: ShopDisplaySaveDetails } {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid shop display request");
  }

  const candidate = raw as { slots?: unknown; details?: unknown };

  if (!Array.isArray(candidate.slots)) {
    throw new Error("Choose at least one shop item");
  }

  const details = normalizeDetails(candidate.details);
  const slots = candidate.slots.map((slot) => {
    if (!slot || typeof slot !== "object") {
      throw new Error("Invalid shop item");
    }

    const value = slot as Record<string, unknown>;

      return {
        inventoryItemId: typeof value.inventoryItemId === "string" ? value.inventoryItemId : "",
        listingId: typeof value.listingId === "string" ? value.listingId : undefined,
        position: typeof value.position === "number" ? value.position : undefined,
      displayAmount: typeof value.displayAmount === "number" ? value.displayAmount : undefined,
      displayUnit: typeof value.displayUnit === "string" ? value.displayUnit : undefined,
      priceCents: typeof value.priceCents === "number" ? value.priceCents : undefined,
      signText: typeof value.signText === "string" ? value.signText : undefined,
      visible: typeof value.visible === "boolean" ? value.visible : undefined,
      imageId:
        typeof value.imageId === "string"
          ? value.imageId
          : value.imageId === null
            ? null
            : undefined,
    };
  });

  return { slots, details };
}

function normalizeDetails(raw: unknown): ShopDisplaySaveDetails | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const value = raw as Record<string, unknown>;

  return {
    shopName: typeof value.shopName === "string" ? value.shopName : undefined,
    hours: typeof value.hours === "string" ? value.hours : undefined,
    hoursSchedule: normalizeHoursSchedulePayload(value.hoursSchedule),
    pickupLocation: typeof value.pickupLocation === "string" ? value.pickupLocation : undefined,
    pickupCoords: normalizePickupCoordsPayload(value.pickupCoords),
    pickupInstructions: typeof value.pickupInstructions === "string" ? value.pickupInstructions : undefined,
    paymentOptions: typeof value.paymentOptions === "string" ? value.paymentOptions : undefined,
    payment: normalizePaymentPayload(value.payment),
    contact: typeof value.contact === "string" ? value.contact : undefined,
    availabilityNote: typeof value.availabilityNote === "string" ? value.availabilityNote : undefined,
  };
}

function normalizeHoursSchedulePayload(raw: unknown): ShopDisplaySaveDetails["hoursSchedule"] {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const days = Array.isArray(value.days)
    ? value.days.filter((day): day is number => typeof day === "number")
    : [];
  return {
    days,
    openMinutes: typeof value.openMinutes === "number" ? value.openMinutes : 0,
    closeMinutes: typeof value.closeMinutes === "number" ? value.closeMinutes : 0,
    note: typeof value.note === "string" ? value.note : undefined,
  };
}

function normalizePickupCoordsPayload(raw: unknown): ShopDisplaySaveDetails["pickupCoords"] {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  if (typeof value.lat !== "number" || typeof value.lng !== "number") {
    return undefined;
  }
  return { lat: value.lat, lng: value.lng };
}

function normalizePaymentPayload(raw: unknown): ShopDisplaySaveDetails["payment"] {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const methods = (Array.isArray(value.methods) ? value.methods : [])
    .map((method) => {
      if (!method || typeof method !== "object") return null;
      const entry = method as Record<string, unknown>;
      if (typeof entry.kind !== "string") return null;
      return {
        kind: entry.kind,
        handle: typeof entry.handle === "string" ? entry.handle : undefined,
      };
    })
    .filter((entry) => entry !== null);
  return {
    methods,
    note: typeof value.note === "string" ? value.note : undefined,
  } as ShopDisplaySaveDetails["payment"];
}

function formatApiError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isRequestError(error: unknown) {
  return error instanceof Error && (
    error.message.includes("Invalid shop") ||
    error.message.includes("Choose at least") ||
    error.message.includes("only display produce-to-sell")
  );
}
