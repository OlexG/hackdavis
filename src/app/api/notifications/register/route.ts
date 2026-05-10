import { NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { PushTokenError, registerPushToken } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

export async function POST(request: Request) {
  try {
    const body = normalizeRequest(await request.json());
    const result = await registerPushToken(body);

    return NextResponse.json(result, { status: 201, headers: corsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to register push notifications" },
      {
        status: error instanceof AuthenticationError ? 401 : error instanceof PushTokenError ? 400 : 500,
        headers: corsHeaders,
      },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

function normalizeRequest(raw: unknown) {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};

  return {
    token: typeof value.token === "string" ? value.token : "",
    platform: typeof value.platform === "string" ? value.platform : undefined,
    deviceName: typeof value.deviceName === "string" ? value.deviceName : undefined,
  };
}
