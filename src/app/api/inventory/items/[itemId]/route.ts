import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { AuthenticationError, requireUserSession } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";
import type { InventoryItem } from "@/lib/models";

export const dynamic = "force-dynamic";

type InventoryItemRouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

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

    return NextResponse.json({ id: itemId });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to delete inventory item") },
      { status: error instanceof AuthenticationError ? 401 : 500 },
    );
  }
}

function isObjectId(value: string) {
  return ObjectId.isValid(value) && new ObjectId(value).toString() === value;
}

function formatApiError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
