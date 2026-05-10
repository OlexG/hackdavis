import { ObjectId, type Document, type UpdateFilter } from "mongodb";
import { NextResponse } from "next/server";
import { AuthenticationError, requireUserSession } from "@/lib/auth";
import {
  createFarmV2Commit,
  createFarmV2PlanSeed,
  getBBox,
  sanitizeFarmV2Objects,
  sanitizeGeoPoints,
  sanitizeLocalPoints,
  type FarmV2SetupMode,
} from "@/lib/farm-v2";
import { getMongoDb } from "@/lib/mongodb";
import type { FarmV2Object, FarmV2Plan } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getMongoDb();
    const context = await ensureFarmV2Context();
    const plans = await db
      .collection<FarmV2Plan>("plans")
      .find({ userId: context.userId, farmId: context.farmId, schema: "farmv2" })
      .sort({ createdAt: -1 })
      .limit(8)
      .toArray();

    return NextResponse.json({ plans: plans.map(serializeDocument) });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to load Farmv2 plans") },
      { status: error instanceof AuthenticationError ? 401 : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const input = normalizeCreateRequest(await request.json());
    const db = await getMongoDb();
    const context = await ensureFarmV2Context();
    const existingFarmV2 = await db.collection("plans").findOne({
      userId: context.userId,
      farmId: context.farmId,
      schema: "farmv2",
    });
    const now = new Date();
    const generated = createFarmV2PlanSeed({
      mode: input.setupMode,
      boundaryGeo: input.boundaryGeo,
      boundaryLocal: input.boundaryLocal,
      now,
    });
    const bbox = getBBox(generated.boundary.local);
    const geoPoint = geoPointFromBoundary(input.boundaryGeo) ?? defaultGeoPoint();

    if (!existingFarmV2) {
      await db.collection("plans").deleteMany({
        userId: context.userId,
        farmId: context.farmId,
        $or: [
          { schema: { $exists: false } },
          { schema: { $ne: "farmv2" } },
          { version: { $lt: 8 } },
        ],
      });
    }

    await db.collection("farms").updateOne(
      { _id: context.farmId, userId: context.userId },
      {
        $set: {
          userUuid: context.userUuid,
          bounds: {
            width: Math.max(1, Math.round(bbox.maxX - bbox.minX)),
            depth: Math.max(1, Math.round(bbox.maxY - bbox.minY)),
            height: 10,
          },
          location: geoPoint.location,
          coordinates: geoPoint.coordinates,
          shortName: "DH",
          distance: "Nearby",
          neighborhood: "Davis, California",
          response: "Offer notifications enabled",
          rating: 5,
          reviews: 0,
          ratings: { quality: 5, fairness: 5, pickup: 5 },
          updatedAt: now,
        },
      },
    );

    const result = await db.collection("plans").insertOne({
      farmId: context.farmId,
      userId: context.userId,
      ...generated,
    });
    const plan = await db.collection<FarmV2Plan>("plans").findOne({ _id: result.insertedId });

    return NextResponse.json({ plan: serializeDocument(plan) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to create Farmv2 plan") },
      { status: error instanceof AuthenticationError ? 401 : isRequestError(error) ? 400 : 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const input = normalizePatchRequest(await request.json());
    const db = await getMongoDb();
    const context = await ensureFarmV2Context();
    const planId = new ObjectId(input.planId);
    const selector = {
      _id: planId,
      userId: context.userId,
      farmId: context.farmId,
      schema: "farmv2" as const,
    };
    const now = new Date();

    if (input.action === "saveObjects") {
      await db.collection("plans").updateOne(selector, {
        $set: {
          objects: input.objects,
          selectedId: input.selectedId,
          units: input.units,
          view: input.view,
          camera: input.camera,
          updatedAt: now,
        },
      });
    } else if (input.action === "appendCommit") {
      const plan = await db.collection<FarmV2Plan>("plans").findOne(selector);
      if (!plan) throw new Error("Farmv2 plan not found");
      const commit = createFarmV2Commit(input.name, input.objects, now);
      await db.collection("plans").updateOne(selector, {
        $set: {
          objects: input.objects,
          selectedId: input.selectedId,
          commitIndex: plan.commits.length,
          updatedAt: now,
        },
        $push: { commits: { $each: [commit] } },
      } as unknown as UpdateFilter<Document>);
    } else if (input.action === "loadCommit") {
      const plan = await db.collection<FarmV2Plan>("plans").findOne(selector);
      if (!plan) throw new Error("Farmv2 plan not found");
      const commitIndex = input.commitIndex;
      // commitIndex >= commits.length is the "live" sentinel; that's allowed.
      if (commitIndex < 0 || (commitIndex < plan.commits.length ? !plan.commits[commitIndex] : false)) {
        throw new Error("Timeline entry not found");
      }
      // Non-destructive: only remember which entry the user is viewing.
      // plan.objects (the live working state) stays untouched so previewing
      // a snapshot can never overwrite the user's unsaved edits.
      await db.collection("plans").updateOne(selector, {
        $set: {
          commitIndex,
          updatedAt: now,
        },
      });
    } else if (input.action === "renamePlan") {
      await db.collection("plans").updateOne(selector, {
        $set: {
          name: input.name,
          updatedAt: now,
        },
      });
    } else if (input.action === "archivePlan") {
      await db.collection("plans").updateOne(selector, {
        $set: {
          status: "archived",
          updatedAt: now,
        },
      });
    }

    const plan = await db.collection<FarmV2Plan>("plans").findOne(selector);
    return NextResponse.json({ plan: serializeDocument(plan) });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to save Farmv2 plan") },
      { status: error instanceof AuthenticationError ? 401 : isRequestError(error) ? 400 : 500 },
    );
  }
}

async function ensureFarmV2Context() {
  const db = await getMongoDb();
  const currentUser = await requireUserSession();
  const now = new Date();

  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("users").createIndex({ username: 1 }, { unique: true, sparse: true }),
    db.collection("users").createIndex({ uuid: 1 }, { unique: true, sparse: true }),
    db.collection("profiles").createIndex({ userId: 1 }, { unique: true }),
    db.collection("farms").createIndex({ userId: 1 }),
    db.collection("farms").createIndex({ slug: 1 }, { unique: true, sparse: true }),
    db.collection("farms").createIndex({ location: "2dsphere" }),
    db.collection("plans").createIndex({ userId: 1, farmId: 1, schema: 1, createdAt: -1 }),
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
        location: defaultGeoPoint().location,
        coordinates: defaultGeoPoint().coordinates,
        units: "feet",
        updatedAt: now,
      },
      $setOnInsert: {
        bounds: { width: 108, depth: 82, height: 10 },
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
    farmId: farm._id as ObjectId,
  };
}

function geoPointFromBoundary(boundaryGeo: Array<[number, number]> | null) {
  if (!boundaryGeo?.length) {
    return null;
  }

  const validPoints = boundaryGeo.filter((point) =>
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    point[0] >= -180 &&
    point[0] <= 180 &&
    point[1] >= -90 &&
    point[1] <= 90,
  );

  if (!validPoints.length) {
    return null;
  }

  const longitude = roundGeo(validPoints.reduce((sum, point) => sum + point[0], 0) / validPoints.length);
  const latitude = roundGeo(validPoints.reduce((sum, point) => sum + point[1], 0) / validPoints.length);

  return {
    location: {
      type: "Point" as const,
      coordinates: [longitude, latitude] as [number, number],
    },
    coordinates: {
      latitude,
      longitude,
      x: 50,
      y: 50,
    },
  };
}

function roundGeo(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function defaultGeoPoint() {
  const latitude = 38.5449;
  const longitude = -121.7405;

  return {
    location: {
      type: "Point" as const,
      coordinates: [longitude, latitude] as [number, number],
    },
    coordinates: {
      latitude,
      longitude,
      x: 50,
      y: 50,
    },
  };
}

function normalizeCreateRequest(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid Farmv2 create request");
  }
  const body = raw as Record<string, unknown>;
  const setupMode: FarmV2SetupMode = body.setupMode === "manual" ? "manual" : "deterministic-draft";
  const boundaryGeo = sanitizeGeoPoints(body.boundaryGeo);
  const boundaryLocal = Array.isArray(body.boundaryLocal) ? sanitizeLocalPoints(body.boundaryLocal) : undefined;

  if (boundaryGeo.length < 3 && (!boundaryLocal || boundaryLocal.length < 3)) {
    throw new Error("Save at least three boundary points before creating a Farmv2 plan");
  }

  return {
    setupMode,
    boundaryGeo: boundaryGeo.length >= 3 ? boundaryGeo : null,
    boundaryLocal,
  };
}

type FarmV2PatchRequest =
  | {
      planId: string;
      action: "saveObjects";
      objects: FarmV2Object[];
      selectedId: string | null;
      units: "ft" | "m";
      view: "grid" | "satellite";
      camera: { zoom: number; panX: number; panY: number; rotation: number };
    }
  | { planId: string; action: "appendCommit"; name: string; objects: FarmV2Object[]; selectedId: string | null }
  | { planId: string; action: "loadCommit"; commitIndex: number }
  | { planId: string; action: "renamePlan"; name: string }
  | { planId: string; action: "archivePlan" };

function normalizePatchRequest(raw: unknown): FarmV2PatchRequest {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid Farmv2 save request");
  }
  const body = raw as Record<string, unknown>;
  const planId = typeof body.planId === "string" && ObjectId.isValid(body.planId) ? body.planId : "";
  const action = body.action;

  if (!planId) {
    throw new Error("Invalid Farmv2 plan id");
  }

  if (action === "saveObjects") {
    return {
      planId,
      action,
      objects: sanitizeFarmV2Objects(body.objects),
      selectedId: typeof body.selectedId === "string" ? body.selectedId : null,
      units: body.units === "m" ? "m" : "ft",
      view: body.view === "satellite" ? "satellite" : "grid",
      camera: normalizeCamera(body.camera),
    };
  }

  if (action === "appendCommit") {
    return {
      planId,
      action,
      name: typeof body.name === "string" ? body.name.trim().slice(0, 120) : "",
      objects: sanitizeFarmV2Objects(body.objects),
      selectedId: typeof body.selectedId === "string" ? body.selectedId : null,
    };
  }

  if (action === "loadCommit") {
    const commitIndex = Number(body.commitIndex);
    return {
      planId,
      action,
      commitIndex: Number.isInteger(commitIndex) && commitIndex >= 0 ? commitIndex : -1,
    };
  }

  if (action === "renamePlan") {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (!name) throw new Error("Plan name is required");
    return { planId, action, name };
  }

  if (action === "archivePlan") {
    return { planId, action };
  }

  throw new Error("Unsupported Farmv2 save action");
}

function normalizeCamera(raw: unknown) {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return {
    zoom: numberOr(value.zoom, 1),
    panX: numberOr(value.panX, 0),
    panY: numberOr(value.panY, -18),
    rotation: numberOr(value.rotation, 0),
  };
}

function numberOr(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function serializeDocument(document: unknown): unknown {
  if (document instanceof ObjectId) {
    return document.toHexString();
  }

  if (document instanceof Date) {
    return document.toISOString();
  }

  if (Array.isArray(document)) {
    return document.map(serializeDocument);
  }

  if (document && typeof document === "object") {
    return Object.fromEntries(
      Object.entries(document).map(([key, value]) => [key, serializeDocument(value)]),
    );
  }

  return document;
}

function formatApiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;

  if (message.includes("tlsv1 alert internal error") || message.includes("SSL routines")) {
    return "Database connection failed before authentication. Check MongoDB Atlas Network Access/IP allowlist and TLS settings.";
  }

  return message || fallback;
}

function isRequestError(error: unknown) {
  return error instanceof Error && (
    error.message.includes("boundary") ||
    error.message.includes("Unsupported") ||
    error.message.includes("Invalid") ||
    error.message.includes("required") ||
    error.message.includes("not found")
  );
}
