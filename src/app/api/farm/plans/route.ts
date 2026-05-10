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
          bounds: {
            width: Math.max(1, Math.round(bbox.maxX - bbox.minX)),
            depth: Math.max(1, Math.round(bbox.maxY - bbox.minY)),
            height: 10,
          },
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
      const commit = plan.commits[commitIndex];
      if (!commit) throw new Error("Timeline entry not found");
      await db.collection("plans").updateOne(selector, {
        $set: {
          objects: commit.objects,
          selectedId: commit.objects[0]?.id ?? null,
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
    db.collection("farms").createIndex({ userId: 1 }),
    db.collection("plans").createIndex({ userId: 1, farmId: 1, schema: 1, createdAt: -1 }),
  ]);

  const farm = await db.collection("farms").findOneAndUpdate(
    { userId: currentUser.userId, name: "Drawn Homestead Site" },
    {
      $set: {
        userId: currentUser.userId,
        name: "Drawn Homestead Site",
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
    farmId: farm._id as ObjectId,
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
