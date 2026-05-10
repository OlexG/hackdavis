import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";
import type { ShopOffering } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const currentUser = await getCurrentUser();
    const userUuid = url.searchParams.get("userUuid") ?? currentUser?.uuid;

    if (!userUuid) {
      return NextResponse.json({ offerings: [] });
    }

    const db = await getMongoDb();
    const offerings = await db
      .collection<ShopOffering>("shop_offerings")
      .find({ userUuid })
      .sort({ position: 1, updatedAt: -1 })
      .toArray();

    return NextResponse.json({
      offerings: offerings.map((offering) => ({
        id: offering.listingId,
        listingId: offering.listingId,
        name: offering.name,
        category: offering.category,
        amount: offering.amount,
        unit: offering.unit,
        priceCents: offering.priceCents,
        signText: offering.signText,
        visible: offering.visible,
        status: offering.visible ? "on shelf" : "back stock",
        updatedAt: offering.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load shop offerings" },
      { status: 500 },
    );
  }
}
