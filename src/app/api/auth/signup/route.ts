import { NextResponse } from "next/server";
import {
  AuthenticationError,
  createSessionForUser,
  getCurrentUserFromSessionToken,
} from "@/lib/auth";
import { createUserWithProfile, normalizeUsername } from "@/lib/users";
import { authCorsHeaders, isDuplicateKeyError, type AuthSuccessResponse } from "../_utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = normalizeUsername(typeof body?.username === "string" ? body.username : "");
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (username.length < 3) {
      throw new AuthenticationError("Choose a username with at least 3 letters or numbers");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AuthenticationError("Enter a valid email address");
    }
    if (password.length < 8) {
      throw new AuthenticationError("Use a password with at least 8 characters");
    }

    const result = await createUserWithProfile({
      username,
      email,
      password,
      displayName: displayName || username,
    });
    const token = await createSessionForUser(result.userId);
    const user = await getCurrentUserFromSessionToken(token);

    if (!user) {
      throw new Error("Session was created but could not be loaded");
    }

    return NextResponse.json({ token, user } satisfies AuthSuccessResponse, {
      status: 201,
      headers: authCorsHeaders,
    });
  } catch (error) {
    const message = isDuplicateKeyError(error)
      ? "That username or email is already taken"
      : error instanceof Error
        ? error.message
        : "Unable to create account";

    return NextResponse.json(
      { error: message },
      { status: error instanceof AuthenticationError || isDuplicateKeyError(error) ? 400 : 500, headers: authCorsHeaders },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: authCorsHeaders });
}
