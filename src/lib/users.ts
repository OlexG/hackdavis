import "server-only";

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
  const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);
  const userId = new ObjectId();
  const profileId = new ObjectId();

  const userResult = await users.insertOne({
    _id: userId,
    email: normalizedEmail,
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

export async function verifyUserPassword(email: string, password: string, dbName?: string) {
  const user = await getUserByEmail(email, dbName);

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  return isValid ? user : null;
}
