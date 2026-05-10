import { NextResponse } from "next/server";
import {
  AuthenticationError,
  createSessionForUser,
  getCurrentUserFromSessionToken,
} from "@/lib/auth";
import { verifyUserPassword } from "@/lib/users";
import { authCorsHeaders, type AuthSuccessResponse } from "../_utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = typeof body?.identifier === "string" ? body.identifier.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!identifier || !password) {
      throw new AuthenticationError("Enter your username and password");
    }

    const userRecord = await verifyUserPassword(identifier, password);

    if (!userRecord) {
      throw new AuthenticationError("Username or password is incorrect");
    }

    const token = await createSessionForUser(userRecord._id);
    const user = await getCurrentUserFromSessionToken(token);

    if (!user) {
      throw new Error("Session was created but could not be loaded");
    }

    return NextResponse.json({ token, user } satisfies AuthSuccessResponse, { headers: authCorsHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sign in" },
      { status: error instanceof AuthenticationError ? 401 : 500, headers: authCorsHeaders },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: authCorsHeaders });
}
