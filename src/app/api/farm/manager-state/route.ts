import { NextResponse } from "next/server";
import { AuthenticationError, requireUserSession } from "@/lib/auth";
import { hasSavedFarmState, normalizeFarmManagerSnapshot } from "@/lib/farm-manager-state";
import { getMongoDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

const collectionName = "farm_manager_states";

export async function GET() {
  try {
    const db = await getMongoDb();
    const currentUser = await requireUserSession();

    await db.collection(collectionName).createIndex({ userId: 1 }, { unique: true });

    const document = await db.collection(collectionName).findOne({ userId: currentUser.userId });
    const state = document?.state ? normalizeFarmManagerSnapshot(document.state) : null;

    return NextResponse.json({
      state,
      hasSavedFarm: hasSavedFarmState(state),
      updatedAt: serializeDate(document?.updatedAt),
    });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to load farm manager state") },
      { status: error instanceof AuthenticationError ? 401 : 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const state = normalizeFarmManagerSnapshot(body?.state);
    const db = await getMongoDb();
    const currentUser = await requireUserSession();
    const now = new Date();

    await db.collection(collectionName).createIndex({ userId: 1 }, { unique: true });
    await db.collection(collectionName).updateOne(
      { userId: currentUser.userId },
      {
        $set: {
          userId: currentUser.userId,
          state,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );

    return NextResponse.json({
      hasSavedFarm: hasSavedFarmState(state),
      updatedAt: now.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to save farm manager state") },
      { status: error instanceof AuthenticationError ? 401 : 400 },
    );
  }
}

function serializeDate(value: unknown) {
  return value instanceof Date ? value.toISOString() : null;
}

function formatApiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;

  if (message.includes("tlsv1 alert internal error") || message.includes("SSL routines")) {
    return "Database connection failed before authentication. Check MongoDB Atlas Network Access/IP allowlist and TLS settings.";
  }

  return message || fallback;
}
