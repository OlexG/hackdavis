import "server-only";

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { ObjectId, type Collection } from "mongodb";

import { getMongoDb } from "@/lib/mongodb";
import type { Profile, User } from "@/lib/models";

const PASSWORD_SALT_ROUNDS = 12;

function usersCollection(dbName?: string): Promise<Collection<User>> {
  return getMongoDb(dbName).then((db) => db.collection<User>("users"));
}

function profilesCollection(dbName?: string): Promise<Collection<Profile>> {
  return getMongoDb(dbName).then((db) => db.collection<Profile>("profiles"));
}

export async function getUserByEmail(email: string, dbName?: string) {
  const users = await usersCollection(dbName);
  return users.findOne({ email: email.toLowerCase() });
}

export async function getUserByUsername(username: string, dbName?: string) {
  const users = await usersCollection(dbName);
  return users.findOne({ username: normalizeUsername(username) });
}

export async function getUserByIdentifier(identifier: string, dbName?: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  if (!normalizedIdentifier) {
    return null;
  }

  const users = await usersCollection(dbName);
  return users.findOne({
    $or: [
      { email: normalizedIdentifier },
      { username: normalizeUsername(normalizedIdentifier) },
    ],
  });
}

export async function getProfileByUserId(userId: ObjectId, dbName?: string) {
  const profiles = await profilesCollection(dbName);
  return profiles.findOne({ userId });
}

export async function getProfileForEmail(email: string, dbName?: string) {
  const user = await getUserByEmail(email, dbName);

  if (!user) {
    return null;
  }

  const profile = await getProfileByUserId(user._id, dbName);
  return { user, profile };
}

export async function createUserWithProfile(input: {
  username: string;
  email: string;
  password: string;
  displayName: string;
  dbName?: string;
}) {
  const db = await getMongoDb(input.dbName);
  const users = db.collection<User>("users");
  const profiles = db.collection<Profile>("profiles");
  const now = new Date();
  const normalizedEmail = input.email.toLowerCase();
  const username = normalizeUsername(input.username);
  const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);
  const userId = new ObjectId();
  const profileId = new ObjectId();

  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    users.createIndex({ username: 1 }, { unique: true, sparse: true }),
    users.createIndex({ uuid: 1 }, { unique: true, sparse: true }),
    profiles.createIndex({ userId: 1 }, { unique: true }),
  ]);

  const userResult = await users.insertOne({
    _id: userId,
    uuid: randomUUID(),
    email: normalizedEmail,
    username,
    passwordHash,
    role: "user",
    createdAt: now,
    updatedAt: now,
  });

  const profileResult = await profiles.insertOne({
    _id: profileId,
    userId,
    displayName: input.displayName,
    createdAt: now,
    updatedAt: now,
  });

  return {
    userId: userResult.insertedId,
    profileId: profileResult.insertedId,
  };
}

export async function verifyUserPassword(identifier: string, password: string, dbName?: string) {
  const user = await getUserByIdentifier(identifier, dbName);

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  return isValid ? user : null;
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}
