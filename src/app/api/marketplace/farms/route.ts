import { NextResponse } from "next/server";

import { getMarketplaceSnapshot } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getMarketplaceSnapshot();
    return NextResponse.json(snapshot, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load marketplace farms",
      },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
