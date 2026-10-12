/**
 * Seed script: Plants collection
 * Usage: node scripts/seed-plants.mjs
 */
import dotenv from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local", override: true });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

if (!uri) throw new Error("Missing MONGODB_URI in .env");
if (!dbName) throw new Error("Missing MONGODB_DB in .env");

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const plants = JSON.parse(readFileSync(join(scriptDirectory, "plants-data.json"), "utf8"));

async function seedPlants() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const collection = client.db(dbName).collection("plants");
    await collection.createIndex({ crop_id: 1 }, { unique: true });
    await collection.createIndex({ common_name: 1 });

    const now = new Date();
    let inserted = 0;
    let updated = 0;

    for (const plant of plants) {
      const result = await collection.updateOne(
        { crop_id: plant.crop_id },
        {
          $set: { ...plant, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true },
      );

      inserted += result.upsertedCount;
      updated += result.modifiedCount;
    }

    console.log(`Seeded ${inserted} new plants, updated ${updated} existing.`);
    console.log(`Total plants in collection: ${await collection.countDocuments()}`);
  } finally {
    await client.close();
  }
}

seedPlants().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
