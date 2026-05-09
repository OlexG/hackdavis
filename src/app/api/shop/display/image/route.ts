import { NextResponse } from "next/server";
import { ShopValidationError, uploadShopImage } from "@/lib/shop";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const inventoryItemId = formData.get("inventoryItemId");
    const file = formData.get("file");

    if (typeof inventoryItemId !== "string" || !inventoryItemId) {
      throw new ShopValidationError("Missing inventoryItemId");
    }
    if (!(file instanceof File)) {
      throw new ShopValidationError("Missing image file");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await uploadShopImage({
      inventoryItemId,
      fileName: file.name,
      mimeType: file.type,
      bytes,
    });

    return NextResponse.json(result);
  } catch (error) {
    const isClientError = error instanceof ShopValidationError;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to upload image" },
      { status: isClientError ? 400 : 500 },
    );
  }
}
