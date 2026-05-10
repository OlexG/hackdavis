import { ObjectId } from "mongodb";
import { getInventorySnapshot, type InventorySnapshot } from "@/lib/inventory";
import { getMongoDb } from "@/lib/mongodb";
import type { CatalogItem, InventoryItem, Plan } from "@/lib/models";

const demoUserEmail = "test@gmail.com";
const forecastYears = 5;
const healthMetricNames = ["soil", "water", "pestRisk", "labor", "reliability", "storage"] as const;
const confidenceLevels = ["low", "medium", "high"] as const;
const effortLevels = ["low", "medium", "high"] as const;
const costLevels = ["low", "medium", "high"] as const;
const healthStatuses = ["weak", "okay", "strong"] as const;

export type FarmIntelligenceReport = {
  generatedAt: string;
  planName: string;
  executiveSummary: string;
  productionForecasts: ProductionForecast[];
  aiSuggestions: FarmSuggestion[];
  scenarioCards: ScenarioCard[];
  surplusCalendar: MonthlySurplus[];
  farmHealth: FarmHealthMetric[];
};

export type ProductionForecast = {
  outputId: string;
  outputName: string;
  unit: string;
  currentYearEstimate: number;
  yearlyTrend: YearlyTrendPoint[];
  revenueTrend: RevenueTrendPoint[];
  confidence: ConfidenceLevel;
  trendSummary: string;
  keyDrivers: string[];
};

export type YearlyTrendPoint = {
  year: number;
  expectedAmount: number;
  lowEstimate: number;
  highEstimate: number;
};

export type RevenueTrendPoint = {
  year: number;
  expectedValueUsd: number;
};

export type FarmSuggestion = {
  title: string;
  affectedOutputs: string[];
  recommendation: string;
  expectedImpact: string;
  effort: EffortLevel;
  cost: CostLevel;
  bestTiming: string;
  confidence: ConfidenceLevel;
};

export type ScenarioCard = {
  title: string;
  change: string;
  expectedUpside: string;
  tradeoff: string;
  affectedMetrics: string[];
};

export type MonthlySurplus = {
  month: string;
  likelySurplus: string[];
  likelyShortage: string[];
  recommendedActions: string[];
};

export type FarmHealthMetric = {
  name: HealthMetricName;
  score: number;
  status: HealthStatus;
  explanation: string;
};

type ConfidenceLevel = (typeof confidenceLevels)[number];
type EffortLevel = (typeof effortLevels)[number];
type CostLevel = (typeof costLevels)[number];
type HealthMetricName = (typeof healthMetricNames)[number];
type HealthStatus = (typeof healthStatuses)[number];

export type SavedFarmIntelligence = {
  id: string;
  planId: string;
  generatedAt: string;
  updatedAt: string;
  report: FarmIntelligenceReport;
};

export type FarmIntelligencePageData = {
  snapshot: InventorySnapshot;
  savedReport?: SavedFarmIntelligence;
  hasGeminiKey: boolean;
  canPersist: boolean;
};

type FarmIntelligenceDocument = {
  _id: ObjectId;
  userId: ObjectId;
  planId: ObjectId;
  planUpdatedAt?: Date;
  report: FarmIntelligenceReport;
  createdAt: Date;
  updatedAt: Date;
};

type IntelligencePromptContext = {
  snapshot: InventorySnapshot;
  planId?: ObjectId;
  userId?: ObjectId;
  latestPlan?: Plan;
  inventoryItems?: InventoryItem[];
  catalogItems?: CatalogItem[];
};

export async function getFarmIntelligencePageData(): Promise<FarmIntelligencePageData> {
  const snapshot = await getInventorySnapshot();
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

  try {
    const db = await getMongoDb();
    const user = await db.collection("users").findOne({ email: demoUserEmail });

    if (!user) {
      return { snapshot, hasGeminiKey, canPersist: false };
    }

    const latestPlan = await db.collection<Plan>("plans").findOne(
      { userId: user._id },
      { sort: { createdAt: -1 } },
    );

    if (!latestPlan) {
      return { snapshot, hasGeminiKey, canPersist: false };
    }

    const savedReport = await db.collection<FarmIntelligenceDocument>("farm_intelligence_reports").findOne({
      userId: user._id,
      planId: latestPlan._id,
    });

    return {
      snapshot,
      hasGeminiKey,
      canPersist: true,
      savedReport: savedReport ? serializeSavedReport(savedReport) : undefined,
    };
  } catch {
    return { snapshot, hasGeminiKey, canPersist: false };
  }
}

export async function generateAndSaveFarmIntelligence() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const context = await getIntelligencePromptContext();
  const report = await generateFarmIntelligenceReport({ apiKey, context });

  if (!context.userId || !context.planId || !context.latestPlan) {
    return { report, saved: false };
  }

  const db = await getMongoDb();
  const now = new Date();

  await db.collection("farm_intelligence_reports").createIndex({ userId: 1, planId: 1 }, { unique: true });

  const saved = await db.collection<FarmIntelligenceDocument>("farm_intelligence_reports").findOneAndUpdate(
    { userId: context.userId, planId: context.planId },
    {
      $set: {
        userId: context.userId,
        planId: context.planId,
        planUpdatedAt: context.latestPlan.updatedAt,
        report,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  return { report: saved?.report ?? report, saved: Boolean(saved) };
}

export function parseFarmIntelligenceReport(text: string, planName: string, currentYear: number) {
  const parsed = JSON.parse(stripJsonFence(text));
  return normalizeFarmIntelligenceReport(parsed, planName, currentYear);
}

async function getIntelligencePromptContext(): Promise<IntelligencePromptContext> {
  const snapshot = await getInventorySnapshot();

  try {
    const db = await getMongoDb();
    const user = await db.collection("users").findOne({ email: demoUserEmail });

    if (!user) {
      return { snapshot };
    }

    const [latestPlan, inventoryItems] = await Promise.all([
      db.collection<Plan>("plans").findOne({ userId: user._id }, { sort: { createdAt: -1 } }),
      db
        .collection<InventoryItem>("inventory_items")
        .find({ userId: user._id })
        .sort({ category: 1, status: 1, name: 1 })
        .toArray(),
    ]);

    const sourceIds = latestPlan?.objects
      .map((object) => object.sourceId)
      .filter((sourceId): sourceId is ObjectId => sourceId instanceof ObjectId) ?? [];
    const catalogItems = sourceIds.length
      ? await db
          .collection<CatalogItem>("catalog_items")
          .find({ _id: { $in: sourceIds } })
          .toArray()
      : [];

    return {
      snapshot,
      userId: user._id as ObjectId,
      planId: latestPlan?._id as ObjectId | undefined,
      latestPlan: latestPlan ?? undefined,
      inventoryItems,
      catalogItems,
    };
  } catch {
    return { snapshot };
  }
}

async function generateFarmIntelligenceReport({
  apiKey,
  context,
}: {
  apiKey: string;
  context: IntelligencePromptContext;
}) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const planName = context.latestPlan?.name ?? context.snapshot.plan?.name ?? "Demo farm plan";
  const currentDate =
    context.latestPlan?.simulation.currentDate.toISOString() ??
    context.snapshot.plan?.currentDate ??
    new Date().toISOString();
  const currentYear = new Date(currentDate).getUTCFullYear();

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
                text: buildGeminiPrompt(context, currentYear),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: farmIntelligenceResponseSchema,
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
    throw new Error("Gemini did not return an intelligence report");
  }

  return parseFarmIntelligenceReport(text, planName, currentYear);
}

function buildGeminiPrompt(context: IntelligencePromptContext, currentYear: number) {
  const plan = context.latestPlan;
  const snapshot = context.snapshot;
  const outputs = snapshot.plan?.outputs ?? [];

  return [
    "You are Sunpatch Farm Intelligence, an AI planning analyst for people running a real small home farm.",
    "Generate practical, specific farm intelligence as JSON matching the provided schema.",
    "Gemini is responsible for the forecast values. Estimate directional values from the farm plan and inventory inputs.",
    "Do not invent extra farm assets outside the provided inputs. If data is sparse, make conservative assumptions and mark confidence low.",
    `Forecast exactly ${forecastYears} years: ${Array.from({ length: forecastYears }, (_, index) => currentYear + index).join(", ")}.`,
    "Every productionForecast must correspond to one provided plan output. Use the output id exactly.",
    "For each forecast, choose a practical unit such as lb, heads, dozen, jars, bunches, or carts.",
    "Revenue is rough planning value in USD, not guaranteed income.",
    "Create 4 to 6 prioritized suggestions, 3 to 5 scenario cards, 6 monthly surplus entries, and one farmHealth metric for each allowed metric.",
    "Keep copy concise enough for cards in a dashboard.",
    "",
    `Current year: ${currentYear}`,
    `Plan snapshot: ${JSON.stringify({
      name: snapshot.plan?.name ?? plan?.name,
      season: snapshot.plan?.season ?? plan?.simulation.season,
      currentDate: snapshot.plan?.currentDate ?? plan?.simulation.currentDate,
      outputs,
    })}`,
    `Full plan context: ${JSON.stringify(plan ? summarizePlan(plan) : null)}`,
    `Inventory context: ${JSON.stringify((context.inventoryItems ?? []).length ? summarizeInventory(context.inventoryItems ?? []) : snapshot.items)}`,
    `Catalog context: ${JSON.stringify((context.catalogItems ?? []).map((item) => ({
      slug: item.slug,
      type: item.type,
      name: item.name,
      growthStages: item.growthStages,
      lifeStages: item.lifeStages,
    })))}`,
  ].join("\n");
}

function summarizePlan(plan: Plan) {
  return {
    id: plan._id.toString(),
    name: plan.name,
    status: plan.status,
    version: plan.version,
    simulation: {
      startDate: plan.simulation.startDate.toISOString(),
      currentDate: plan.simulation.currentDate.toISOString(),
      day: plan.simulation.day,
      season: plan.simulation.season,
    },
    baseGeometry: plan.baseGeometry
      ? {
          locationLabel: plan.baseGeometry.locationLabel,
          areaSquareMeters: plan.baseGeometry.areaSquareMeters,
          centroid: plan.baseGeometry.centroid,
        }
      : undefined,
    partitions: plan.partitions?.map((partition) => ({
      label: partition.label,
      type: partition.type,
      assignmentName: partition.assignmentName,
      areaSquareMeters: partition.areaSquareMeters,
      sunExposure: partition.sunExposure,
      waterNeed: partition.waterNeed,
      soilStrategy: partition.soilStrategy,
      notes: partition.notes,
    })),
    tiles: plan.tiles?.length
      ? {
          count: plan.tiles.length,
          areaSquareFeet: plan.tiles.reduce((sum, tile) => sum + tile.areaSquareFeet, 0),
          types: summarizePlanTiles(plan.tiles),
        }
      : undefined,
    objects: plan.objects.map((object) => ({
      instanceId: object.instanceId,
      type: object.type,
      slug: object.slug,
      displayName: object.displayName,
      status: object.status,
      plantedAtDay: object.plantedAtDay,
      addedAtDay: object.addedAtDay,
      ageDaysAtStart: object.ageDaysAtStart,
      notes: object.notes,
    })),
    summary: plan.summary,
    generation: {
      strategy: plan.generation.strategy,
      constraints: plan.generation.constraints,
      score: plan.generation.score,
    },
  };
}

function summarizePlanTiles(tiles: NonNullable<Plan["tiles"]>) {
  const groups = new Map<string, {
    tileType: string;
    assignmentName: string;
    count: number;
    sunExposure: string;
    waterNeed: string;
  }>();

  tiles.forEach((tile) => {
    const current = groups.get(tile.tileType);

    if (current) {
      current.count += 1;
      return;
    }

    groups.set(tile.tileType, {
      tileType: tile.tileType,
      assignmentName: tile.assignmentName,
      count: 1,
      sunExposure: tile.sunExposure,
      waterNeed: tile.waterNeed,
    });
  });

  return [...groups.values()].sort((left, right) => right.count - left.count);
}

function summarizeInventory(items: InventoryItem[]) {
  return items.map((item) => ({
    name: item.name,
    category: item.category,
    status: item.status,
    quantity: item.quantity,
    reorderAt: item.reorderAt,
    location: item.location,
    source: item.source,
    notes: item.notes,
    useBy: item.useBy?.toISOString(),
  }));
}

function normalizeFarmIntelligenceReport(raw: unknown, planName: string, currentYear: number): FarmIntelligenceReport {
  if (!raw || typeof raw !== "object") {
    throw new Error("Gemini returned invalid report JSON");
  }

  const candidate = raw as Partial<FarmIntelligenceReport>;
  const productionForecasts = arrayOf(candidate.productionForecasts, normalizeProductionForecast)
    .filter((forecast) => forecast.yearlyTrend.length && forecast.revenueTrend.length)
    .slice(0, 12);

  if (!productionForecasts.length) {
    throw new Error("Gemini returned no usable production forecasts");
  }

  return {
    generatedAt: normalizeDate(candidate.generatedAt) ?? new Date().toISOString(),
    planName: text(candidate.planName, planName, 120),
    executiveSummary: text(
      candidate.executiveSummary,
      "AI intelligence is ready for the current farm plan.",
      360,
    ),
    productionForecasts,
    aiSuggestions: arrayOf(candidate.aiSuggestions, normalizeSuggestion).slice(0, 8),
    scenarioCards: arrayOf(candidate.scenarioCards, normalizeScenario).slice(0, 6),
    surplusCalendar: arrayOf(candidate.surplusCalendar, normalizeSurplus).slice(0, 8),
    farmHealth: normalizeFarmHealth(candidate.farmHealth),
  };

  function normalizeProductionForecast(rawForecast: unknown): ProductionForecast | null {
    if (!rawForecast || typeof rawForecast !== "object") {
      return null;
    }

    const forecast = rawForecast as Partial<ProductionForecast>;
    const outputId = text(forecast.outputId, "", 100);
    const outputName = text(forecast.outputName, "", 100);

    if (!outputId || !outputName) {
      return null;
    }

    return {
      outputId,
      outputName,
      unit: text(forecast.unit, "units", 24),
      currentYearEstimate: roundPositive(forecast.currentYearEstimate),
      yearlyTrend: arrayOf(forecast.yearlyTrend, normalizeYearlyTrend).slice(0, forecastYears),
      revenueTrend: arrayOf(forecast.revenueTrend, normalizeRevenueTrend).slice(0, forecastYears),
      confidence: oneOf(forecast.confidence, confidenceLevels, "low"),
      trendSummary: text(forecast.trendSummary, "Projected from the current farm plan.", 260),
      keyDrivers: stringList(forecast.keyDrivers, 5, 110),
    };
  }

  function normalizeYearlyTrend(rawPoint: unknown, index: number): YearlyTrendPoint | null {
    if (!rawPoint || typeof rawPoint !== "object") {
      return null;
    }

    const point = rawPoint as Partial<YearlyTrendPoint>;
    const year = Number(point.year);
    const expectedAmount = roundPositive(point.expectedAmount);
    const lowEstimate = roundPositive(point.lowEstimate);
    const highEstimate = Math.max(expectedAmount, roundPositive(point.highEstimate));

    return {
      year: Number.isInteger(year) && year >= currentYear ? year : currentYear + index,
      expectedAmount,
      lowEstimate: Math.min(lowEstimate, expectedAmount),
      highEstimate,
    };
  }

  function normalizeRevenueTrend(rawPoint: unknown, index: number): RevenueTrendPoint | null {
    if (!rawPoint || typeof rawPoint !== "object") {
      return null;
    }

    const point = rawPoint as Partial<RevenueTrendPoint>;
    const year = Number(point.year);

    return {
      year: Number.isInteger(year) && year >= currentYear ? year : currentYear + index,
      expectedValueUsd: roundPositive(point.expectedValueUsd),
    };
  }
}

function normalizeSuggestion(raw: unknown): FarmSuggestion | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const suggestion = raw as Partial<FarmSuggestion>;
  const title = text(suggestion.title, "", 90);
  const recommendation = text(suggestion.recommendation, "", 280);

  if (!title || !recommendation) {
    return null;
  }

  return {
    title,
    affectedOutputs: stringList(suggestion.affectedOutputs, 4, 80),
    recommendation,
    expectedImpact: text(suggestion.expectedImpact, "Improves the current farm plan.", 220),
    effort: oneOf(suggestion.effort, effortLevels, "medium"),
    cost: oneOf(suggestion.cost, costLevels, "medium"),
    bestTiming: text(suggestion.bestTiming, "This season", 80),
    confidence: oneOf(suggestion.confidence, confidenceLevels, "low"),
  };
}

function normalizeScenario(raw: unknown): ScenarioCard | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const scenario = raw as Partial<ScenarioCard>;
  const title = text(scenario.title, "", 90);
  const change = text(scenario.change, "", 180);

  if (!title || !change) {
    return null;
  }

  return {
    title,
    change,
    expectedUpside: text(scenario.expectedUpside, "Likely improves farm resilience.", 220),
    tradeoff: text(scenario.tradeoff, "Requires some planning and follow-through.", 180),
    affectedMetrics: stringList(scenario.affectedMetrics, 5, 60),
  };
}

function normalizeSurplus(raw: unknown): MonthlySurplus | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const surplus = raw as Partial<MonthlySurplus>;
  const month = text(surplus.month, "", 30);

  if (!month) {
    return null;
  }

  return {
    month,
    likelySurplus: stringList(surplus.likelySurplus, 5, 90),
    likelyShortage: stringList(surplus.likelyShortage, 5, 90),
    recommendedActions: stringList(surplus.recommendedActions, 5, 110),
  };
}

function normalizeFarmHealth(raw: unknown): FarmHealthMetric[] {
  const normalized = arrayOf(raw, (metric) => {
    if (!metric || typeof metric !== "object") {
      return null;
    }

    const candidate = metric as Partial<FarmHealthMetric>;
    const name = oneOf(candidate.name, healthMetricNames, undefined);

    if (!name) {
      return null;
    }

    return {
      name,
      score: Math.min(100, Math.max(0, Math.round(Number(candidate.score) || 0))),
      status: oneOf(candidate.status, healthStatuses, "okay"),
      explanation: text(candidate.explanation, "Needs more farm history for a sharper read.", 220),
    };
  });
  const byName = new Map(normalized.map((metric) => [metric.name, metric]));

  return healthMetricNames.map(
    (name) =>
      byName.get(name) ?? {
        name,
        score: 50,
        status: "okay",
        explanation: "Needs more farm history for a sharper read.",
      },
  );
}

function arrayOf<T>(value: unknown, normalize: (value: unknown, index: number) => T | null) {
  return (Array.isArray(value) ? value : []).map(normalize).filter((item): item is T => item !== null);
}

function stringList(value: unknown, maxItems: number, maxLength: number) {
  return (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim().slice(0, maxLength))
    .slice(0, maxItems);
}

function text(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function roundPositive(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number * 10) / 10 : 0;
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function oneOf<const T extends string, Fallback extends T | undefined>(
  value: unknown,
  allowed: readonly T[],
  fallback: Fallback,
): T | Fallback {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

function stripJsonFence(text: string) {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}

function serializeSavedReport(document: FarmIntelligenceDocument): SavedFarmIntelligence {
  return {
    id: document._id.toString(),
    planId: document.planId.toString(),
    generatedAt: document.report.generatedAt,
    updatedAt: document.updatedAt.toISOString(),
    report: document.report,
  };
}

const farmIntelligenceResponseSchema = {
  type: "OBJECT",
  properties: {
    generatedAt: { type: "STRING" },
    planName: { type: "STRING" },
    executiveSummary: { type: "STRING" },
    productionForecasts: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          outputId: { type: "STRING" },
          outputName: { type: "STRING" },
          unit: { type: "STRING" },
          currentYearEstimate: { type: "NUMBER" },
          yearlyTrend: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                year: { type: "INTEGER" },
                expectedAmount: { type: "NUMBER" },
                lowEstimate: { type: "NUMBER" },
                highEstimate: { type: "NUMBER" },
              },
            },
          },
          revenueTrend: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                year: { type: "INTEGER" },
                expectedValueUsd: { type: "NUMBER" },
              },
            },
          },
          confidence: { type: "STRING" },
          trendSummary: { type: "STRING" },
          keyDrivers: { type: "ARRAY", items: { type: "STRING" } },
        },
      },
    },
    aiSuggestions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          affectedOutputs: { type: "ARRAY", items: { type: "STRING" } },
          recommendation: { type: "STRING" },
          expectedImpact: { type: "STRING" },
          effort: { type: "STRING" },
          cost: { type: "STRING" },
          bestTiming: { type: "STRING" },
          confidence: { type: "STRING" },
        },
      },
    },
    scenarioCards: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          change: { type: "STRING" },
          expectedUpside: { type: "STRING" },
          tradeoff: { type: "STRING" },
          affectedMetrics: { type: "ARRAY", items: { type: "STRING" } },
        },
      },
    },
    surplusCalendar: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          month: { type: "STRING" },
          likelySurplus: { type: "ARRAY", items: { type: "STRING" } },
          likelyShortage: { type: "ARRAY", items: { type: "STRING" } },
          recommendedActions: { type: "ARRAY", items: { type: "STRING" } },
        },
      },
    },
    farmHealth: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          score: { type: "INTEGER" },
          status: { type: "STRING" },
          explanation: { type: "STRING" },
        },
      },
    },
  },
};
