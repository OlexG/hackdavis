import { NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { getSocialSnapshot } from "@/lib/social";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function GET() {
  try {
    const snapshot = await getSocialSnapshot();
    return NextResponse.json(snapshot, { headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load social farms" },
      { status: error instanceof AuthenticationError ? 401 : 500, headers: corsHeaders },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
