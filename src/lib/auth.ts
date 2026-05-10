import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { ObjectId } from "mongodb";
import { cookies, headers } from "next/headers";
import { getMongoDb } from "@/lib/mongodb";
import type { Profile, User, UserSession } from "@/lib/models";
import { verifyUserPassword } from "@/lib/users";

const sessionCookieName = "sunpatch_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

export type CurrentUser = {
  id: string;
  email: string;
  username?: string;
  displayName: string;
  avatarUrl?: string;
};

export class AuthenticationError extends Error {}

export async function createSessionForUser(userId: ObjectId) {
  const db = await getMongoDb();
  const now = new Date();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + sessionMaxAgeSeconds * 1000);

  await db.collection<UserSession>("sessions").createIndex({ tokenHash: 1 }, { unique: true });
  await db.collection<UserSession>("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection<UserSession>("sessions").insertOne({
    _id: new ObjectId(),
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });

  return token;
}

export async function signInWithPassword(identifier: string, password: string) {
  const user = await verifyUserPassword(identifier, password);

  if (!user) {
    throw new AuthenticationError("Username or password is incorrect");
  }

  await createSessionForUser(user._id);
  return user;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = await getSessionToken();

  if (!token) {
    return null;
  }

  return getCurrentUserFromSessionToken(token);
}

export async function getCurrentUserFromSessionToken(token: string): Promise<CurrentUser | null> {
  if (!token) {
    return null;
  }

  const db = await getMongoDb();
  const now = new Date();
  const session = await db.collection<UserSession>("sessions").findOne({
    tokenHash: hashSessionToken(token),
    expiresAt: { $gt: now },
  });

  if (!session) {
    return null;
  }

  const [user, profile] = await Promise.all([
    db.collection<User>("users").findOne({ _id: session.userId }),
    db.collection<Profile>("profiles").findOne({ userId: session.userId }),
  ]);

  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    displayName: profile?.displayName || user.username || user.email,
    avatarUrl: profile?.avatarUrl,
  };
}

export async function requireUserSession() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    throw new AuthenticationError("Sign in to continue");
  }

  return {
    ...currentUser,
    userId: new ObjectId(currentUser.id),
  };
}

export async function clearCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value ?? (await getBearerToken());

  if (token) {
    await clearSessionToken(token);
  }

  cookieStore.delete(sessionCookieName);
}

export async function clearSessionToken(token: string) {
  const db = await getMongoDb();
  await db.collection<UserSession>("sessions").deleteOne({ tokenHash: hashSessionToken(token) });
}

async function getSessionToken() {
  return (await cookies()).get(sessionCookieName)?.value ?? (await getBearerToken());
}

async function getBearerToken() {
  const authorization = (await headers()).get("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
