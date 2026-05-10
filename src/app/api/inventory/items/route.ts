import { NextResponse } from "next/server";
import { AuthenticationError, requireUserSession } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";
import type { InventoryCategory, InventoryItem, InventoryStatus } from "@/lib/models";

export const dynamic = "force-dynamic";

type InventoryItemPayload = {
  name: string;
  category: InventoryCategory;
  status: InventoryStatus;
  quantity: {
    amount: number;
    unit: string;
  };
  location: string;
  source: string;
  notes: string;
  color: string;
};

const inventoryCategories = ["harvest", "seeds", "starts", "feed", "amendments", "tools", "preserves", "livestock"] as const;
const inventoryStatuses = ["stocked", "low", "ready", "curing"] as const;

export async function POST(request: Request) {
  try {
    const payload = normalizePayload(await request.json());
    const { userId } = await requireUserSession();
    const db = await getMongoDb();
    const now = new Date();

    await db.collection("inventory_items").createIndex({ userId: 1, category: 1, status: 1 });
    await db.collection("inventory_items").createIndex({ userId: 1, name: 1 }, { unique: true });

    const saved = await db.collection<InventoryItem>("inventory_items").findOneAndUpdate(
      { userId, name: payload.name },
      {
        $set: {
          userId,
          ...payload,
          acquiredAt: now,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    if (!saved) {
      throw new Error("Unable to create inventory item");
    }

    return NextResponse.json({ item: toInventoryViewItem(saved) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to create inventory item") },
      { status: error instanceof AuthenticationError ? 401 : isRequestError(error) ? 400 : 500 },
    );
  }
}

function normalizePayload(raw: unknown): InventoryItemPayload {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid inventory item");
  }

  const value = raw as Record<string, unknown>;
  const quantity = normalizeQuantity(value.quantity);
  const name = text(value.name, 80);

  if (!name || !quantity) {
    throw new Error("Inventory item needs a name and quantity");
  }

  return {
    name,
    category: oneOf(value.category, inventoryCategories, "harvest"),
    status: oneOf(value.status, inventoryStatuses, "ready"),
    quantity,
    location: text(value.location, 80) || "harvest station",
    source: text(value.source, 80) || "yield forecast",
    notes: text(value.notes, 220),
    color: text(value.color, 24) || "#6f8f55",
  };
}

function normalizeQuantity(raw: unknown): InventoryItemPayload["quantity"] | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const value = raw as Record<string, unknown>;
  const amount = Number(value.amount);
  const unit = text(value.unit, 24) || "each";

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return {
    amount: Math.round(amount * 10) / 10,
    unit,
  };
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return allowed.includes(value as T[number]) ? (value as T[number]) : fallback;
}

function toInventoryViewItem(item: InventoryItem) {
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

function formatApiError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isRequestError(error: unknown) {
  return error instanceof Error && (
    error.message.includes("Invalid inventory item") ||
    error.message.includes("Inventory item needs")
  );
}
