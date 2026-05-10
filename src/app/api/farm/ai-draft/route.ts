import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { AuthenticationError, requireUserSession } from "@/lib/auth";
import {
  generateAiFarmPlan,
  normalizeAiDraftPreferences,
  type AiDraftCrop,
  type AiDraftLivestock,
} from "@/lib/farm-ai-draft";
import { farmGeoPointFromSnapshot, farmV2PlanToFarmManagerSnapshot } from "@/lib/farm-manager-plan";
import { getBBox, sanitizeGeoPoints, sanitizeLocalPoints } from "@/lib/farm-v2";
import { getMongoDb } from "@/lib/mongodb";
import type { FarmV2Plan } from "@/lib/models";

export const dynamic = "force-dynamic";

type PlantDocument = {
  crop_id?: string;
  common_name?: string;
  scientific_name?: string;
  description?: string;
  crop_category?: string;
  life_span?: string;
  ideal_space?: number;
  yield_count?: number;
  light_requirement?: string;
  soil_texture?: string;
  temperature_min?: number;
  temperature_max?: number;
  water_consumption_ml?: number;
  rainfall_max_ml?: number;
  how_to_grow?: string;
  tips?: string;
};

type LivestockDocument = {
  livestock_id?: string;
  name?: string;
  ideal_space?: number;
  feed?: string;
  yield_types?: string[];
};

const structures = [
  { key: "barn", name: "Barn", material: "Timber frame", height: 8.6 },
  { key: "shed", name: "Shed", material: "Cedar siding", height: 5.8 },
  { key: "coop", name: "Coop", material: "Pine", height: 4.2 },
  { key: "storage", name: "Storage Unit", material: "Timber", height: 5.2 },
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = normalizeAiDraftRequest(body);
    const db = await getMongoDb();
    const context = await ensureFarmContext();
    const [plants, animals] = await Promise.all([
      db.collection<PlantDocument>("plants").find({}).sort({ common_name: 1 }).toArray(),
      db.collection<LivestockDocument>("livestock").find({}).sort({ name: 1 }).toArray(),
    ]);
    const crops = plants.map(normalizePlant).filter((crop): crop is AiDraftCrop => Boolean(crop));
    const livestock = animals.map(normalizeLivestock).filter((animal): animal is AiDraftLivestock => Boolean(animal));
    if (!crops.length) throw new Error("No plant catalog entries are available for AI planning");
    const now = new Date();
    const generated = await generateAiFarmPlan({
      boundaryGeo: input.boundaryGeo,
      boundaryLocal: input.boundaryLocal,
      preferences: input.preferences,
      crops,
      livestock,
      structures,
      now,
    });
    const result = await db.collection("plans").insertOne({
      farmId: context.farmId,
      userId: context.userId,
      ...generated,
    });
    const plan = await db.collection<FarmV2Plan>("plans").findOne({ _id: result.insertedId });
    if (!plan) throw new Error("Generated plan was not saved");

    await updateFarmDocument(plan, context);

    return NextResponse.json({
      state: farmV2PlanToFarmManagerSnapshot(plan),
      planId: plan._id.toHexString(),
      updatedAt: plan.updatedAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to generate AI farm draft") },
      { status: error instanceof AuthenticationError ? 401 : isPlannerTimeoutError(error) ? 504 : isRequestError(error) ? 400 : 500 },
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
        location: { type: "Point", coordinates: [-121.7405, 38.5449] },
        coordinates: { latitude: 38.5449, longitude: -121.7405, x: 50, y: 50 },
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!farm) throw new Error("Unable to create farm");

  return {
    userId: currentUser.userId,
    userUuid: currentUser.uuid,
    farmId: farm._id as ObjectId,
  };
}

async function updateFarmDocument(plan: FarmV2Plan, context: Awaited<ReturnType<typeof ensureFarmContext>>) {
  const db = await getMongoDb();
  const snapshot = farmV2PlanToFarmManagerSnapshot(plan);
  const geoPoint = farmGeoPointFromSnapshot(snapshot);
  const bbox = getBBox(plan.boundary.local);

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
        updatedAt: plan.updatedAt,
      },
    },
  );
}

function normalizeAiDraftRequest(raw: unknown) {
  if (!raw || typeof raw !== "object") throw new Error("Invalid AI draft request");
  const body = raw as Record<string, unknown>;
  const boundaryGeo = sanitizeGeoPoints(body.boundaryGeo);
  const boundaryLocal = sanitizeLocalPoints(body.boundaryLocal);
  if (boundaryGeo.length < 3 && boundaryLocal.length < 3) throw new Error("Save a farm boundary before generating an AI draft");

  return {
    boundaryGeo: boundaryGeo.length >= 3 ? boundaryGeo : null,
    boundaryLocal,
    preferences: normalizeAiDraftPreferences(body.preferences),
  };
}

function normalizePlant(plant: PlantDocument): AiDraftCrop | null {
  const key = normalizeString(plant.crop_id);
  const name = normalizeString(plant.common_name);
  if (!key || !name) return null;

  return {
    key,
    name,
    visual: inferCropVisual(plant),
    defaultCount: defaultCropCount(plant.ideal_space),
    idealSpaceSqft: positiveNumber(plant.ideal_space),
    harvestCycles: positiveInteger(plant.yield_count),
    cropCategory: normalizeString(plant.crop_category) || undefined,
    lifeSpan: normalizeString(plant.life_span) || undefined,
    lightRequirement: normalizeString(plant.light_requirement) || undefined,
    soilTexture: normalizeString(plant.soil_texture) || undefined,
    temperatureMinC: finiteNumber(plant.temperature_min),
    temperatureMaxC: finiteNumber(plant.temperature_max),
    waterConsumptionMl: finiteNumber(plant.water_consumption_ml),
    rainfallMaxMl: finiteNumber(plant.rainfall_max_ml),
    howToGrow: normalizeString(plant.how_to_grow) || undefined,
    tips: normalizeString(plant.tips) || undefined,
  };
}

function normalizeLivestock(animal: LivestockDocument): AiDraftLivestock | null {
  const key = normalizeString(animal.livestock_id);
  const name = normalizeString(animal.name);
  if (!key || !name) return null;

  return {
    key,
    name,
    defaultCount: defaultLivestockCount(animal.ideal_space),
    idealSpaceSqft: positiveNumber(animal.ideal_space),
    feed: normalizeString(animal.feed) || undefined,
    yieldTypes: Array.isArray(animal.yield_types) ? animal.yield_types.map(normalizeString).filter(Boolean) : [],
  };
}

function inferCropVisual(plant: PlantDocument) {
  const text = `${plant.crop_id ?? ""} ${plant.common_name ?? ""} ${plant.crop_category ?? ""}`.toLowerCase();
  if (/\b(corn|wheat|grain|grass)\b/.test(text)) return "grain";
  if (/\b(potato|beet|carrot|radish|turnip|onion|garlic|root)\b/.test(text)) return "root";
  if (/\b(squash|melon|pumpkin|cucumber|vine)\b/.test(text)) return "vine";
  if (/\b(strawberr|groundcover)\b/.test(text)) return "groundcover";
  if (/\b(basil|mint|sage|thyme|oregano|cilantro|parsley|herb)\b/.test(text)) return "herb";
  if (/\b(lettuce|spinach|kale|chard|greens|leaf|leafy|cabbage|arugula)\b/.test(text)) return "leafy";
  if (/\b(tomato|pepper|eggplant|berry|fruit|apple|peach|pear|plum|citrus|fig|grape)\b/.test(text)) return "fruiting";
  return "generic";
}

function defaultCropCount(idealSpace: unknown) {
  const space = positiveNumber(idealSpace);
  if (!space) return 12;
  return Math.max(1, Math.min(80, Math.round(120 / space)));
}

function defaultLivestockCount(idealSpace: unknown) {
  const space = positiveNumber(idealSpace);
  if (!space) return 1;
  return Math.max(1, Math.min(24, Math.round(240 / space)));
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function finiteNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function positiveNumber(value: unknown) {
  const number = finiteNumber(value);
  return number && number > 0 ? number : undefined;
}

function positiveInteger(value: unknown) {
  const number = finiteNumber(value);
  return number && number > 0 ? Math.round(number) : undefined;
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
    error.message.includes("Invalid") ||
    error.message.includes("Gemini") ||
    error.message.includes("GEMINI_API_KEY")
  );
}

function isPlannerTimeoutError(error: unknown) {
  return error instanceof Error && error.message.includes("farm planner timed out");
}
