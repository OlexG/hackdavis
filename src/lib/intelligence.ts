import { ObjectId } from "mongodb";
import { AuthenticationError, requireUserSession } from "@/lib/auth";
import { summarizeFarmV2ForIntelligence } from "@/lib/farm-v2";
import { getInventorySnapshot, type InventorySnapshot } from "@/lib/inventory";
import { getMongoDb } from "@/lib/mongodb";
import type { CatalogItem, FarmV2Plan, InventoryItem } from "@/lib/models";

const forecastYears = 5;
const healthMetricNames = ["soil", "water", "pestRisk", "labor", "reliability", "storage"] as const;
const confidenceLevels = ["low", "medium", "high"] as const;
const effortLevels = ["low", "medium", "high"] as const;
const costLevels = ["low", "medium", "high"] as const;
const healthStatuses = ["weak", "okay", "strong"] as const;
const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

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

export type PlanEconomicsProjection = {
  planName: string;
  baseYear: number;
  monthlyPoints: PlanEconomicsPoint[];
  costSummary: string;
  productionSummary: string;
  topOutputs: string[];
};

export type PlanEconomicsPoint = {
  year: number;
  month: number;
  label: string;
  operatingCostUsd: number;
  productionValueUsd: number;
  productionUnits: number;
};

export type ProductionForecast = {
  outputId: string;
  outputName: string;
  unit: string;
  currentYearEstimate: number;
  monthlyTrend: MonthlyForecastPoint[];
  yearlyTrend: YearlyTrendPoint[];
  revenueTrend: RevenueTrendPoint[];
  confidence: ConfidenceLevel;
  trendSummary: string;
  keyDrivers: string[];
};

export type MonthlyForecastPoint = {
  year: number;
  month: number;
  label: string;
  expectedAmount: number;
  expectedValueUsd: number;
  lowEstimate: number;
  highEstimate: number;
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
  economics?: PlanEconomicsProjection;
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
  latestPlan?: FarmV2Plan;
  inventoryItems?: InventoryItem[];
  catalogItems?: CatalogItem[];
};

export async function getFarmIntelligencePageData(): Promise<FarmIntelligencePageData> {
  const snapshot = await getInventorySnapshot();
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

  try {
    const db = await getMongoDb();
    const currentUser = await requireUserSession();

    const latestPlan = await db.collection<FarmV2Plan>("plans").findOne(
      { userId: currentUser.userId, schema: "farmv2" },
      { sort: { createdAt: -1 } },
    );

    if (!latestPlan) {
      return { snapshot, hasGeminiKey, canPersist: false };
    }

    const savedReport = await db.collection<FarmIntelligenceDocument>("farm_intelligence_reports").findOne({
      userId: currentUser.userId,
      planId: latestPlan._id,
    });

    return {
      snapshot,
      economics: buildPlanEconomicsProjection(latestPlan),
      hasGeminiKey,
      canPersist: true,
      savedReport: savedReport ? serializeSavedReport(savedReport) : undefined,
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

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
    const currentUser = await requireUserSession();

    const [latestPlan, inventoryItems] = await Promise.all([
      db.collection<FarmV2Plan>("plans").findOne({ userId: currentUser.userId, schema: "farmv2" }, { sort: { createdAt: -1 } }),
      db
        .collection<InventoryItem>("inventory_items")
        .find({ userId: currentUser.userId })
        .sort({ category: 1, status: 1, name: 1 })
        .toArray(),
    ]);

    return {
      snapshot,
      userId: currentUser.userId,
      planId: latestPlan?._id as ObjectId | undefined,
      latestPlan: latestPlan ?? undefined,
      inventoryItems,
      catalogItems: [],
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    return { snapshot };
  }
}

function buildPlanEconomicsProjection(plan: FarmV2Plan): PlanEconomicsProjection {
  const baseYear = new Date(plan.updatedAt).getUTCFullYear();
  const cropFields = plan.objects.filter((object) => object.type === "cropField");
  const livestock = plan.objects.filter((object) => object.type === "livestock");
  const structures = plan.objects.filter((object) => object.type === "structure");
  const cropArea = cropFields.reduce((total, object) => total + ("polygon" in object ? Math.max(1, object.polygon.length * 24) : 0), 0);
  const baseAnnualCost = cropFields.length * 38 + livestock.reduce((total, object) => total + Number(object.attrs.count) * 140, 0) + structures.length * 180;
  const baseProductionValue = cropFields.length * 180 + livestock.reduce((total, object) => total + Number(object.attrs.count) * 55, 0);
  const baseProductionUnits = cropArea + livestock.reduce((total, object) => total + Number(object.attrs.count) * 52, 0);
  const cropShare = baseProductionValue ? (cropFields.length * 180) / baseProductionValue : 0.75;
  const livestockShare = baseProductionValue ? (livestock.reduce((total, object) => total + Number(object.attrs.count) * 55, 0)) / baseProductionValue : 0.15;
  const otherShare = Math.max(0, 1 - cropShare - livestockShare);
  const establishmentCost = structures.length * 180 + cropFields.length * 12;
  const topOutputs = [...cropFields, ...livestock]
    .slice(0, 4)
    .map((object) => object.label);

  const monthlyPoints = Array.from({ length: 12 }, (_, monthIndex) => {
    const year = baseYear;
    const month = monthIndex + 1;
    const monthLabel = monthLabels[monthIndex]!;
    const costInflation = 1;
    const replacementReserve = replacementReserveForMonth(establishmentCost, monthIndex);
    const productionMultiplier =
      cropShare * cropMonthMultiplier(monthIndex) +
      livestockShare * livestockMonthMultiplier(monthIndex) +
      otherShare * structureMonthMultiplier(monthIndex);
    const monthlyCost = (baseAnnualCost / 12) * costInflation * costMonthMultiplier(monthIndex) + replacementReserve;

    return {
      year,
      month,
      label: monthLabel,
      operatingCostUsd: Math.round(monthlyCost * 100) / 100,
      productionValueUsd: Math.round((baseProductionValue / 12) * productionMultiplier * 100) / 100,
      productionUnits: Math.round((baseProductionUnits / 12) * productionMultiplier * 10) / 10,
    };
  });
  const annualCost = monthlyPoints.reduce((total, point) => total + point.operatingCostUsd, 0);
  const annualProduction = monthlyPoints.reduce((total, point) => total + point.productionValueUsd, 0);

  return {
    planName: plan.name,
    baseYear,
    monthlyPoints,
    costSummary: `Farmv2 cost projection estimates $${Math.round(baseAnnualCost).toLocaleString("en-US")} annual operating pressure from crop fields, livestock headcount, and structures. Current modeled year total: $${Math.round(annualCost).toLocaleString("en-US")}.`,
    productionSummary: `Farmv2 production distributes $${Math.round(annualProduction).toLocaleString("en-US")} of planning value by crop seasonality, livestock steadiness, and infrastructure support.`,
    topOutputs: topOutputs.length ? topOutputs : ["Current plan outputs"],
  };
}

function costMonthMultiplier(index: number) {
  return [0.82, 0.88, 1.16, 1.18, 1.06, 1.04, 1.1, 1.08, 1.02, 0.95, 0.86, 0.85][index] ?? 1;
}

function cropMonthMultiplier(index: number) {
  return [0.08, 0.12, 0.22, 0.55, 0.9, 1.3, 1.62, 1.74, 1.38, 0.82, 0.33, 0.14][index] ?? 1;
}

function livestockMonthMultiplier(index: number) {
  return [0.92, 0.95, 1.02, 1.06, 1.08, 1.06, 1.03, 1, 0.98, 0.96, 0.94, 0.92][index] ?? 1;
}

function structureMonthMultiplier(index: number) {
  return [0.9, 0.9, 0.96, 1.02, 1.05, 1.08, 1.1, 1.1, 1.06, 1, 0.94, 0.9][index] ?? 1;
}

function buildMonthlyForecastTrend({
  year,
  outputName,
  annualAmount,
  annualValueUsd,
}: {
  year: number;
  outputName: string;
  annualAmount: number;
  annualValueUsd: number;
}): MonthlyForecastPoint[] {
  const weights = monthlyForecastWeights(outputName);
  const weightTotal = weights.reduce((total, weight) => total + weight, 0) || 1;

  return monthLabels.map((label, index) => {
    const monthShare = weights[index]! / weightTotal;
    const expectedAmount = annualAmount * monthShare;

    return {
      year,
      month: index + 1,
      label,
      expectedAmount: Math.round(expectedAmount * 10) / 10,
      expectedValueUsd: Math.round(annualValueUsd * monthShare * 100) / 100,
      lowEstimate: Math.round(expectedAmount * 0.78 * 10) / 10,
      highEstimate: Math.round(expectedAmount * 1.18 * 10) / 10,
    };
  });
}

function monthlyForecastWeights(outputName: string) {
  const normalized = outputName.toLowerCase();

  if (isSteadyAnimalOutput(normalized)) {
    return monthLabels.map((_, index) => livestockMonthMultiplier(index));
  }

  if (/\b(green|lettuce|spinach|kale|herb|cilantro|parsley|basil)\b/.test(normalized)) {
    return [0.35, 0.45, 0.9, 1.4, 1.55, 1.25, 0.85, 0.65, 0.9, 1.25, 1.0, 0.55];
  }

  return monthLabels.map((_, index) => cropMonthMultiplier(index));
}

function isSteadyAnimalOutput(outputName: string) {
  return /\b(eggs?|milk|chickens?|ducks?|goats?|cows?|rabbits?|honey)\b/.test(outputName.toLowerCase());
}

function replacementReserveForMonth(establishmentCost: number, index: number) {
  const reserveMonths = new Set([2, 8, 9]);

  return reserveMonths.has(index) ? establishmentCost * 0.025 : 0;
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
    context.latestPlan?.updatedAt.toISOString() ??
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
    "For each productionForecast, include monthlyTrend with exactly 12 entries for Jan through Dec of the current year. Month points should show expectedAmount, expectedValueUsd, lowEstimate, and highEstimate.",
    "Revenue is rough planning value in USD, not guaranteed income.",
    "Create 4 to 6 prioritized suggestions, 3 to 5 scenario cards, 6 monthly surplus entries, and one farmHealth metric for each allowed metric.",
    "Keep copy concise enough for cards in a dashboard.",
    "",
    `Current year: ${currentYear}`,
    `Plan snapshot: ${JSON.stringify({
      name: snapshot.plan?.name ?? plan?.name,
      season: snapshot.plan?.season ?? "spring",
      currentDate: snapshot.plan?.currentDate ?? plan?.updatedAt,
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

function summarizePlan(plan: FarmV2Plan) {
  return {
    id: plan._id.toString(),
    ...summarizeFarmV2ForIntelligence(plan),
  };
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

    const currentYearEstimate = roundPositive(forecast.currentYearEstimate);
    const yearlyTrend = arrayOf(forecast.yearlyTrend, normalizeYearlyTrend).slice(0, forecastYears);
    const revenueTrend = arrayOf(forecast.revenueTrend, normalizeRevenueTrend).slice(0, forecastYears);
    const annualRevenue = revenueTrend.find((point) => point.year === currentYear)?.expectedValueUsd ?? revenueTrend[0]?.expectedValueUsd ?? 0;
    const monthlyTrend = arrayOf(forecast.monthlyTrend, normalizeMonthlyTrend).slice(0, 12);
    const generatedMonthlyTrend = buildMonthlyForecastTrend({
      year: currentYear,
      outputName,
      annualAmount: currentYearEstimate,
      annualValueUsd: annualRevenue,
    });

    return {
      outputId,
      outputName,
      unit: text(forecast.unit, "units", 24),
      currentYearEstimate,
      monthlyTrend: isSteadyAnimalOutput(outputName) || !monthlyTrend.length ? generatedMonthlyTrend : monthlyTrend,
      yearlyTrend,
      revenueTrend,
      confidence: oneOf(forecast.confidence, confidenceLevels, "low"),
      trendSummary: text(forecast.trendSummary, "Projected from the current farm plan.", 260),
      keyDrivers: stringList(forecast.keyDrivers, 5, 110),
    };
  }

  function normalizeMonthlyTrend(rawPoint: unknown, index: number): MonthlyForecastPoint | null {
    if (!rawPoint || typeof rawPoint !== "object") {
      return null;
    }

    const point = rawPoint as Partial<MonthlyForecastPoint>;
    const month = Number(point.month);
    const normalizedMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month : index + 1;
    const expectedAmount = roundPositive(point.expectedAmount);
    const lowEstimate = roundPositive(point.lowEstimate);
    const highEstimate = Math.max(expectedAmount, roundPositive(point.highEstimate));

    return {
      year: currentYear,
      month: normalizedMonth,
      label: text(point.label, monthLabels[normalizedMonth - 1] ?? monthLabels[index] ?? "Month", 12),
      expectedAmount,
      expectedValueUsd: roundPositive(point.expectedValueUsd),
      lowEstimate: Math.min(lowEstimate, expectedAmount),
      highEstimate,
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
          monthlyTrend: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                year: { type: "INTEGER" },
                month: { type: "INTEGER" },
                label: { type: "STRING" },
                expectedAmount: { type: "NUMBER" },
                expectedValueUsd: { type: "NUMBER" },
                lowEstimate: { type: "NUMBER" },
                highEstimate: { type: "NUMBER" },
              },
            },
          },
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
