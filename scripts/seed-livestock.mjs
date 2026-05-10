/**
 * Seed script: Livestock collection
 * Usage: node scripts/seed-livestock.mjs
 */
import { MongoClient } from "mongodb";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import dotenv from "dotenv";
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || "davishacks";

if (!MONGO_URI) {
  throw new Error("Missing MONGODB_URI in .env");
}

const livestock = JSON.parse(
  readFileSync(join(__dirname, "livestock-data.json"), "utf-8")
);

async function seedLivestock() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas");

    const db = client.db(DB_NAME);
    const collection = db.collection("livestock");

    // Create indexes
    await collection.createIndex({ livestock_id: 1 }, { unique: true });
    await collection.createIndex({ name: 1 });

    const now = new Date();
    let inserted = 0;
    let updated = 0;

    for (const animal of livestock) {
      const result = await collection.updateOne(
        { livestock_id: animal.livestock_id },
        {
          $set: { ...animal, updatedAt: now },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
      if (result.upsertedCount > 0) inserted++;
      else if (result.modifiedCount > 0) updated++;
    }

    console.log(
      `Seeded ${inserted} new livestock, updated ${updated} existing.`
    );
    console.log(
      `Total livestock in collection: ${await collection.countDocuments()}`
    );
  } finally {
    await client.close();
    console.log("Connection closed.");
  }
}

seedLivestock().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
