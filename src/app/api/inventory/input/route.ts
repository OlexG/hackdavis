import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongodb";
import type { InventoryCategory, InventoryItem, InventoryStatus, Plan } from "@/lib/models";

export const dynamic = "force-dynamic";

const demoUserEmail = "test@gmail.com";

type GeneratedNeedItem = {
  name: string;
  category: InventoryCategory;
  quantity: {
    amount: number;
    unit: string;
  };
  reason: string;
  location?: string;
};

const allowedNeedCategories = ["seeds", "starts", "feed", "amendments", "tools", "livestock"] as const;
const needColors: Record<(typeof allowedNeedCategories)[number], string> = {
  seeds: "#d7b64b",
  starts: "#3f8b58",
  feed: "#b0834b",
  amendments: "#6f8f55",
  tools: "#48b9df",
  livestock: "#8a6f3f",
};

export async function GET() {
  try {
    const { userId } = await getDemoUserContext();
    const db = await getMongoDb();
    const plans = await db
      .collection<Plan>("plans")
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(12)
      .toArray();

    return NextResponse.json({
      plans: plans.map((plan) => ({
        id: plan._id.toString(),
        name: plan.name,
        season: plan.simulation.season,
        currentDate: plan.simulation.currentDate.toISOString(),
        objectsCount: plan.objects.length,
        summary: plan.summary.description,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to load inventory input plans") },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { planId, prompt } = normalizeRequest(await request.json());
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY environment variable");
    }

    const { userId } = await getDemoUserContext();
    const db = await getMongoDb();
    const plan = await db.collection<Plan>("plans").findOne({ _id: new ObjectId(planId), userId });

    if (!plan) {
      return NextResponse.json({ error: "Selected plan was not found" }, { status: 404 });
    }

    const generatedItems = await generateNeedItems({ apiKey, plan, prompt });
    const now = new Date();

    await db.collection("inventory_items").createIndex({ userId: 1, category: 1, status: 1 });
    await db.collection("inventory_items").createIndex({ userId: 1, name: 1 }, { unique: true });

    const savedItems = [];

    for (const generatedItem of generatedItems) {
      const saved = await db.collection<InventoryItem>("inventory_items").findOneAndUpdate(
        { userId, name: generatedItem.name },
        {
          $set: {
            userId,
            name: generatedItem.name,
            category: generatedItem.category,
            status: "low" satisfies InventoryStatus,
            quantity: generatedItem.quantity,
            reorderAt: generatedItem.quantity.amount,
            location: generatedItem.location ?? "input list",
            source: plan.name,
            notes: generatedItem.reason,
            color: needColors[generatedItem.category as (typeof allowedNeedCategories)[number]] ?? "#8a6f3f",
            acquiredAt: now,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: "after" },
      );

      if (saved) {
        savedItems.push(toInventoryViewItem(saved));
      }
    }

    return NextResponse.json({ items: savedItems }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to generate inventory inputs") },
      { status: isRequestError(error) ? 400 : 500 },
    );
  }
}

async function generateNeedItems({
  apiKey,
  plan,
  prompt,
}: {
  apiKey: string;
  plan: Plan;
  prompt: string;
}) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: [
                  "You are generating a home-farm inventory input list.",
                  "Return only JSON with an items array.",
                  "Each item must be something the user needs to buy, prepare, gather, or restock.",
                  "Allowed categories: seeds, starts, feed, amendments, tools, livestock.",
                  "Do not include produce to sell or completed harvests.",
                  "Use short concrete item names and practical quantities.",
                  "",
                  `User request: ${prompt}`,
                  "",
                  `Plan name: ${plan.name}`,
                  `Plan season: ${plan.simulation.season}`,
                  `Plan summary: ${plan.summary.description}`,
                  `Plan objects: ${plan.objects
                    .map((object) => `${object.displayName} (${object.type}, ${object.slug})`)
                    .join(", ")}`,
                ].join("\n"),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              items: {
                type: "ARRAY",
                minItems: 1,
                maxItems: 8,
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    category: { type: "STRING", enum: allowedNeedCategories },
                    quantity: {
                      type: "OBJECT",
                      properties: {
                        amount: { type: "NUMBER" },
                        unit: { type: "STRING" },
                      },
                      required: ["amount", "unit"],
                    },
                    reason: { type: "STRING" },
                    location: { type: "STRING" },
                  },
                  required: ["name", "category", "quantity", "reason"],
                },
              },
            },
            required: ["items"],
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText.slice(0, 240)}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Gemini did not return inventory items");
  }

  const parsed = JSON.parse(stripJsonFence(text)) as { items?: unknown };
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  const normalized = items.map(normalizeGeneratedItem).filter(Boolean);

  if (!normalized.length) {
    throw new Error("Gemini returned no usable inventory items");
  }

  return normalized;
}

async function getDemoUserContext() {
  const db = await getMongoDb();
  const user = await db.collection("users").findOne({ email: demoUserEmail });

  if (!user) {
    throw new Error("Seed the demo user before generating inventory inputs");
  }

  return { userId: user._id as ObjectId };
}

function normalizeRequest(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid inventory input request");
  }

  const candidate = raw as { planId?: unknown; prompt?: unknown };
  const planId = typeof candidate.planId === "string" ? candidate.planId : "";
  const prompt = typeof candidate.prompt === "string" ? candidate.prompt.trim() : "";

  if (!ObjectId.isValid(planId)) {
    throw new Error("Choose a valid plan");
  }

  if (prompt.length < 8) {
    throw new Error("Describe what you want to do with the plan");
  }

  return { planId, prompt: prompt.slice(0, 800) };
}

function normalizeGeneratedItem(raw: unknown): GeneratedNeedItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Partial<GeneratedNeedItem>;
  const category = allowedNeedCategories.includes(candidate.category as (typeof allowedNeedCategories)[number])
    ? (candidate.category as (typeof allowedNeedCategories)[number])
    : "tools";
  const amount = Number(candidate.quantity?.amount);
  const unit = typeof candidate.quantity?.unit === "string" && candidate.quantity.unit.trim()
    ? candidate.quantity.unit.trim().slice(0, 24)
    : "each";
  const name = typeof candidate.name === "string" ? candidate.name.trim().slice(0, 80) : "";
  const reason = typeof candidate.reason === "string" ? candidate.reason.trim().slice(0, 180) : "";

  if (!name || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return {
    name,
    category,
    quantity: {
      amount: Math.round(amount * 10) / 10,
      unit,
    },
    reason: reason || "Generated from the selected plan input request.",
    location:
      typeof candidate.location === "string" && candidate.location.trim()
        ? candidate.location.trim().slice(0, 80)
        : "input list",
  };
}

function toInventoryViewItem(item: InventoryItem) {
  return {
    id: item._id.toString(),
    name: item.name,
    category: item.category,
    status: item.status,
    quantity: item.quantity,
    reorderAt: item.reorderAt,
    location: item.location,
    source: item.source,
    notes: item.notes,
    color: item.color,
    useBy: item.useBy?.toISOString(),
    acquiredAt: item.acquiredAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function stripJsonFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}

function formatApiError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isRequestError(error: unknown) {
  return error instanceof Error && (
    error.message.includes("Choose a valid plan") ||
    error.message.includes("Describe what you want")
  );
}
