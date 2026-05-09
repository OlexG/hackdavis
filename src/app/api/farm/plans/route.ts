import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import {
  generateHomesteadPlan,
  type FarmPlannerCatalogItem,
  type FarmPlannerInput,
} from "@/lib/farm-planner";
import { getMongoDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

const demoUser = {
  email: "test@gmail.com",
  displayName: "Test Farmer",
};

const catalogSeed: FarmPlannerCatalogItem[] = [
  {
    slug: "tomatoes",
    type: "crop",
    name: "Tomatoes",
    defaultSize: { width: 1, depth: 1, height: 1 },
    render: { model: "plant", color: "#4f9f52", label: "Tomatoes", iconPath: "/inventory-icons/tomato.png" },
  },
  {
    slug: "lettuce",
    type: "crop",
    name: "Lettuce",
    defaultSize: { width: 0.75, depth: 0.75, height: 0.4 },
    render: { model: "leafy_plant", color: "#72b85b", label: "Lettuce", iconPath: "/inventory-icons/lettuce.png" },
  },
  {
    slug: "corn",
    type: "crop",
    name: "Corn",
    defaultSize: { width: 1, depth: 1, height: 1.8 },
    render: { model: "corn", color: "#d5b84b", label: "Corn", iconPath: "/inventory-icons/corn.png" },
  },
  {
    slug: "potatoes",
    type: "crop",
    name: "Potatoes",
    defaultSize: { width: 1, depth: 1, height: 0.55 },
    render: { model: "root_crop", color: "#9b7a4b", label: "Potatoes", iconPath: "/inventory-icons/potato.png" },
  },
  {
    slug: "strawberries",
    type: "crop",
    name: "Strawberries",
    defaultSize: { width: 1, depth: 1, height: 0.45 },
    render: { model: "berry_crop", color: "#5f9d58", label: "Strawberries", iconPath: "/inventory-icons/strawberry.png" },
  },
  {
    slug: "peas",
    type: "crop",
    name: "Peas",
    defaultSize: { width: 1, depth: 1, height: 1.2 },
    render: { model: "vine_crop", color: "#66ad63", label: "Peas", iconPath: "/inventory-icons/pea-pod.png" },
  },
  {
    slug: "mushrooms",
    type: "crop",
    name: "Mushrooms",
    defaultSize: { width: 1, depth: 1, height: 0.35 },
    render: { model: "mushroom_bed", color: "#b99067", label: "Mushrooms", iconPath: "/inventory-icons/mushroom.png" },
  },
  {
    slug: "herbs",
    type: "crop",
    name: "Herbs",
    defaultSize: { width: 1, depth: 1, height: 0.65 },
    render: { model: "herb_bed", color: "#3f8b58", label: "Herbs", iconPath: "/inventory-icons/lettuce.png" },
  },
  {
    slug: "pollinator-flowers",
    type: "crop",
    name: "Pollinator Flowers",
    defaultSize: { width: 1, depth: 1, height: 0.8 },
    render: { model: "flower_bed", color: "#9bb75d", label: "Pollinator Flowers", iconPath: "/inventory-icons/strawberry.png" },
  },
  {
    slug: "chickens",
    type: "livestock",
    name: "Chickens",
    defaultSize: { width: 3, depth: 3, height: 1 },
    render: { model: "coop", color: "#d8ae48", label: "Chicken Coop" },
  },
  {
    slug: "goats",
    type: "livestock",
    name: "Goats",
    defaultSize: { width: 4, depth: 4, height: 1.5 },
    render: { model: "goat_pen", color: "#b99a65", label: "Goat Pen" },
  },
];

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
      { status: 500 },
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
      version: 4,
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
      tiles: generated.tiles,
      objects,
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
      { status: isRequestError(error) ? 400 : 500 },
    );
  }
}

async function ensureFarmContext() {
  const db = await getMongoDb();
  const now = new Date();

  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("profiles").createIndex({ userId: 1 }, { unique: true }),
    db.collection("catalog_items").createIndex({ type: 1, slug: 1 }, { unique: true }),
    db.collection("farms").createIndex({ userId: 1 }),
    db.collection("plans").createIndex({ userId: 1, farmId: 1, createdAt: -1 }),
  ]);

  const user = await db.collection("users").findOneAndUpdate(
    { email: demoUser.email },
    {
      $set: { email: demoUser.email, role: "user", updatedAt: now },
      $setOnInsert: {
        passwordHash: "development-placeholder",
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!user) {
    throw new Error("Unable to create demo user");
  }

  await db.collection("profiles").updateOne(
    { userId: user._id },
    {
      $set: { displayName: demoUser.displayName, updatedAt: now },
      $setOnInsert: { bio: "Generated for local farm planning.", avatarUrl: null, createdAt: now },
    },
    { upsert: true },
  );

  const catalog = [];
  const catalogBySlug = new Map<string, FarmPlannerCatalogItem & { _id: ObjectId }>();

  for (const item of catalogSeed) {
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
      } satisfies FarmPlannerCatalogItem & { _id: ObjectId };

      catalog.push(catalogItem);
      catalogBySlug.set(catalogItem.slug, catalogItem);
    }
  }

  const farm = await db.collection("farms").findOneAndUpdate(
    { userId: user._id, name: "Drawn Homestead Site" },
    {
      $set: {
        userId: user._id,
        name: "Drawn Homestead Site",
        units: "meters",
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
    throw new Error("Unable to create demo farm");
  }

  await db.collection("plans").deleteMany({
    userId: user._id,
    farmId: farm._id,
    $or: [
      { version: { $lt: 4 } },
      { tiles: { $exists: false } },
      { tiles: { $size: 0 } },
    ],
  });

  return {
    userId: user._id as ObjectId,
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

  return { points, locationLabel, weatherProfile, strategy };
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
