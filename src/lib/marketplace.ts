import "server-only";

import type { ObjectId } from "mongodb";

import { getMongoDb } from "@/lib/mongodb";

export type MarketCategory =
  | "harvest"
  | "preserves"
  | "livestock"
  | "eggs"
  | "dairy"
  | "starts";

export type MarketRatingProfile = {
  quality: number;
  fairness: number;
  pickup: number;
};

export type MarketIcon =
  | "corn"
  | "egg"
  | "hammer"
  | "lettuce"
  | "mushroom"
  | "pea"
  | "potato"
  | "strawberry"
  | "tomato";

export type MarketOffering = {
  id: string;
  name: string;
  category: MarketCategory;
  amount: number;
  unit: string;
  priceCents: number;
  signText: string;
  icon: MarketIcon;
  color: string;
};

export type MarketFarm = {
  id: string;
  name: string;
  shortName: string;
  distance: string;
  neighborhood: string;
  response: string;
  rating: number;
  reviews: number;
  // GeoJSON Point: [longitude, latitude]
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  coordinates: {
    x: number;
    y: number;
    latitude: number;
    longitude: number;
  };
  ratings: MarketRatingProfile;
  offerings: MarketOffering[];
};

type FarmDocument = {
  _id: ObjectId;
  slug: string;
  name: string;
  shortName: string;
  distance: string;
  neighborhood: string;
  response: string;
  rating: number;
  reviews: number;
  // GeoJSON Point: coordinates is [longitude, latitude] per the spec.
  // 2dsphere-indexable so Mongo can do $near / $geoWithin queries.
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  // Legacy lat/lng helpers + the screen-space x/y the mobile UI uses for
  // the cartoon view. Kept alongside `location` for backwards compatibility.
  coordinates: {
    x: number;
    y: number;
    latitude: number;
    longitude: number;
  };
  ratings: MarketRatingProfile;
  offerings: Array<{
    slug: string;
    name: string;
    category: MarketCategory;
    amount: number;
    unit: string;
    priceCents: number;
    signText: string;
    icon: MarketIcon;
    color: string;
  }>;
  sortOrder?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type MarketplaceSnapshot = {
  source: "mongodb" | "fallback";
  fetchedAt: string;
  center: { latitude: number; longitude: number };
  farms: MarketFarm[];
};

const fallbackFarms: MarketFarm[] = [
  {
    id: "riverbend",
    name: "Riverbend Microfarm",
    shortName: "RB",
    distance: "0.8 mi",
    neighborhood: "Putah Creek edge",
    response: "Replies in about 18 min",
    rating: 4.9,
    reviews: 128,
    location: { type: "Point", coordinates: [-121.7510, 38.5290] },
    coordinates: { x: 28, y: 32, latitude: 38.5290, longitude: -121.7510 },
    ratings: { quality: 4.9, fairness: 4.8, pickup: 4.7 },
    offerings: [
      {
        id: "sungold-tomatoes",
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
        id: "duck-eggs",
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
        id: "basil-starts",
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
    id: "west-orchard",
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
    offerings: [
      {
        id: "early-peaches",
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
        id: "pollinator-honey",
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
        id: "herb-bundles",
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
    id: "solar-acre",
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
    offerings: [
      {
        id: "goat-milk",
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
        id: "hen-pullets",
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
        id: "blue-corn",
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
    id: "oakshade",
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
    offerings: [
      {
        id: "lacinato-kale",
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
        id: "rabbit-compost",
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
        id: "medicinal-tea",
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

const davisCenter = { latitude: 38.5449, longitude: -121.7405 };

// Read-only: this function never writes to MongoDB. If the collection is
// empty we just return an empty list. The bundled `fallbackFarms` is only
// used when the Mongo connection itself fails (no env vars, network error,
// etc.) so the mobile app can still render something useful offline.
export async function getMarketplaceSnapshot(): Promise<MarketplaceSnapshot> {
  try {
    const db = await getMongoDb();
    const docs = await db
      .collection<FarmDocument>("Farms")
      .find({})
      .sort({ sortOrder: 1, name: 1 })
      .toArray();

    const farms = docs.map(toMarketFarm);
    console.log(
      `[marketplace] returned ${farms.length} farms from Mongo (${dbNameFor(db)}.Farms)`,
    );
    return {
      source: "mongodb",
      fetchedAt: new Date().toISOString(),
      center: davisCenter,
      farms,
    };
  } catch (error) {
    console.warn("[marketplace] Mongo read failed, returning bundled fallback:", error);
    return {
      source: "fallback",
      fetchedAt: new Date().toISOString(),
      center: davisCenter,
      farms: fallbackFarms,
    };
  }
}

function dbNameFor(db: Awaited<ReturnType<typeof getMongoDb>>): string {
  // The mongo Db type exposes its name on `databaseName`.
  return (db as unknown as { databaseName?: string }).databaseName ?? "?";
}

function toMarketFarm(doc: FarmDocument): MarketFarm {
  // Backfill `location` for any legacy docs that pre-date the GeoJSON column.
  const location =
    doc.location ??
    ({
      type: "Point",
      coordinates: [doc.coordinates.longitude, doc.coordinates.latitude],
    } satisfies MarketFarm["location"]);
  // Backfill `coordinates.latitude/longitude` from `location` when only the
  // GeoJSON column is present, so the mobile UI keeps working either way.
  const coordinates = doc.coordinates ?? {
    x: 50,
    y: 50,
    latitude: location.coordinates[1],
    longitude: location.coordinates[0],
  };

  return {
    id: doc.slug,
    name: doc.name,
    shortName: doc.shortName,
    distance: doc.distance,
    neighborhood: doc.neighborhood,
    response: doc.response,
    rating: doc.rating,
    reviews: doc.reviews,
    location,
    coordinates,
    ratings: doc.ratings,
    offerings: doc.offerings.map((offering) => ({
      id: offering.slug,
      name: offering.name,
      category: offering.category,
      amount: offering.amount,
      unit: offering.unit,
      priceCents: offering.priceCents,
      signText: offering.signText,
      icon: offering.icon,
      color: offering.color,
    })),
  };
}
