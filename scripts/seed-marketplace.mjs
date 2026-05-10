import dotenv from "dotenv";
import { MongoClient } from "mongodb";

// Load .env first (the user's main config), then .env.local can override.
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

if (!uri) {
  throw new Error("Missing MONGODB_URI in .env");
}

if (!dbName) {
  throw new Error("Missing MONGODB_DB in .env");
}

const now = new Date();

// UC Davis main campus is roughly 38.5382 N, -121.7617 W. Each farm sits a
// short drive from there so the map markers cluster nicely around the campus.
const farms = [
  {
    slug: "riverbend",
    name: "Riverbend Microfarm",
    shortName: "RB",
    distance: "0.8 mi",
    neighborhood: "Putah Creek edge",
    response: "Replies in about 18 min",
    rating: 4.9,
    reviews: 128,
    // GeoJSON: [longitude, latitude]
    location: { type: "Point", coordinates: [-121.7510, 38.5290] },
    coordinates: { x: 28, y: 32, latitude: 38.5290, longitude: -121.7510 },
    ratings: { quality: 4.9, fairness: 4.8, pickup: 4.7 },
    sortOrder: 10,
    offerings: [
      {
        slug: "sungold-tomatoes",
        name: "Sungold tomato basket",
        category: "harvest",
        amount: 18,
        unit: "lb",
        priceCents: 550,
        signText: "Sun-warmed and ready",
        icon: "tomato",
        color: "#e9503f",
      },
      {
        slug: "duck-eggs",
        name: "Pasture duck eggs",
        category: "eggs",
        amount: 9,
        unit: "dozen",
        priceCents: 800,
        signText: "Big yolks from the splash yard",
        icon: "egg",
        color: "#68b8c9",
      },
      {
        slug: "basil-starts",
        name: "Genovese basil starts",
        category: "starts",
        amount: 24,
        unit: "pots",
        priceCents: 300,
        signText: "Hardened off for raised beds",
        icon: "lettuce",
        color: "#4e9f5d",
      },
    ],
  },
  {
    slug: "west-orchard",
    name: "West Orchard Cooperative",
    shortName: "WO",
    distance: "1.6 mi",
    neighborhood: "West Davis",
    response: "Replies in about 31 min",
    rating: 4.8,
    reviews: 94,
    location: { type: "Point", coordinates: [-121.7790, 38.5520] },
    coordinates: { x: 62, y: 24, latitude: 38.5520, longitude: -121.7790 },
    ratings: { quality: 4.8, fairness: 4.9, pickup: 4.6 },
    sortOrder: 20,
    offerings: [
      {
        slug: "early-peaches",
        name: "Early peach crate",
        category: "harvest",
        amount: 12,
        unit: "crates",
        priceCents: 2100,
        signText: "Jam ripe, pie ready",
        icon: "strawberry",
        color: "#e9823a",
      },
      {
        slug: "pollinator-honey",
        name: "Pollinator row honey",
        category: "preserves",
        amount: 16,
        unit: "jars",
        priceCents: 1100,
        signText: "Small-batch pantry jars",
        icon: "pea",
        color: "#f2bd4b",
      },
      {
        slug: "herb-bundles",
        name: "Kitchen herb bundles",
        category: "harvest",
        amount: 30,
        unit: "bundles",
        priceCents: 500,
        signText: "Mint, thyme, oregano, chives",
        icon: "lettuce",
        color: "#7eb56b",
      },
    ],
  },
  {
    slug: "solar-acre",
    name: "Solar Acre Ranch",
    shortName: "SA",
    distance: "2.1 mi",
    neighborhood: "North Covell",
    response: "Replies in about 12 min",
    rating: 4.7,
    reviews: 73,
    location: { type: "Point", coordinates: [-121.7460, 38.5650] },
    coordinates: { x: 44, y: 62, latitude: 38.5650, longitude: -121.7460 },
    ratings: { quality: 4.7, fairness: 4.6, pickup: 4.8 },
    sortOrder: 30,
    offerings: [
      {
        slug: "goat-milk",
        name: "Dwarf goat milk",
        category: "dairy",
        amount: 10,
        unit: "half-gal",
        priceCents: 900,
        signText: "Chilled same day",
        icon: "egg",
        color: "#c9823e",
      },
      {
        slug: "hen-pullets",
        name: "Heritage hen pullets",
        category: "livestock",
        amount: 6,
        unit: "birds",
        priceCents: 2800,
        signText: "Friendly started pullets",
        icon: "egg",
        color: "#f2bd4b",
      },
      {
        slug: "blue-corn",
        name: "Blue corn meal",
        category: "preserves",
        amount: 22,
        unit: "bags",
        priceCents: 750,
        signText: "Stone-ground low-water corn",
        icon: "corn",
        color: "#7067c7",
      },
    ],
  },
  {
    slug: "oakshade",
    name: "Oakshade Gardens",
    shortName: "OG",
    distance: "3.4 mi",
    neighborhood: "South Davis",
    response: "Replies in about 42 min",
    rating: 4.6,
    reviews: 57,
    location: { type: "Point", coordinates: [-121.7350, 38.5250] },
    coordinates: { x: 74, y: 68, latitude: 38.5250, longitude: -121.7350 },
    ratings: { quality: 4.6, fairness: 4.7, pickup: 4.4 },
    sortOrder: 40,
    offerings: [
      {
        slug: "lacinato-kale",
        name: "Lacinato kale bunches",
        category: "harvest",
        amount: 36,
        unit: "bunches",
        priceCents: 400,
        signText: "Crisp morning harvest",
        icon: "lettuce",
        color: "#2f6f4e",
      },
      {
        slug: "rabbit-compost",
        name: "Rabbit compost blend",
        category: "livestock",
        amount: 18,
        unit: "bags",
        priceCents: 600,
        signText: "Screened for soil blocks",
        icon: "mushroom",
        color: "#9b7a4b",
      },
      {
        slug: "medicinal-tea",
        name: "Medicinal tea herbs",
        category: "preserves",
        amount: 20,
        unit: "pouches",
        priceCents: 650,
        signText: "Tulsi, mint, calendula",
        icon: "pea",
        color: "#c95b76",
      },
    ],
  },
];

async function seed() {
  const client = new MongoClient(uri);
  const collection = client.db(dbName).collection("Farms");

  try {
    await client.connect();

    // Unique slug + a 2dsphere index on location so we can do $near later.
    await collection.createIndex({ slug: 1 }, { unique: true });
    await collection.createIndex({ location: "2dsphere" });

    for (const farm of farms) {
      await collection.findOneAndUpdate(
        { slug: farm.slug },
        {
          $set: { ...farm, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true, returnDocument: "after" },
      );
    }

    const total = await collection.countDocuments({});
    console.log(
      `Upserted ${farms.length} farms into ${dbName}.Farms (total docs in collection: ${total})`,
    );
  } finally {
    await client.close();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
