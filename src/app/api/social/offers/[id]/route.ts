import { NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { acceptSocialOffer, SocialOfferError } from "@/lib/social";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action !== "accept") {
      throw new SocialOfferError("Unsupported offer action");
    }

    const { id } = await params;
    const offer = await acceptSocialOffer(id);

    return NextResponse.json({ offer }, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update offer" },
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
