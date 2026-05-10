import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

if (!uri) {
  throw new Error("Missing MONGODB_URI");
}

if (!dbName) {
  throw new Error("Missing MONGODB_DB");
}

const defaultLocation = {
  type: "Point",
  coordinates: [-121.7405, 38.5449],
};

const defaultCoordinates = {
  x: 50,
  y: 50,
  latitude: 38.5449,
  longitude: -121.7405,
};

async function main() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const farms = db.collection("farms");
    const notifications = db.collection("notifications");
    const now = new Date();

    await Promise.all([
      farms.createIndex({ slug: 1 }, { unique: true, sparse: true }),
      farms.createIndex({ userId: 1 }),
      farms.createIndex({ userUuid: 1 }),
      farms.createIndex({ location: "2dsphere" }),
      notifications.createIndex({ type: 1, recipientUserUuid: 1, createdAt: -1 }),
      notifications.createIndex({ type: 1, actorUserUuid: 1, createdAt: -1 }),
      notifications.createIndex({ listingId: 1, createdAt: -1 }),
    ]);

    const hasUppercaseFarms = await db
      .listCollections({ name: "Farms" }, { nameOnly: true })
      .hasNext();
    let migrated = 0;
    let dropped = false;

    if (hasUppercaseFarms) {
      const legacyFarms = await db.collection("Farms").find({}).toArray();

      for (const legacyFarm of legacyFarms) {
        const rest = { ...legacyFarm };
        delete rest._id;
        delete rest.createdAt;
        delete rest.updatedAt;
        const slug = normalizeSlug(legacyFarm.slug ?? legacyFarm.name);

        await farms.updateOne(
          { slug },
          {
            $set: {
              ...rest,
              slug,
              name: legacyFarm.name ?? slug,
              units: legacyFarm.units ?? "feet",
              bounds: legacyFarm.bounds ?? { width: 24, depth: 18, height: 8 },
              location: normalizeLocation(legacyFarm.location, legacyFarm.coordinates),
              coordinates: normalizeCoordinates(legacyFarm.location, legacyFarm.coordinates),
              rating: normalizeNumber(legacyFarm.rating, 5),
              reviews: normalizeNumber(legacyFarm.reviews, 0),
              ratings: normalizeRatings(legacyFarm.ratings),
              updatedAt: now,
            },
            $setOnInsert: {
              createdAt: legacyFarm.createdAt ?? now,
            },
          },
          { upsert: true },
        );
        migrated += 1;
      }

      await db.collection("Farms").drop();
      dropped = true;
    }

    const farmBackfill = await farms.updateMany(
      {
        $or: [
          { location: { $exists: false } },
          { coordinates: { $exists: false } },
          { ratings: { $exists: false } },
          { rating: { $exists: false } },
          { reviews: { $exists: false } },
        ],
      },
      {
        $set: {
          location: defaultLocation,
          coordinates: defaultCoordinates,
          rating: 5,
          reviews: 0,
          ratings: { quality: 5, fairness: 5, pickup: 5 },
          updatedAt: now,
        },
      },
    );

    console.log(JSON.stringify({
      database: dbName,
      migratedFromFarms: migrated,
      droppedFarms: dropped,
      backfilledFarms: farmBackfill.modifiedCount,
      notificationsCollectionReady: true,
    }, null, 2));
  } finally {
    await client.close();
  }
}

function normalizeSlug(value) {
  return String(value ?? "farm")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "farm";
}

function normalizeLocation(location, coordinates) {
  if (
    location?.type === "Point" &&
    Array.isArray(location.coordinates) &&
    Number.isFinite(Number(location.coordinates[0])) &&
    Number.isFinite(Number(location.coordinates[1]))
  ) {
    return {
      type: "Point",
      coordinates: [
        roundGeo(Number(location.coordinates[0])),
        roundGeo(Number(location.coordinates[1])),
      ],
    };
  }

  const normalizedCoordinates = normalizeCoordinates(location, coordinates);
  return {
    type: "Point",
    coordinates: [normalizedCoordinates.longitude, normalizedCoordinates.latitude],
  };
}

function normalizeCoordinates(location, coordinates) {
  const latitude = Number.isFinite(Number(coordinates?.latitude))
    ? Number(coordinates.latitude)
    : Number.isFinite(Number(location?.coordinates?.[1]))
      ? Number(location.coordinates[1])
      : defaultCoordinates.latitude;
  const longitude = Number.isFinite(Number(coordinates?.longitude))
    ? Number(coordinates.longitude)
    : Number.isFinite(Number(location?.coordinates?.[0]))
      ? Number(location.coordinates[0])
      : defaultCoordinates.longitude;

  return {
    x: Number.isFinite(Number(coordinates?.x)) ? Number(coordinates.x) : defaultCoordinates.x,
    y: Number.isFinite(Number(coordinates?.y)) ? Number(coordinates.y) : defaultCoordinates.y,
    latitude: roundGeo(latitude),
    longitude: roundGeo(longitude),
  };
}

function normalizeRatings(ratings) {
  return {
    quality: normalizeNumber(ratings?.quality, 5),
    fairness: normalizeNumber(ratings?.fairness, 5),
    pickup: normalizeNumber(ratings?.pickup, 5),
  };
}

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundGeo(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
