import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.local" });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

if (!uri) {
  throw new Error("Missing MONGODB_URI in .env.local");
}

if (!dbName) {
  throw new Error("Missing MONGODB_DB in .env.local");
}

const now = new Date();
const testUser = {
  email: "test@gmail.com",
  password: "test1234",
  displayName: "Test Farmer",
};

const catalogItems = [
  {
    slug: "tomatoes",
    type: "crop",
    name: "Tomatoes",
    defaultSize: { width: 1, depth: 1, height: 1 },
    render: {
      model: "plant",
      color: "#4CAF50",
      label: "Tomatoes",
    },
    growthStages: [
      {
        name: "seedling",
        minAgeDays: 0,
        maxAgeDays: 14,
        render: {
          model: "sprout",
          color: "#7CB342",
          label: "Tomato Seedlings",
          heightMultiplier: 0.25,
        },
      },
      {
        name: "growing",
        minAgeDays: 15,
        maxAgeDays: 45,
        render: {
          model: "plant",
          color: "#4CAF50",
          label: "Growing Tomatoes",
          heightMultiplier: 0.7,
        },
      },
      {
        name: "fruiting",
        minAgeDays: 46,
        maxAgeDays: 90,
        render: {
          model: "tomato_plant_fruiting",
          color: "#388E3C",
          fruitColor: "#E53935",
          label: "Fruiting Tomatoes",
          heightMultiplier: 1,
        },
      },
    ],
  },
  {
    slug: "lettuce",
    type: "crop",
    name: "Lettuce",
    defaultSize: { width: 0.75, depth: 0.75, height: 0.4 },
    render: {
      model: "leafy_plant",
      color: "#66BB6A",
      label: "Lettuce",
    },
    growthStages: [
      {
        name: "sprout",
        minAgeDays: 0,
        maxAgeDays: 10,
        render: {
          model: "sprout",
          color: "#81C784",
          label: "Lettuce Sprouts",
          heightMultiplier: 0.25,
        },
      },
      {
        name: "harvest_ready",
        minAgeDays: 11,
        maxAgeDays: 55,
        render: {
          model: "leafy_plant",
          color: "#43A047",
          label: "Harvest Ready Lettuce",
          heightMultiplier: 1,
        },
      },
    ],
  },
  {
    slug: "chickens",
    type: "livestock",
    name: "Chickens",
    defaultSize: { width: 3, depth: 3, height: 1 },
    render: {
      model: "coop",
      color: "#F4C542",
      label: "Chicken Coop",
    },
    lifeStages: [
      {
        name: "chick",
        minAgeDays: 0,
        maxAgeDays: 42,
        render: {
          model: "chick",
          color: "#F4C542",
          label: "Chicks",
          scale: 0.4,
        },
      },
      {
        name: "adult",
        minAgeDays: 43,
        maxAgeDays: null,
        render: {
          model: "chicken",
          color: "#F4C542",
          label: "Adult Chickens",
          scale: 1,
        },
      },
    ],
    dailyBehavior: [
      {
        from: "06:00",
        to: "18:00",
        animation: "wandering",
        visibleIn: "yard",
      },
      {
        from: "18:00",
        to: "06:00",
        animation: "resting",
        visibleIn: "coop",
      },
    ],
  },
  {
    slug: "goats",
    type: "livestock",
    name: "Goats",
    defaultSize: { width: 4, depth: 4, height: 1.5 },
    render: {
      model: "goat_pen",
      color: "#C2A878",
      label: "Goat Pen",
    },
    lifeStages: [
      {
        name: "kid",
        minAgeDays: 0,
        maxAgeDays: 120,
        render: {
          model: "young_goat",
          color: "#D7C3A3",
          label: "Young Goats",
          scale: 0.55,
        },
      },
      {
        name: "adult",
        minAgeDays: 121,
        maxAgeDays: null,
        render: {
          model: "goat",
          color: "#C2A878",
          label: "Adult Goats",
          scale: 1,
        },
      },
    ],
    dailyBehavior: [
      {
        from: "07:00",
        to: "19:00",
        animation: "grazing",
        visibleIn: "pasture",
      },
      {
        from: "19:00",
        to: "07:00",
        animation: "resting",
        visibleIn: "shelter",
      },
    ],
  },
];

const inventoryItems = [
  {
    name: "Sun Gold tomatoes",
    category: "harvest",
    status: "ready",
    quantity: { amount: 7.5, unit: "lb" },
    location: "cool pantry crate",
    source: "south trellis",
    notes: "Sort into market pints tonight; keep blemished fruit for sauce.",
    color: "#e9783a",
    useBy: new Date("2026-05-14T07:00:00.000Z"),
    acquiredAt: new Date("2026-05-09T07:00:00.000Z"),
  },
  {
    name: "Butter lettuce heads",
    category: "harvest",
    status: "ready",
    quantity: { amount: 12, unit: "heads" },
    location: "wash station",
    source: "shade bed A",
    notes: "Hydrocool before neighborhood swap pickup.",
    color: "#65a95a",
    useBy: new Date("2026-05-11T07:00:00.000Z"),
    acquiredAt: new Date("2026-05-09T07:00:00.000Z"),
  },
  {
    name: "Glass gem corn seed",
    category: "seeds",
    status: "stocked",
    quantity: { amount: 86, unit: "seeds" },
    reorderAt: 24,
    location: "seed library drawer 02",
    source: "saved seed",
    notes: "Dry, labeled, and ready for the summer block.",
    color: "#d7b64b",
    acquiredAt: new Date("2026-04-18T07:00:00.000Z"),
  },
  {
    name: "Basil starts",
    category: "starts",
    status: "stocked",
    quantity: { amount: 18, unit: "plants" },
    reorderAt: 6,
    location: "greenhouse bench",
    source: "propagation tray 4",
    notes: "Pinch tips before moving to the herb spiral.",
    color: "#3f8b58",
    acquiredAt: new Date("2026-05-01T07:00:00.000Z"),
  },
  {
    name: "Layer feed",
    category: "feed",
    status: "low",
    quantity: { amount: 18, unit: "lb" },
    reorderAt: 20,
    location: "sealed bin by coop",
    source: "Davis co-op",
    notes: "Below reorder line; add oyster shell to next run.",
    color: "#b0834b",
    acquiredAt: new Date("2026-04-26T07:00:00.000Z"),
  },
  {
    name: "Finished compost",
    category: "amendments",
    status: "stocked",
    quantity: { amount: 5, unit: "carts" },
    reorderAt: 2,
    location: "bay three",
    source: "home cycle",
    notes: "Screened and warm; reserve two carts for pepper bed.",
    color: "#6f8f55",
    acquiredAt: new Date("2026-05-02T07:00:00.000Z"),
  },
  {
    name: "Drip repair kit",
    category: "tools",
    status: "stocked",
    quantity: { amount: 1, unit: "kit" },
    location: "tool wall cubby",
    source: "farm shed",
    notes: "Emitters, goof plugs, punch, and two couplers.",
    color: "#48b9df",
    acquiredAt: new Date("2026-03-20T07:00:00.000Z"),
  },
  {
    name: "Strawberry basil jam",
    category: "preserves",
    status: "curing",
    quantity: { amount: 9, unit: "jars" },
    location: "pantry shelf B",
    source: "spring berry flush",
    notes: "Set aside three jars for crop-swap bundles.",
    color: "#c95b76",
    useBy: new Date("2026-11-09T08:00:00.000Z"),
    acquiredAt: new Date("2026-05-07T07:00:00.000Z"),
  },
  {
    name: "Nest box herbs",
    category: "livestock",
    status: "low",
    quantity: { amount: 3, unit: "bundles" },
    reorderAt: 4,
    location: "coop shelf",
    source: "mint and lavender bed",
    notes: "Dry another batch before the weekend cleanout.",
    color: "#8a6f3f",
    acquiredAt: new Date("2026-05-05T07:00:00.000Z"),
  },
];

async function ensureIndexes(db) {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("profiles").createIndex({ userId: 1 }, { unique: true }),
    db.collection("catalog_items").createIndex({ type: 1, slug: 1 }, { unique: true }),
    db.collection("farms").createIndex({ userId: 1 }),
    db.collection("plans").createIndex({ userId: 1, farmId: 1 }),
    db.collection("inventory_items").createIndex({ userId: 1, category: 1, status: 1 }),
    db.collection("inventory_items").createIndex({ userId: 1, name: 1 }, { unique: true }),
    db.collection("shop_displays").createIndex({ userId: 1 }, { unique: true }),
  ]);
}

async function seed() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    await ensureIndexes(db);

    const passwordHash = await bcrypt.hash(testUser.password, 12);
    const userResult = await db.collection("users").findOneAndUpdate(
      { email: testUser.email },
      {
        $set: {
          email: testUser.email,
          passwordHash,
          role: "user",
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    const user = userResult;

    await db.collection("profiles").updateOne(
      { userId: user._id },
      {
        $set: {
          displayName: testUser.displayName,
          bio: "Seeded profile for local development.",
          updatedAt: now,
        },
        $setOnInsert: {
          userId: user._id,
          avatarUrl: null,
          createdAt: now,
        },
      },
      { upsert: true },
    );

    const catalogBySlug = new Map();

    for (const item of catalogItems) {
      const result = await db.collection("catalog_items").findOneAndUpdate(
        { type: item.type, slug: item.slug },
        {
          $set: {
            ...item,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: "after" },
      );

      catalogBySlug.set(item.slug, result);
    }

    const farmResult = await db.collection("farms").findOneAndUpdate(
      { userId: user._id, name: "Test Backyard Farm" },
      {
        $set: {
          userId: user._id,
          name: "Test Backyard Farm",
          units: "meters",
          bounds: {
            width: 24,
            depth: 18,
            height: 8,
          },
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    const farm = farmResult;
    const tomatoes = catalogBySlug.get("tomatoes");
    const lettuce = catalogBySlug.get("lettuce");
    const chickens = catalogBySlug.get("chickens");

    for (const item of inventoryItems) {
      await db.collection("inventory_items").findOneAndUpdate(
        { userId: user._id, name: item.name },
        {
          $set: {
            ...item,
            userId: user._id,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: "after" },
      );
    }

    await db.collection("plans").findOneAndUpdate(
      { farmId: farm._id, userId: user._id, name: "Balanced Test Plan" },
      {
        $set: {
          farmId: farm._id,
          userId: user._id,
          name: "Balanced Test Plan",
          status: "draft",
          version: 1,
          simulation: {
            startDate: new Date("2026-05-09T00:00:00.000Z"),
            currentDate: new Date("2026-06-01T08:00:00.000Z"),
            day: 23,
            timeOfDay: "08:00",
            season: "spring",
            speed: 1,
            paused: true,
          },
          objects: [
            {
              instanceId: "tomatoes_01",
              type: "crop",
              slug: "tomatoes",
              sourceId: tomatoes._id,
              displayName: "Tomato Bed",
              status: "planned",
              plantedAtDay: 0,
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              size: tomatoes.defaultSize,
              renderOverrides: {},
              notes: "Seeded tomato crop for simulation testing.",
            },
            {
              instanceId: "lettuce_01",
              type: "crop",
              slug: "lettuce",
              sourceId: lettuce._id,
              displayName: "Lettuce Bed",
              status: "planned",
              plantedAtDay: 10,
              position: { x: 2, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              size: lettuce.defaultSize,
              renderOverrides: {},
            },
            {
              instanceId: "chickens_01",
              type: "livestock",
              slug: "chickens",
              sourceId: chickens._id,
              displayName: "Chicken Coop",
              status: "planned",
              addedAtDay: 0,
              ageDaysAtStart: 60,
              position: { x: 7, y: 0, z: 4 },
              rotation: { x: 0, y: 90, z: 0 },
              size: chickens.defaultSize,
              renderOverrides: {},
              notes: "Adults during the seeded simulation date.",
            },
          ],
          summary: {
            description: "A compact starter farm with crop beds separated from the chicken area.",
            highlights: [
              "Tomatoes and lettuce have lifecycle stages for time simulation.",
              "Chickens switch between daytime wandering and nighttime coop behavior.",
              "Objects include planted/added days for deterministic simulation playback.",
            ],
            maintenanceLevel: "low",
          },
          generation: {
            strategy: "balanced",
            prompt: "Create a small balanced 3D farm with tomatoes, lettuce, and chickens.",
            constraints: {
              maxWidthMeters: 24,
              maxDepthMeters: 18,
              separateLivestockFromCrops: true,
            },
            score: 0.84,
          },
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    console.log(`Seeded ${dbName} for ${testUser.email}`);
  } finally {
    await client.close();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
