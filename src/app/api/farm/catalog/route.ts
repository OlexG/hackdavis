import { NextResponse } from "next/server";
import { AuthenticationError, requireUserSession } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

type CropVisual = "fruiting" | "grain" | "leafy" | "herb" | "mound" | "vine" | "root" | "groundcover" | "generic";

type PlantDocument = {
  crop_id?: string;
  common_name?: string;
  scientific_name?: string;
  description?: string;
  crop_category?: string;
  life_span?: string;
  ideal_space?: number;
  yield_count?: number;
  soil_ph_min?: number;
  soil_ph_max?: number;
  light_requirement?: string;
  soil_texture?: string;
  water_consumption_ml?: number;
  rainfall_max_ml?: number;
  how_to_grow?: string;
  insect_control?: string;
  tips?: string;
};

type LivestockDocument = {
  livestock_id?: string;
  name?: string;
  description?: string;
  ideal_space?: number;
  feed?: string;
  care_instructions?: string;
  meat_yield?: number;
  yield_types?: string[];
  yield_frequency?: string;
};

const structures = [
  { key: "barn", name: "Barn", material: "Timber frame", height: 8.6 },
  { key: "shed", name: "Shed", material: "Cedar siding", height: 5.8 },
  { key: "greenhouse", name: "Greenhouse", material: "Polycarbonate", height: 6.6 },
  { key: "coop", name: "Coop", material: "Pine", height: 4.2 },
  { key: "storage", name: "Storage Unit", material: "Timber", height: 5.2 },
];

export async function GET() {
  try {
    await requireUserSession();
    const db = await getMongoDb();
    const [plants, livestock] = await Promise.all([
      db.collection<PlantDocument>("plants").find({}).sort({ common_name: 1 }).toArray(),
      db.collection<LivestockDocument>("livestock").find({}).sort({ name: 1 }).toArray(),
    ]);

    return NextResponse.json({
      crops: plants.map(normalizePlant).filter(Boolean),
      livestock: livestock.map(normalizeLivestock).filter(Boolean),
      structures,
    });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to load farm catalog") },
      { status: error instanceof AuthenticationError ? 401 : 500 },
    );
  }
}

function normalizePlant(plant: PlantDocument) {
  const key = normalizeString(plant.crop_id);
  const name = normalizeString(plant.common_name);
  if (!key || !name) return null;

  return {
    key,
    name,
    visual: inferCropVisual(plant),
    defaultCount: defaultCropCount(plant.ideal_space),
    growth: 0.55,
    scientificName: normalizeString(plant.scientific_name) || undefined,
    description: normalizeString(plant.description) || undefined,
    cropCategory: normalizeString(plant.crop_category) || undefined,
    lifeSpan: normalizeString(plant.life_span) || undefined,
    idealSpaceSqft: positiveNumber(plant.ideal_space),
    harvestCycles: positiveInteger(plant.yield_count),
    soilPhMin: finiteNumber(plant.soil_ph_min),
    soilPhMax: finiteNumber(plant.soil_ph_max),
    lightRequirement: normalizeString(plant.light_requirement) || undefined,
    soilTexture: normalizeString(plant.soil_texture) || undefined,
    waterConsumptionMl: finiteNumber(plant.water_consumption_ml),
    rainfallMaxMl: finiteNumber(plant.rainfall_max_ml),
    howToGrow: normalizeString(plant.how_to_grow) || undefined,
    insectControl: normalizeString(plant.insect_control) || undefined,
    tips: normalizeString(plant.tips) || undefined,
  };
}

function normalizeLivestock(animal: LivestockDocument) {
  const key = normalizeString(animal.livestock_id);
  const name = normalizeString(animal.name);
  if (!key || !name) return null;

  return {
    key,
    name,
    breed: "Mixed",
    breeds: ["Mixed"],
    defaultCount: defaultLivestockCount(animal.ideal_space),
    description: normalizeString(animal.description) || undefined,
    idealSpaceSqft: positiveNumber(animal.ideal_space),
    feed: normalizeString(animal.feed) || undefined,
    careInstructions: normalizeString(animal.care_instructions) || undefined,
    meatYield: finiteNumber(animal.meat_yield),
    yieldTypes: Array.isArray(animal.yield_types) ? animal.yield_types.map(normalizeString).filter(Boolean) : [],
    yieldFrequency: normalizeString(animal.yield_frequency) || undefined,
  };
}

function inferCropVisual(plant: PlantDocument): CropVisual {
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
