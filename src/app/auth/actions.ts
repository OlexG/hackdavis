"use server";

import { redirect } from "next/navigation";
import { AuthenticationError, clearCurrentSession, createSessionForUser, signInWithPassword } from "@/lib/auth";
import { createUserWithProfile, normalizeUsername } from "@/lib/users";

type AuthState = {
  error?: string;
};

export async function loginAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    if (!identifier || !password) {
      throw new AuthenticationError("Enter your username and password");
    }

    await signInWithPassword(identifier, password);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to sign in" };
  }

  redirect("/app/farm");
}

export async function signupAction(_state: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
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

    await createSessionForUser(result.userId);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { error: "That username or email is already taken" };
    }

    return { error: error instanceof Error ? error.message : "Unable to create account" };
  }

  redirect("/app/farm");
}

export async function logoutAction() {
  await clearCurrentSession();
  redirect("/login");
}

function isDuplicateKeyError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11000;
}
