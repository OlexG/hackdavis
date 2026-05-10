import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { AuthenticationError, requireUserSession } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";
import { removeInventoryItemFromShop, syncInventoryItemToShop } from "@/lib/shop";
import type { InventoryCategory, InventoryItem, InventoryStatus } from "@/lib/models";

export const dynamic = "force-dynamic";

type InventoryItemRouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

const inventoryCategories = ["harvest", "seeds", "starts", "feed", "amendments", "tools", "preserves", "livestock"] as const;
const inventoryStatuses = ["stocked", "low", "ready", "curing"] as const;

type InventoryItemPatch = Partial<{
  name: string;
  category: InventoryCategory;
  status: InventoryStatus;
  quantity: {
    amount: number;
    unit: string;
  };
  reorderAt: number;
  location: string;
  source: string;
  notes: string;
  color: string;
}>;

export async function PATCH(request: Request, context: InventoryItemRouteContext) {
  try {
    const { itemId } = await context.params;

    if (!isObjectId(itemId)) {
      return NextResponse.json({ error: "Choose a valid inventory item" }, { status: 400 });
    }

    const patch = normalizePatch(await request.json());

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "Choose inventory changes to save" }, { status: 400 });
    }

    const { userId, uuid } = await requireUserSession();
    const db = await getMongoDb();
    const previousItem = await db.collection<InventoryItem>("inventory_items").findOne({ _id: new ObjectId(itemId), userId });

    if (!previousItem) {
      return NextResponse.json({ error: "Inventory item was not found" }, { status: 404 });
    }

    const saved = await db.collection<InventoryItem>("inventory_items").findOneAndUpdate(
      { _id: new ObjectId(itemId), userId },
      {
        $set: {
          ...patch,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );

    if (!saved) {
      return NextResponse.json({ error: "Inventory item was not found" }, { status: 404 });
    }

    await syncInventoryItemToShop({ item: saved, userUuid: uuid, previousItem });

    return NextResponse.json({ item: toInventoryViewItem(saved) });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to update inventory item") },
      { status: error instanceof AuthenticationError ? 401 : isRequestError(error) ? 400 : 500 },
    );
  }
}

export async function DELETE(_request: Request, context: InventoryItemRouteContext) {
  try {
    const { itemId } = await context.params;

    if (!isObjectId(itemId)) {
      return NextResponse.json({ error: "Choose a valid inventory item" }, { status: 400 });
    }

    const { userId } = await requireUserSession();
    const db = await getMongoDb();
    const result = await db
      .collection<InventoryItem>("inventory_items")
      .deleteOne({ _id: new ObjectId(itemId), userId });

    if (!result.deletedCount) {
      return NextResponse.json({ error: "Inventory item was not found" }, { status: 404 });
    }

    await removeInventoryItemFromShop({ userId, itemId: new ObjectId(itemId) });

    return NextResponse.json({ id: itemId });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to delete inventory item") },
      { status: error instanceof AuthenticationError ? 401 : 500 },
    );
  }
}

function normalizePatch(raw: unknown): InventoryItemPatch {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid inventory item update");
  }

  const value = raw as Record<string, unknown>;
  const patch: InventoryItemPatch = {};

  if ("name" in value) {
    const name = text(value.name, 80);
    if (!name) throw new Error("Inventory item needs a name");
    patch.name = name;
  }

  if ("category" in value) {
    patch.category = oneOf(value.category, inventoryCategories, "harvest");
  }

  if ("status" in value) {
    patch.status = oneOf(value.status, inventoryStatuses, "ready");
  }

  if ("quantity" in value) {
    const quantity = normalizeQuantity(value.quantity);
    if (!quantity) throw new Error("Inventory item needs a valid quantity");
    patch.quantity = quantity;
  }

  if ("reorderAt" in value) {
    const reorderAt = Number(value.reorderAt);
    if (Number.isFinite(reorderAt) && reorderAt >= 0) {
      patch.reorderAt = Math.round(reorderAt * 10) / 10;
    }
  }

  if ("location" in value) patch.location = text(value.location, 80);
  if ("source" in value) patch.source = text(value.source, 80);
  if ("notes" in value) patch.notes = text(value.notes, 220);
  if ("color" in value) patch.color = text(value.color, 24) || "#6f8f55";

  return patch;
}

function normalizeQuantity(raw: unknown): NonNullable<InventoryItemPatch["quantity"]> | null {
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

function isObjectId(value: string) {
  return ObjectId.isValid(value) && new ObjectId(value).toString() === value;
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
    error.message.includes("Invalid inventory item update") ||
    error.message.includes("Inventory item needs")
  );
}
