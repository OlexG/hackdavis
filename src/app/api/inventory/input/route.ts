import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { AuthenticationError, requireUserSession } from "@/lib/auth";
import { farmv2ToInventoryInputs } from "@/lib/farm-v2";
import { getMongoDb } from "@/lib/mongodb";
import type { FarmV2Plan, InventoryCategory, InventoryItem, InventoryStatus } from "@/lib/models";

export const dynamic = "force-dynamic";

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

type InventoryInputRequest = {
  action: "preview" | "commit";
  planId: string;
  prompt: string;
  items: GeneratedNeedItem[];
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
    const { userId } = await requireUserSession();
    const db = await getMongoDb();
    const plans = await db
      .collection<FarmV2Plan>("plans")
      .find({ userId, schema: "farmv2" })
      .sort({ createdAt: -1 })
      .limit(12)
      .toArray();

    return NextResponse.json({
      plans: plans.map((plan) => ({
        id: plan._id.toString(),
        name: plan.name,
        season: "spring",
        currentDate: plan.updatedAt.toISOString(),
        objectsCount: plan.objects.length,
        summary: plan.summary.description,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to load inventory input plans") },
      { status: error instanceof AuthenticationError ? 401 : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const input = normalizeRequest(await request.json());

    const { userId } = await requireUserSession();
    const db = await getMongoDb();
    const plan = await db.collection<FarmV2Plan>("plans").findOne({ _id: new ObjectId(input.planId), userId, schema: "farmv2" });

    if (!plan) {
      return NextResponse.json({ error: "Selected plan was not found" }, { status: 404 });
    }

    const generatedItems = input.action === "preview"
      ? await previewNeedItems({ plan, prompt: input.prompt })
      : input.items;
    const relevantItems = filterRelevantNeedItems(generatedItems, input.prompt);

    if (input.action === "preview") {
      return NextResponse.json({
        items: relevantItems.map((item, index) => toInventoryPreviewItem(item, plan, index)),
      });
    }

    const now = new Date();

    await db.collection("inventory_items").createIndex({ userId: 1, category: 1, status: 1 });
    await db.collection("inventory_items").createIndex({ userId: 1, name: 1 }, { unique: true });

    const savedItems = [];

    for (const generatedItem of relevantItems) {
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
      { status: error instanceof AuthenticationError ? 401 : isRequestError(error) ? 400 : 500 },
    );
  }
}

async function previewNeedItems({ plan, prompt }: { plan: FarmV2Plan; prompt: string }) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  return generateNeedItems({ apiKey, plan, prompt });
}

async function generateNeedItems({
  apiKey,
  plan,
  prompt,
}: {
  apiKey: string;
  plan: FarmV2Plan;
  prompt: string;
}) {
  const adapterItems = farmv2ToInventoryInputs(plan);
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
                  "Return only valid JSON. Do not wrap it in markdown.",
                  'Use this exact shape: {"items":[{"name":"string","category":"seeds|starts|feed|amendments|tools|livestock","quantity":{"amount":1,"unit":"each"},"reason":"string","location":"string"}]}.',
                  "Each item must be something the user needs to buy, prepare, gather, or restock.",
                  "Allowed categories: seeds, starts, feed, amendments, tools, livestock.",
                  "Do not include produce to sell or completed harvests.",
                  "The user request is the source of truth. Use plan objects only for layout and timing context.",
                  "Do not add items for unrelated plan objects.",
                  "If the user does not explicitly mention animals, chickens, coops, eggs, or livestock, never return livestock, chicks, chickens, feed, bedding, nest boxes, or coop supplies.",
                  "For tomato requests, stay on tomato seeds or starts, trellising, soil, amendments, irrigation, labels, pest support, and harvest supplies.",
                  "Use short concrete item names and practical quantities.",
                  "",
                  `User request: ${prompt}`,
                  "",
                  `Plan name: ${plan.name}`,
                  `Plan summary: ${plan.summary.description}`,
                  `Farmv2 adapter inputs: ${adapterItems.map((item) => `${item.name} (${item.category}) for ${item.location}`).join(", ")}`,
                  `Plan objects: ${plan.objects
                    .map((object) => `${object.label} (${object.type})`)
                    .join(", ")}`,
                ].join("\n"),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
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
  const normalized = items.map(normalizeGeneratedItem).filter(isGeneratedNeedItem);

  if (!normalized.length) {
    throw new Error("Gemini returned no usable inventory items");
  }

  return normalized;
}

function filterRelevantNeedItems(items: GeneratedNeedItem[], prompt: string) {
  const allowsLivestock = promptAllowsLivestock(prompt);
  const relevant = items.filter((item) => allowsLivestock || !isLivestockNeedItem(item));

  if (!relevant.length) {
    throw new Error("Gemini returned no relevant inventory items for this request");
  }

  return relevant;
}

function promptAllowsLivestock(prompt: string) {
  return /\b(chicken|chick|hen|rooster|coop|egg|duck|rabbit|goat|livestock|animal|feed|bedding)\b/i.test(prompt);
}

function isLivestockNeedItem(item: GeneratedNeedItem) {
  const searchable = `${item.name} ${item.reason} ${item.location ?? ""}`.toLowerCase();

  return (
    item.category === "livestock" ||
    item.category === "feed" ||
    /\b(chicken|chick|hen|rooster|coop|egg|feed|bedding|nest box|oyster shell)\b/.test(searchable)
  );
}

function normalizeRequest(raw: unknown): InventoryInputRequest {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid inventory input request");
  }

  const candidate = raw as { action?: unknown; planId?: unknown; prompt?: unknown; items?: unknown };
  const action = candidate.action === "commit" ? "commit" : "preview";
  const planId = typeof candidate.planId === "string" ? candidate.planId : "";
  const prompt = typeof candidate.prompt === "string" ? candidate.prompt.trim() : "";

  if (!ObjectId.isValid(planId)) {
    throw new Error("Choose a valid plan");
  }

  if (action === "preview" && prompt.length < 8) {
    throw new Error("Describe what you want to do with the plan");
  }

  const items = action === "commit" && Array.isArray(candidate.items)
    ? candidate.items.map(normalizeGeneratedItem).filter(isGeneratedNeedItem)
    : [];

  if (action === "commit" && !items.length) {
    throw new Error("Choose at least one item to add");
  }

  return { action, planId, prompt: prompt.slice(0, 800), items };
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

function isGeneratedNeedItem(item: GeneratedNeedItem | null): item is GeneratedNeedItem {
  return item !== null;
}

function toInventoryPreviewItem(item: GeneratedNeedItem, plan: FarmV2Plan, index: number) {
  const now = new Date().toISOString();

  return {
    id: `preview-${index}-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: item.name,
    category: item.category,
    status: "low" satisfies InventoryStatus,
    quantity: item.quantity,
    reorderAt: item.quantity.amount,
    location: item.location ?? "input list",
    source: plan.name,
    notes: item.reason,
    color: needColors[item.category as (typeof allowedNeedCategories)[number]] ?? "#8a6f3f",
    acquiredAt: now,
    updatedAt: now,
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
    error.message.includes("Describe what you want") ||
    error.message.includes("Choose at least one item")
  );
}
