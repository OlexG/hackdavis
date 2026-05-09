import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";
import type { InventoryItem } from "@/lib/models";

export const dynamic = "force-dynamic";

const demoUserEmail = "test@gmail.com";

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

    const { userId } = await getDemoUserContext();
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
      { status: 500 },
    );
  }
}

async function getDemoUserContext() {
  const db = await getMongoDb();
  const user = await db.collection("users").findOne({ email: demoUserEmail });

  if (!user) {
    throw new Error("Seed the demo user before deleting inventory items");
  }

  return { userId: user._id as ObjectId };
}

function isObjectId(value: string) {
  return ObjectId.isValid(value) && new ObjectId(value).toString() === value;
}

function formatApiError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
