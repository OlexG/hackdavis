import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import {
  generateHomesteadPlan,
  type FarmPlannerCatalogItem,
  type FarmPlannerInput,
} from "@/lib/farm-planner";
import { AuthenticationError, requireUserSession } from "@/lib/auth";
import { getMongoDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

function getCatalogSeed(): FarmPlannerCatalogItem[] {
  return [
  cropSeed("tomatoes", "Tomatoes", "#4f9f52", "/inventory-icons/tomato.png", "tomato"),
  cropSeed("lettuce", "Lettuce", "#72b85b", "/inventory-icons/lettuce.png", "lettuce"),
  cropSeed("corn", "Corn", "#d5b84b", "/inventory-icons/corn.png", "corn"),
  cropSeed("potatoes", "Potatoes", "#9b7a4b", "/inventory-icons/potato.png", "potato"),
  cropSeed("strawberries", "Strawberries", "#5f9d58", "/inventory-icons/strawberry.png", "strawberry"),
  cropSeed("peas", "Peas", "#66ad63", "/inventory-icons/pea-pod.png", "pea"),
  cropSeed("mushrooms", "Mushrooms", "#b99067", "/inventory-icons/mushroom.png", "mushroom"),
  cropSeed("herbs", "Herbs", "#3f8b58", "/inventory-icons/lettuce.png", "herb"),
  cropSeed("pollinator-flowers", "Pollinator Flowers", "#9bb75d", "/inventory-icons/strawberry.png", "pollinator"),
  {
    slug: "chickens",
    type: "livestock",
    name: "Chickens",
    defaultSize: { width: 3, depth: 3, height: 1 },
    render: { model: "coop", color: "#d8ae48", label: "Chicken Run", iconPath: "/inventory-icons/egg.png" },
    livestockProfile: {
      species: "Chicken",
      feedCostPerHeadWeek: 1.8,
      eggsPerHeadWeek: 5,
      expectedPricePerEggDozen: 7,
      spaceSquareFeetPerHead: 8,
      waterGallonsPerHeadWeek: 1.8,
    },
  },
  {
    slug: "goats",
    type: "livestock",
    name: "Goats",
    defaultSize: { width: 4, depth: 4, height: 1.5 },
    render: { model: "goat_pen", color: "#b99a65", label: "Goat Pen", iconPath: "/inventory-icons/hammer.png" },
    livestockProfile: {
      species: "Goat",
      feedCostPerHeadWeek: 8,
      milkGallonsPerHeadWeek: 2.2,
      expectedPricePerMilkGallon: 10,
      spaceSquareFeetPerHead: 32,
      waterGallonsPerHeadWeek: 14,
    },
  },
  structureSeed("storage-shed", "Storage Shed", "#92704d", "storage"),
  structureSeed("greenhouse", "Greenhouse", "#74b8be", "greenhouse"),
  structureSeed("compost-bay", "Compost Bay", "#7a5a34", "compost"),
  structureSeed("farm-paths", "Walkable Paths", "#c7ad72", "other"),
  ];
}

function cropSeed(
  slug: string,
  name: string,
  color: string,
  iconPath: string,
  profileKey: keyof typeof cropProfiles,
): FarmPlannerCatalogItem {
  return {
    slug,
    type: "crop",
    name,
    defaultSize: { width: 1, depth: 1, height: 1 },
    render: { model: "voxel_crop", color, label: name, iconPath },
    cropProfile: cropProfiles[profileKey],
  };
}

function structureSeed(
  slug: string,
  name: string,
  color: string,
  structureType: "storage" | "greenhouse" | "compost" | "other",
): FarmPlannerCatalogItem {
  return {
    slug,
    type: "structure",
    name,
    defaultSize: { width: 3, depth: 3, height: structureType === "greenhouse" ? 2.4 : 1.6 },
    render: { model: structureType, color, label: name, iconPath: "/inventory-icons/hammer.png" },
    structureProfile: {
      structureType,
      storageCapacity: structureType === "storage" ? { amount: 240, unit: "lb" } : undefined,
    },
  };
}

const cropProfiles = {
  tomato: { idealSoilTypes: ["compost", "loam"], idealSun: "full", idealWater: "high", daysToGermination: [5, 10], daysToMaturity: [70, 85], harvestWindowDays: [75, 130], spacingInches: 24, yieldPerSquareFoot: 1.8, yieldUnit: "lb", expectedPricePerUnit: 4.5, failureRate: 0.08, waterGallonsPerSqFtWeek: 1.2 },
  lettuce: { idealSoilTypes: ["fine compost"], idealSun: "partial", idealWater: "medium", daysToGermination: [2, 8], daysToMaturity: [30, 55], harvestWindowDays: [35, 70], spacingInches: 10, yieldPerSquareFoot: 0.8, yieldUnit: "head", expectedPricePerUnit: 3, failureRate: 0.05, waterGallonsPerSqFtWeek: 0.8 },
  corn: { idealSoilTypes: ["rich soil"], idealSun: "full", idealWater: "medium", daysToGermination: [7, 10], daysToMaturity: [75, 100], harvestWindowDays: [85, 105], spacingInches: 12, yieldPerSquareFoot: 0.45, yieldUnit: "ear", expectedPricePerUnit: 1.25, failureRate: 0.1, waterGallonsPerSqFtWeek: 1 },
  potato: { idealSoilTypes: ["loose soil", "mulch"], idealSun: "full", idealWater: "medium", daysToGermination: [14, 28], daysToMaturity: [80, 110], harvestWindowDays: [90, 120], spacingInches: 12, yieldPerSquareFoot: 1.4, yieldUnit: "lb", expectedPricePerUnit: 2, failureRate: 0.07, waterGallonsPerSqFtWeek: 0.75 },
  strawberry: { idealSoilTypes: ["compost", "mulch"], idealSun: "full", idealWater: "medium", daysToGermination: [7, 21], daysToMaturity: [90, 120], harvestWindowDays: [100, 170], spacingInches: 12, yieldPerSquareFoot: 0.7, yieldUnit: "pint", expectedPricePerUnit: 5, failureRate: 0.06, waterGallonsPerSqFtWeek: 0.7 },
  pea: { idealSoilTypes: ["inoculated soil"], idealSun: "full", idealWater: "medium", daysToGermination: [7, 14], daysToMaturity: [55, 70], harvestWindowDays: [60, 90], spacingInches: 4, yieldPerSquareFoot: 0.45, yieldUnit: "lb", expectedPricePerUnit: 4, failureRate: 0.08, waterGallonsPerSqFtWeek: 0.65 },
  mushroom: { idealSoilTypes: ["wood-chip"], idealSun: "shade", idealWater: "medium", daysToGermination: [14, 30], daysToMaturity: [45, 90], harvestWindowDays: [60, 150], spacingInches: 8, yieldPerSquareFoot: 0.65, yieldUnit: "lb", expectedPricePerUnit: 8, failureRate: 0.12, waterGallonsPerSqFtWeek: 1.1 },
  herb: { idealSoilTypes: ["lean soil"], idealSun: "full", idealWater: "low", daysToGermination: [7, 21], daysToMaturity: [45, 70], harvestWindowDays: [50, 160], spacingInches: 8, yieldPerSquareFoot: 0.35, yieldUnit: "bunch", expectedPricePerUnit: 3, failureRate: 0.04, waterGallonsPerSqFtWeek: 0.35 },
  pollinator: { idealSoilTypes: ["native soil"], idealSun: "partial", idealWater: "low", daysToGermination: [7, 21], daysToMaturity: [60, 90], harvestWindowDays: [75, 180], spacingInches: 10, yieldPerSquareFoot: 0, yieldUnit: "bunch", expectedPricePerUnit: 0, failureRate: 0.03, waterGallonsPerSqFtWeek: 0.25 },
} as const satisfies Record<string, NonNullable<FarmPlannerCatalogItem["cropProfile"]>>;

export async function GET() {
  try {
    const db = await getMongoDb();
    const context = await ensureFarmContext();
    const plans = await db
      .collection("plans")
      .find({ userId: context.userId, farmId: context.farmId })
      .sort({ createdAt: -1 })
      .limit(8)
      .toArray();

    return NextResponse.json({
      plans: plans.map(serializeDocument),
    });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to load farm plans") },
      { status: error instanceof AuthenticationError ? 401 : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const input = normalizeInput(await request.json());
    const db = await getMongoDb();
    const context = await ensureFarmContext();
    const generated = generateHomesteadPlan(input, context.catalog);
    const now = new Date();
    const objects = generated.objects.map((object) => ({
      ...object,
      sourceId: context.catalogBySlug.get(object.slug)?._id ?? null,
    }));

    await db.collection("farms").updateOne(
      { _id: context.farmId },
      {
        $set: {
          bounds: generated.bounds,
          updatedAt: now,
        },
      },
    );

    const result = await db.collection("plans").insertOne({
      farmId: context.farmId,
      userId: context.userId,
      name: generated.name,
      status: "draft",
      version: 7,
      simulation: {
        startDate: now,
        currentDate: now,
        day: 0,
        timeOfDay: "09:00",
        season: "spring",
        speed: 1,
        paused: true,
      },
      baseGeometry: generated.baseGeometry,
      farmContext: generated.farmContext,
      tiles: generated.tiles,
      objects,
      analytics: generated.analytics,
      summary: generated.summary,
      generation: generated.generation,
      createdAt: now,
      updatedAt: now,
    });

    const plan = await db.collection("plans").findOne({ _id: result.insertedId });

    return NextResponse.json({ plan: serializeDocument(plan) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to generate farm plan") },
      { status: error instanceof AuthenticationError ? 401 : isRequestError(error) ? 400 : 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const planId = typeof body?.planId === "string" ? body.planId : "";
    const objects = Array.isArray(body?.objects) ? body.objects.map(normalizePlanObject).filter(Boolean) : null;

    if (!ObjectId.isValid(planId) || !objects) {
      throw new Error("Invalid plan edit request");
    }

    const db = await getMongoDb();
    const context = await ensureFarmContext();
    const now = new Date();

    await db.collection("plans").updateOne(
      { _id: new ObjectId(planId), userId: context.userId, farmId: context.farmId },
      {
        $set: {
          objects,
          updatedAt: now,
        },
      },
    );

    const plan = await db.collection("plans").findOne({ _id: new ObjectId(planId), userId: context.userId });

    return NextResponse.json({ plan: serializeDocument(plan) });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to save farm plan edits") },
      { status: error instanceof AuthenticationError ? 401 : isRequestError(error) ? 400 : 500 },
    );
  }
}

async function ensureFarmContext() {
  const db = await getMongoDb();
  const currentUser = await requireUserSession();
  const now = new Date();

  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("users").createIndex({ username: 1 }, { unique: true, sparse: true }),
    db.collection("profiles").createIndex({ userId: 1 }, { unique: true }),
    db.collection("catalog_items").createIndex({ type: 1, slug: 1 }, { unique: true }),
    db.collection("farms").createIndex({ userId: 1 }),
    db.collection("plans").createIndex({ userId: 1, farmId: 1, createdAt: -1 }),
  ]);

  await db.collection("profiles").updateOne(
    { userId: currentUser.userId },
    {
      $setOnInsert: {
        displayName: currentUser.displayName,
        bio: "Generated for local farm planning.",
        avatarUrl: null,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  const catalog = [];
  const catalogBySlug = new Map<string, FarmPlannerCatalogItem & { _id: ObjectId }>();

  for (const item of getCatalogSeed()) {
    const saved = await db.collection("catalog_items").findOneAndUpdate(
      { type: item.type, slug: item.slug },
      {
        $set: { ...item, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );

    if (saved) {
      const catalogItem = {
        _id: saved._id,
        sourceId: saved._id,
        slug: saved.slug,
        type: saved.type,
        name: saved.name,
        defaultSize: saved.defaultSize,
        render: saved.render,
        cropProfile: saved.cropProfile,
        livestockProfile: saved.livestockProfile,
        structureProfile: saved.structureProfile,
      } satisfies FarmPlannerCatalogItem & { _id: ObjectId };

      catalog.push(catalogItem);
      catalogBySlug.set(catalogItem.slug, catalogItem);
    }
  }

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
        bounds: { width: 24, depth: 18, height: 8 },
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!farm) {
    throw new Error("Unable to create farm");
  }

  await db.collection("plans").deleteMany({
    userId: currentUser.userId,
    farmId: farm._id,
    $or: [
      { version: { $lt: 7 } },
      { tiles: { $exists: false } },
      { tiles: { $size: 0 } },
    ],
  });

  return {
    userId: currentUser.userId,
    farmId: farm._id as ObjectId,
    catalog,
    catalogBySlug,
  };
}

function normalizeInput(raw: unknown): FarmPlannerInput {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid farm plan request");
  }

  const candidate = raw as Partial<FarmPlannerInput>;
  const weatherProfile = oneOf(candidate.weatherProfile, ["temperate", "dry", "wet", "cold"], "temperate");
  const strategy = oneOf(candidate.strategy, ["balanced", "food", "livestock", "low-maintenance"], "balanced");
  const locationLabel =
    typeof candidate.locationLabel === "string" && candidate.locationLabel.trim()
      ? candidate.locationLabel.trim().slice(0, 120)
      : "Davis, California";
  const points = Array.isArray(candidate.points)
    ? candidate.points
        .map((point) => ({
          x: Number(point?.x),
          y: Number(point?.y),
          lat: Number.isFinite(Number(point?.lat)) ? Number(point?.lat) : undefined,
          lng: Number.isFinite(Number(point?.lng)) ? Number(point?.lng) : undefined,
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        .slice(0, 12)
    : [];

  if (points.length < 4) {
    throw new Error("Draw at least four boundary points before generating a plan");
  }

  return {
    points,
    locationLabel,
    weatherProfile,
    strategy,
    includeLivestock: candidate.includeLivestock !== false,
    includeStructures: candidate.includeStructures !== false,
  };
}

function normalizePlanObject(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const type = oneOf(candidate.type, ["crop", "livestock", "structure"], "structure");
  const instanceId = typeof candidate.instanceId === "string" && candidate.instanceId.trim()
    ? candidate.instanceId.trim().slice(0, 80)
    : `manual_${type}_${Date.now()}`;
  const slug = typeof candidate.slug === "string" && candidate.slug.trim() ? candidate.slug.trim().slice(0, 80) : `manual-${type}`;
  const displayName = typeof candidate.displayName === "string" && candidate.displayName.trim()
    ? candidate.displayName.trim().slice(0, 120)
    : `Manual ${type}`;
  const position = normalizeVector(candidate.position, { x: 0, y: 0, z: 0 });
  const size = normalizeSize(candidate.size, { width: 1, depth: 1, height: 1 });
  const geometry = normalizeGeometry(candidate.geometry, size);

  return {
    ...candidate,
    instanceId,
    type,
    slug,
    displayName,
    status: oneOf(candidate.status, ["planned", "active", "removed", "optional"], "planned"),
    sourceId: typeof candidate.sourceId === "string" && ObjectId.isValid(candidate.sourceId) ? new ObjectId(candidate.sourceId) : null,
    position,
    rotation: normalizeVector(candidate.rotation, { x: 0, y: 0, z: 0 }),
    size,
    geometry,
    areaSquareFeet: Number.isFinite(Number(candidate.areaSquareFeet))
      ? Math.max(1, Math.round(Number(candidate.areaSquareFeet)))
      : geometry.areaSquareFeet,
    renderOverrides: typeof candidate.renderOverrides === "object" && candidate.renderOverrides
      ? candidate.renderOverrides
      : { model: type, color: type === "crop" ? "#6e9f45" : type === "livestock" ? "#d8ae48" : "#92704d", label: displayName },
    notes: typeof candidate.notes === "string" ? candidate.notes.slice(0, 500) : undefined,
    crop: type === "crop" && typeof candidate.crop === "object" ? candidate.crop : undefined,
    livestock: type === "livestock" && typeof candidate.livestock === "object" ? candidate.livestock : undefined,
    structure: type === "structure" && typeof candidate.structure === "object" ? candidate.structure : undefined,
    costBreakdown: typeof candidate.costBreakdown === "object" ? candidate.costBreakdown : undefined,
    recurringCost: typeof candidate.recurringCost === "object" ? candidate.recurringCost : undefined,
    revenue: typeof candidate.revenue === "object" ? candidate.revenue : undefined,
    waterGallonsPerWeek: Number.isFinite(Number(candidate.waterGallonsPerWeek)) ? Number(candidate.waterGallonsPerWeek) : undefined,
  };
}

function normalizeGeometry(raw: unknown, size: { width: number; depth: number; height: number }) {
  const fallbackPoints = [
    { x: -size.width / 2, y: -size.depth / 2 },
    { x: size.width / 2, y: -size.depth / 2 },
    { x: size.width / 2, y: size.depth / 2 },
    { x: -size.width / 2, y: size.depth / 2 },
  ];
  const points = raw && typeof raw === "object" && Array.isArray((raw as { points?: unknown[] }).points)
    ? (raw as { points: unknown[] }).points
        .map((point) => ({
          x: Number((point as { x?: unknown })?.x),
          y: Number((point as { y?: unknown })?.y),
        }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
        .slice(0, 16)
    : fallbackPoints;

  return {
    points: points.length >= 3 ? points : fallbackPoints,
    areaSquareFeet: Math.max(1, Math.round(Math.abs(pointsArea(points.length >= 3 ? points : fallbackPoints)))),
  };
}

function normalizeVector(raw: unknown, fallback: { x: number; y: number; z: number }) {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};

  return {
    x: Number.isFinite(Number(value.x)) ? Number(value.x) : fallback.x,
    y: Number.isFinite(Number(value.y)) ? Number(value.y) : fallback.y,
    z: Number.isFinite(Number(value.z)) ? Number(value.z) : fallback.z,
  };
}

function normalizeSize(raw: unknown, fallback: { width: number; depth: number; height: number }) {
  const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};

  return {
    width: Number.isFinite(Number(value.width)) ? Math.max(1, Number(value.width)) : fallback.width,
    depth: Number.isFinite(Number(value.depth)) ? Math.max(1, Number(value.depth)) : fallback.depth,
    height: Number.isFinite(Number(value.height)) ? Math.max(0.1, Number(value.height)) : fallback.height,
  };
}

function pointsArea(points: { x: number; y: number }[]) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function oneOf<const T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
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
  return error instanceof Error && error.message.includes("Draw at least four boundary points");
}
