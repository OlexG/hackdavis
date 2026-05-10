import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { authCorsHeaders } from "../_utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();

  return NextResponse.json({ user }, {
    status: user ? 200 : 401,
    headers: authCorsHeaders,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: authCorsHeaders });
}
