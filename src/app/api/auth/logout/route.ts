import { NextResponse } from "next/server";
import { clearCurrentSession } from "@/lib/auth";
import { authCorsHeaders } from "../_utils";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearCurrentSession();
  return NextResponse.json({ ok: true }, { headers: authCorsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: authCorsHeaders });
}
