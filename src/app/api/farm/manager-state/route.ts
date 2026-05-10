import { NextResponse } from "next/server";
import { AuthenticationError, requireUserSession } from "@/lib/auth";
import { hasSavedFarmState, normalizeFarmManagerSnapshot } from "@/lib/farm-manager-state";
import {
  farmGeoPointFromSnapshot,
  farmManagerPlanUpdate,
  farmManagerSnapshotToPlanFields,
  farmV2PlanToFarmManagerSnapshot,
} from "@/lib/farm-manager-plan";
import { getMongoDb } from "@/lib/mongodb";
import type { FarmV2Plan } from "@/lib/models";

export const dynamic = "force-dynamic";

const planSelector = { schema: "farmv2" as const, status: { $ne: "archived" as const } };

export async function GET() {
  try {
    const db = await getMongoDb();
    const context = await ensureFarmContext();

    const plan = await db.collection<FarmV2Plan>("plans").findOne(
      { userId: context.userId, farmId: context.farmId, ...planSelector },
      { sort: { updatedAt: -1, createdAt: -1 } },
    );

    if (plan) {
      const state = farmV2PlanToFarmManagerSnapshot(plan);

      return NextResponse.json({
        state,
        hasSavedFarm: hasSavedFarmState(state),
        updatedAt: serializeDate(plan.updatedAt),
      });
    }

    return NextResponse.json({
      state: null,
      hasSavedFarm: false,
      updatedAt: null,
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
    const context = await ensureFarmContext();
    const now = new Date();
    const existingPlan = await db.collection<FarmV2Plan>("plans").findOne(
      { userId: context.userId, farmId: context.farmId, ...planSelector },
      { sort: { updatedAt: -1, createdAt: -1 } },
    );

    if (hasSavedFarmState(state) || existingPlan) {
      if (existingPlan) {
        await db.collection<FarmV2Plan>("plans").updateOne(
          { _id: existingPlan._id, userId: context.userId, farmId: context.farmId },
          farmManagerPlanUpdate(state, now, existingPlan),
        );
      } else {
        await db.collection("plans").insertOne({
          farmId: context.farmId,
          userId: context.userId,
          ...farmManagerSnapshotToPlanFields(state, now),
          createdAt: now,
          updatedAt: now,
        });
      }

      await updateFarmDocument(state, now, context);
    }

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

async function ensureFarmContext() {
  const db = await getMongoDb();
  const currentUser = await requireUserSession();
  const now = new Date();

  await Promise.all([
    db.collection("farms").createIndex({ userId: 1 }),
    db.collection("farms").createIndex({ location: "2dsphere" }),
    db.collection("plans").createIndex({ userId: 1, farmId: 1, schema: 1, updatedAt: -1 }),
  ]);

  const farm = await db.collection("farms").findOneAndUpdate(
    { userId: currentUser.userId, name: "Drawn Homestead Site" },
    {
      $set: {
        userId: currentUser.userId,
        userUuid: currentUser.uuid,
        name: "Drawn Homestead Site",
        shortName: "DH",
        distance: "Nearby",
        neighborhood: "Davis, California",
        response: "Offer notifications enabled",
        rating: 5,
        reviews: 0,
        ratings: { quality: 5, fairness: 5, pickup: 5 },
        units: "feet",
        updatedAt: now,
      },
      $setOnInsert: {
        bounds: { width: 108, depth: 82, height: 10 },
        location: {
          type: "Point",
          coordinates: [-121.7405, 38.5449],
        },
        coordinates: {
          latitude: 38.5449,
          longitude: -121.7405,
          x: 50,
          y: 50,
        },
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!farm) {
    throw new Error("Unable to create farm");
  }

  return {
    userId: currentUser.userId,
    userUuid: currentUser.uuid,
    farmId: farm._id,
  };
}

async function updateFarmDocument(
  state: ReturnType<typeof normalizeFarmManagerSnapshot>,
  now: Date,
  context: Awaited<ReturnType<typeof ensureFarmContext>>,
) {
  const db = await getMongoDb();
  const geoPoint = farmGeoPointFromSnapshot(state);
  const width = Math.max(1, Math.round(Math.max(...state.boundaryLocal.map((point) => point[0]))));
  const depth = Math.max(1, Math.round(Math.max(...state.boundaryLocal.map((point) => point[1]))));

  await db.collection("farms").updateOne(
    { _id: context.farmId, userId: context.userId },
    {
      $set: {
        userUuid: context.userUuid,
        bounds: { width, depth, height: 10 },
        location: geoPoint.location,
        coordinates: geoPoint.coordinates,
        updatedAt: now,
      },
    },
  );
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
