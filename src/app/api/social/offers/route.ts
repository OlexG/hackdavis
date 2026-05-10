import { NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { createSocialOffer, getSocialOffers, SocialOfferError } from "@/lib/social";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const box = url.searchParams.get("box") === "sent" ? "sent" : "inbox";
    const result = await getSocialOffers(box);

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load offers" },
      { status: error instanceof AuthenticationError ? 401 : 500, headers: corsHeaders },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = normalizeRequest(await request.json());
    const result = await createSocialOffer(body);

    return NextResponse.json(result, { status: 201, headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send offer" },
      {
        status: error instanceof AuthenticationError ? 401 : error instanceof SocialOfferError ? 400 : 500,
        headers: corsHeaders,
      },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function normalizeRequest(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    throw new SocialOfferError("Invalid offer request");
  }

  const value = raw as Record<string, unknown>;

  return {
    farmUserId: typeof value.farmUserId === "string" ? value.farmUserId : "",
    inventoryItemId: typeof value.inventoryItemId === "string" ? value.inventoryItemId : undefined,
    itemName: typeof value.itemName === "string" ? value.itemName : "",
    quantity: typeof value.quantity === "string" ? value.quantity : "",
    priceCents: typeof value.priceCents === "number" ? value.priceCents : undefined,
    message: typeof value.message === "string" ? value.message : "",
  };
}
