import { NextResponse } from "next/server";
import { getShopSnapshot, saveShopDisplaySlots, type ShopDisplaySaveSlot } from "@/lib/shop";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getShopSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to load shop display") },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const slots = normalizeRequest(await request.json());
    const snapshot = await saveShopDisplaySlots(slots);

    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to save shop display") },
      { status: isRequestError(error) ? 400 : 500 },
    );
  }
}

function normalizeRequest(raw: unknown): ShopDisplaySaveSlot[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid shop display request");
  }

  const candidate = raw as { slots?: unknown };

  if (!Array.isArray(candidate.slots)) {
    throw new Error("Choose at least one shop item");
  }

  return candidate.slots.map((slot) => {
    if (!slot || typeof slot !== "object") {
      throw new Error("Invalid shop item");
    }

    const value = slot as Record<string, unknown>;

    return {
      inventoryItemId: typeof value.inventoryItemId === "string" ? value.inventoryItemId : "",
      position: typeof value.position === "number" ? value.position : undefined,
      displayAmount: typeof value.displayAmount === "number" ? value.displayAmount : undefined,
      displayUnit: typeof value.displayUnit === "string" ? value.displayUnit : undefined,
      priceCents: typeof value.priceCents === "number" ? value.priceCents : undefined,
      signText: typeof value.signText === "string" ? value.signText : undefined,
      visible: typeof value.visible === "boolean" ? value.visible : undefined,
    };
  });
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
