import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

let clientPromise = globalForMongo.mongoClientPromise;

export function getMongoClient() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (!clientPromise) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    clientPromise = client.connect().catch((error) => {
      clientPromise = undefined;
      globalForMongo.mongoClientPromise = undefined;
      throw error;
    });

    if (process.env.NODE_ENV === "development") {
      globalForMongo.mongoClientPromise = clientPromise;
    }
  }

  return clientPromise;
}

export async function getMongoDb(dbName = process.env.MONGODB_DB): Promise<Db> {
  if (!dbName) {
    throw new Error("Missing MONGODB_DB environment variable");
  }

  const client = await getMongoClient();
  return client.db(dbName);
}
