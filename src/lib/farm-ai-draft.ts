import {
  createFarmV2Commit,
  getBBox,
  pointInPolygon,
  polygonArea,
  sanitizeGeoPoints,
  sanitizeLocalPoints,
} from "@/lib/farm-v2";
import type { FarmV2Object, FarmV2Plan, GeoPoint, LocalPoint } from "@/lib/models";

export type FarmAiDraftPreferences = {
  budgetCents: number;
  goal: "food-security" | "profit" | "low-maintenance" | "balanced" | "family-kitchen" | "market-garden";
  householdSize: number;
  weeklyHours: number;
  experience: "beginner" | "intermediate" | "advanced";
  includeLivestock: boolean;
  includeStructures: boolean;
  irrigation: "none" | "hose" | "drip" | "sprinkler";
  waterPriority: "low-water" | "balanced" | "high-production";
  season: "spring" | "summer" | "fall" | "winter" | "year-round";
  dietaryPreferences: string[];
  excludedCropKeys: string[];
  preferredCropKeys: string[];
  notes: string;
};

export type AiDraftCrop = {
  key: string;
  name: string;
  visual: string;
  defaultCount: number;
  idealSpaceSqft?: number;
  harvestCycles?: number;
  cropCategory?: string;
  lifeSpan?: string;
  lightRequirement?: string;
  soilTexture?: string;
  temperatureMinC?: number;
  temperatureMaxC?: number;
  waterConsumptionMl?: number;
  rainfallMaxMl?: number;
  howToGrow?: string;
  tips?: string;
};

export type AiDraftLivestock = {
  key: string;
  name: string;
  defaultCount: number;
  idealSpaceSqft?: number;
  feed?: string;
  yieldTypes?: string[];
};

export type AiDraftStructure = {
  key: string;
  name: string;
  material: string;
  height: number;
};

type GeminiFarmIntent = {
  planName: string;
  summary: {
    description: string;
    highlights: string[];
    maintenanceLevel: "low" | "medium" | "high";
  };
  cropAssignments: Array<{
    cropKey: string;
    areaRatio: number;
    estimatedPlantCount: number;
    reason: string;
  }>;
  livestockAssignments: Array<{
    livestockKey: string;
    count: number;
    areaRatio: number;
    reason: string;
  }>;
  structures: Array<{
    structureKey: string;
    areaRatio: number;
    reason: string;
  }>;
  budget: {
    estimatedSetupCostCents: number;
    seedCostCents: number;
    infrastructureCostCents: number;
    livestockCostCents: number;
    contingencyCents: number;
  };
  optimization: {
    objective: string;
    tradeoffs: string[];
    expectedWeeklyHours: number;
    confidence: number;
  };
};

type PlannerResult = {
  intent: GeminiFarmIntent;
  source: "openai" | "gemini" | "catalog-fallback";
  error?: string;
};

type ScoredCrop = {
  crop: AiDraftCrop;
  score: number;
  family: string;
};

type SiteGrowingContext = {
  latitude: number | null;
  longitude: number | null;
  hemisphere: "north" | "south";
  region: string;
  climate: "arid" | "mediterranean" | "temperate" | "humid" | "cold" | "tropical";
  season: FarmAiDraftPreferences["season"];
  seasonLabel: string;
  estimatedSeasonLowC: number;
  estimatedSeasonHighC: number;
  estimatedWinterLowC: number;
  estimatedSummerHighC: number;
  estimatedAnnualRainfallMm: number;
  frostRisk: "low" | "medium" | "high";
  heatRisk: "low" | "medium" | "high";
  livestockHeatStress: "low" | "medium" | "high";
};

type Placement = {
  x: number;
  y: number;
  width: number;
  depth: number;
};

type PlotCell = {
  placement: Placement;
  polygon: LocalPoint[];
};

type GridCell = PlotCell & {
  role: "crop" | "structure" | "livestock";
  index: number;
};

type LayoutSlot = {
  role: GridCell["role"];
  index: number;
  weight: number;
};

type LayoutVariant = {
  name: string;
  cropLimit: number;
  gapScale: number;
  minCellSide: number;
};

type LayoutResult = {
  cropZone: Placement;
  cropCells: PlotCell[];
  structureCells: PlotCell[];
  livestockCells: PlotCell[];
  gridCells: GridCell[];
};

type LayoutAssessment = {
  passed: boolean;
  score: number;
  iteration: number;
  variant: string;
  objectCount: number;
  cropCount: number;
  livestockCount: number;
  structureCount: number;
  overlapCount: number;
  outsideCount: number;
  pathCrossingCount: number;
  labelCollisionCount: number;
  wideLabelCount: number;
  nonRectangularCount: number;
  minSolidSide: number;
  maxAspectRatio: number;
  solidCoverageRatio: number;
  notes: string[];
};

export function normalizeAiDraftPreferences(raw: unknown): FarmAiDraftPreferences {
  const body = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};

  return {
    budgetCents: clampInt(Number(body.budgetCents), 5_000, 50_000_000, 75_000),
    goal: enumValue(body.goal, ["food-security", "profit", "low-maintenance", "balanced", "family-kitchen", "market-garden"], "balanced"),
    householdSize: clampInt(Number(body.householdSize), 1, 20, 4),
    weeklyHours: clampInt(Number(body.weeklyHours), 1, 80, 8),
    experience: enumValue(body.experience, ["beginner", "intermediate", "advanced"], "beginner"),
    includeLivestock: body.includeLivestock === true,
    includeStructures: body.includeStructures !== false,
    irrigation: enumValue(body.irrigation, ["none", "hose", "drip", "sprinkler"], "hose"),
    waterPriority: enumValue(body.waterPriority, ["low-water", "balanced", "high-production"], "balanced"),
    season: enumValue(body.season, ["spring", "summer", "fall", "winter", "year-round"], seasonForDate(new Date())),
    dietaryPreferences: stringArray(body.dietaryPreferences, 8, 40),
    excludedCropKeys: stringArray(body.excludedCropKeys, 50, 80),
    preferredCropKeys: stringArray(body.preferredCropKeys, 30, 80),
    notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 800) : "",
  };
}

export async function generateAiFarmPlan({
  boundaryGeo,
  boundaryLocal,
  preferences,
  crops,
  livestock,
  structures,
  now,
}: {
  boundaryGeo: GeoPoint[] | null;
  boundaryLocal: LocalPoint[];
  preferences: FarmAiDraftPreferences;
  crops: AiDraftCrop[];
  livestock: AiDraftLivestock[];
  structures: AiDraftStructure[];
  now: Date;
}): Promise<Omit<FarmV2Plan, "_id" | "farmId" | "userId">> {
  const local = sanitizeLocalPoints(boundaryLocal);
  const geo = sanitizeGeoPoints(boundaryGeo);
  const areaSquareFeet = Math.max(1, Math.round(polygonArea(local)));
  const siteContext = buildSiteGrowingContext(geo, preferences);
  const candidateCrops = selectCandidateCrops(crops, preferences, siteContext);
  const planner = await createPlannerIntent({ boundaryLocal: local, areaSquareFeet, preferences, siteContext, crops, candidateCrops, livestock, structures });
  const intent = planner.intent;
  const generated = createObjectsFromIntent(local, intent, crops, livestock, structures);
  const objects = generated.objects;
  const estimatedWeeklyHours = estimatePlanWeeklyHours(objects, crops, livestock);
  intent.optimization.expectedWeeklyHours = estimatedWeeklyHours;
  if (estimatedWeeklyHours > preferences.weeklyHours) {
    intent.optimization.tradeoffs = [
      `Estimated weekly work is ${estimatedWeeklyHours} hours against a ${preferences.weeklyHours} hour target.`,
      ...intent.optimization.tradeoffs,
    ].slice(0, 5);
  }
  intent.summary.maintenanceLevel = maintenanceLevelForHours(estimatedWeeklyHours);
  const score = scorePlan(intent, objects, preferences, areaSquareFeet, generated.assessment, estimatedWeeklyHours);
  const commit = createFarmV2Commit("Gemini AI draft", objects, now);

  return {
    schema: "farmv2",
    version: 8,
    name: intent.planName || `Gemini Farmv2 Plan - ${now.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    status: "draft",
    units: "ft",
    view: "grid",
    selectedId: objects.find((object) => object.type === "cropField")?.id ?? objects[0]?.id ?? null,
    camera: { zoom: 1, panX: 0, panY: -18, rotation: 0 },
    boundary: {
      source: geo.length >= 3 ? "map" : "demo",
      geo: geo.length >= 3 ? geo : null,
      local,
      areaSquareFeet,
    },
    objects,
    commits: [commit],
    commitIndex: 0,
    summary: intent.summary,
    generation: {
      mode: "deterministic-draft",
      strategy: `${planner.source}-${preferences.goal}`,
      prompt: "LLM structured farm planning intent converted by deterministic geometry placement.",
      constraints: {
        ...preferences,
        model: planner.source === "openai"
          ? process.env.OPENAI_MODEL || "gpt-5-mini"
          : process.env.GEMINI_MODEL || "gemini-2.5-flash",
        availableCropCount: crops.length,
        candidateCropCount: candidateCrops.length,
        siteContext,
        generatedObjectCount: objects.length,
        plannerSource: planner.source,
        plannerError: planner.error,
        estimatedSetupCostCents: intent.budget.estimatedSetupCostCents,
        estimatedWeeklyHours,
        objective: intent.optimization.objective,
        tradeoffs: intent.optimization.tradeoffs,
        layoutAssessment: generated.assessment,
      },
      score,
    },
    createdAt: now,
    updatedAt: now,
  };
}

async function createPlannerIntent(input: {
  boundaryLocal: LocalPoint[];
  areaSquareFeet: number;
  preferences: FarmAiDraftPreferences;
  siteContext: SiteGrowingContext;
  crops: AiDraftCrop[];
  candidateCrops: AiDraftCrop[];
  livestock: AiDraftLivestock[];
  structures: AiDraftStructure[];
}): Promise<PlannerResult> {
  const provider: PlannerResult["source"] = process.env.OPENAI_API_KEY ? "openai" : "gemini";
  try {
    const raw = provider === "openai"
      ? await callOpenAiPlanner(input)
      : await callGeminiPlanner(input);
    return {
      intent: ensureSupportAssignments(validateGeminiIntent(
        raw,
        input.crops,
        input.livestock,
        input.structures,
        input.preferences,
      ), input),
      source: provider,
    };
  } catch (error) {
    if (!isRecoverableGeminiError(error)) throw error;
    return {
      intent: ensureSupportAssignments(createCatalogFallbackIntent(input), input),
      source: "catalog-fallback",
      error: error instanceof Error ? error.message.slice(0, 220) : "Gemini planning unavailable",
    };
  }
}

async function callOpenAiPlanner(input: {
  boundaryLocal: LocalPoint[];
  areaSquareFeet: number;
  preferences: FarmAiDraftPreferences;
  siteContext: SiteGrowingContext;
  crops: AiDraftCrop[];
  candidateCrops: AiDraftCrop[];
  livestock: AiDraftLivestock[];
  structures: AiDraftStructure[];
}): Promise<unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: "You are an expert homestead farm planner. Return only the requested structured JSON plan intent.",
        },
        {
          role: "user",
          content: plannerPrompt(input),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "farm_plan_intent",
          strict: true,
          schema: openAiPlannerSchema(),
        },
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(readOpenAiError(data));

  const text = readOpenAiResponseText(data);
  if (!text) throw new Error("OpenAI did not return a farm plan");
  return JSON.parse(text);
}

async function callGeminiPlanner(input: {
  boundaryLocal: LocalPoint[];
  areaSquareFeet: number;
  preferences: FarmAiDraftPreferences;
  siteContext: SiteGrowingContext;
  crops: AiDraftCrop[];
  candidateCrops: AiDraftCrop[];
  livestock: AiDraftLivestock[];
  structures: AiDraftStructure[];
}): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: plannerPrompt(input) }] }],
      generationConfig: {
        temperature: 0.25,
        responseMimeType: "application/json",
        responseSchema: plannerSchema(),
      },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(readGeminiError(data));

  const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("");
  if (!text) throw new Error("Gemini did not return a farm plan");
  return JSON.parse(text);
}

function plannerPrompt(input: {
  boundaryLocal: LocalPoint[];
  areaSquareFeet: number;
  preferences: FarmAiDraftPreferences;
  siteContext: SiteGrowingContext;
  crops: AiDraftCrop[];
  candidateCrops: AiDraftCrop[];
  livestock: AiDraftLivestock[];
  structures: AiDraftStructure[];
}) {
  return [
    "You are designing an optimized editable homestead farm plan.",
    "Return only data that matches the schema. Use only cropKey, livestockKey, and structureKey values from the allowed lists.",
    "Optimize for real farm usefulness: budget, weekly labor, crop diversity, water fit, household food value, maintenance level, and usable access.",
    "Treat weeklyHours as a real capacity limit. Low-hour plans should use fewer crop fields, lower-touch crops, compact livestock only when labor fits, and maintenanceLevel/expectedWeeklyHours must not imply work above the user's capacity.",
    "Treat notes as first-class user requirements. If notes explicitly say they love, want, prefer, or need a catalog crop, include it unless the crop is explicitly excluded or unavailable.",
    "Do not invent crop names. Prefer popular homestead staples that match the goal, season, location climate, labor, water, household size, and budget. Avoid niche medicinal, ornamental, sprout, orchard, tropical, and slow perennial crops unless the user's goals, site climate, and site size clearly justify them.",
    "Use the siteContext climate and selected season as hard agronomic constraints. Candidate crops were pre-scored for local seasonal temperature, annual heat/cold risk, rainfall, and water fit; stay within those candidate keys.",
    "For livestock, match animal size and heat/cold/water tolerance to the selected land, local climate, season, and budget: small sites should use compact animals like quail, chickens, rabbits, or ducks only when climate supports them; larger sites can use pigs, sheep, goats, and only very large well-funded sites should use cows.",
    "Use layoutGeometry to choose crop priorities for the available land shape.",
    "When includeStructures is true, include at least one compact support structure. When includeLivestock is true and the site has enough area, include a small livestock paddock.",
    "Do not choose shapes and do not place coordinates. The deterministic layout engine will partition the land outline, clip plots to the site geometry, and preserve walking gaps.",
    JSON.stringify({
      boundaryLocal: input.boundaryLocal,
      areaSquareFeet: input.areaSquareFeet,
      preferences: input.preferences,
      siteContext: input.siteContext,
      layoutGeometry: summarizeLayoutGeometry(input.boundaryLocal),
      allowedCropKeys: input.candidateCrops.map((crop) => crop.key),
      candidateCrops: input.candidateCrops,
      allowedLivestock: input.livestock,
      allowedStructures: input.structures,
    }),
  ].join("\n\n");
}

function plannerSchema() {
  return {
    type: "OBJECT",
    properties: {
      planName: { type: "STRING" },
      summary: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING" },
          highlights: { type: "ARRAY", items: { type: "STRING" } },
          maintenanceLevel: { type: "STRING" },
        },
        required: ["description", "highlights", "maintenanceLevel"],
      },
      cropAssignments: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            cropKey: { type: "STRING" },
            areaRatio: { type: "NUMBER" },
            estimatedPlantCount: { type: "INTEGER" },
            reason: { type: "STRING" },
          },
          required: ["cropKey", "areaRatio", "estimatedPlantCount", "reason"],
        },
      },
      livestockAssignments: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            livestockKey: { type: "STRING" },
            count: { type: "INTEGER" },
            areaRatio: { type: "NUMBER" },
            reason: { type: "STRING" },
          },
          required: ["livestockKey", "count", "areaRatio", "reason"],
        },
      },
      structures: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            structureKey: { type: "STRING" },
            areaRatio: { type: "NUMBER" },
            reason: { type: "STRING" },
          },
          required: ["structureKey", "areaRatio", "reason"],
        },
      },
      budget: {
        type: "OBJECT",
        properties: {
          estimatedSetupCostCents: { type: "INTEGER" },
          seedCostCents: { type: "INTEGER" },
          infrastructureCostCents: { type: "INTEGER" },
          livestockCostCents: { type: "INTEGER" },
          contingencyCents: { type: "INTEGER" },
        },
        required: ["estimatedSetupCostCents", "seedCostCents", "infrastructureCostCents", "livestockCostCents", "contingencyCents"],
      },
      optimization: {
        type: "OBJECT",
        properties: {
          objective: { type: "STRING" },
          tradeoffs: { type: "ARRAY", items: { type: "STRING" } },
          expectedWeeklyHours: { type: "INTEGER" },
          confidence: { type: "NUMBER" },
        },
        required: ["objective", "tradeoffs", "expectedWeeklyHours", "confidence"],
      },
    },
    required: ["planName", "summary", "cropAssignments", "livestockAssignments", "structures", "budget", "optimization"],
  };
}

function openAiPlannerSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      planName: { type: "string" },
      summary: {
        type: "object",
        additionalProperties: false,
        properties: {
          description: { type: "string" },
          highlights: { type: "array", items: { type: "string" } },
          maintenanceLevel: { type: "string" },
        },
        required: ["description", "highlights", "maintenanceLevel"],
      },
      cropAssignments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            cropKey: { type: "string" },
            areaRatio: { type: "number" },
            estimatedPlantCount: { type: "integer" },
            reason: { type: "string" },
          },
          required: ["cropKey", "areaRatio", "estimatedPlantCount", "reason"],
        },
      },
      livestockAssignments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            livestockKey: { type: "string" },
            count: { type: "integer" },
            areaRatio: { type: "number" },
            reason: { type: "string" },
          },
          required: ["livestockKey", "count", "areaRatio", "reason"],
        },
      },
      structures: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            structureKey: { type: "string" },
            areaRatio: { type: "number" },
            reason: { type: "string" },
          },
          required: ["structureKey", "areaRatio", "reason"],
        },
      },
      budget: {
        type: "object",
        additionalProperties: false,
        properties: {
          estimatedSetupCostCents: { type: "integer" },
          seedCostCents: { type: "integer" },
          infrastructureCostCents: { type: "integer" },
          livestockCostCents: { type: "integer" },
          contingencyCents: { type: "integer" },
        },
        required: ["estimatedSetupCostCents", "seedCostCents", "infrastructureCostCents", "livestockCostCents", "contingencyCents"],
      },
      optimization: {
        type: "object",
        additionalProperties: false,
        properties: {
          objective: { type: "string" },
          tradeoffs: { type: "array", items: { type: "string" } },
          expectedWeeklyHours: { type: "integer" },
          confidence: { type: "number" },
        },
        required: ["objective", "tradeoffs", "expectedWeeklyHours", "confidence"],
      },
    },
    required: ["planName", "summary", "cropAssignments", "livestockAssignments", "structures", "budget", "optimization"],
  };
}

function validateGeminiIntent(
  raw: unknown,
  crops: AiDraftCrop[],
  livestock: AiDraftLivestock[],
  structures: AiDraftStructure[],
  preferences: FarmAiDraftPreferences,
): GeminiFarmIntent {
  const value = raw && typeof raw === "object" ? raw as Partial<GeminiFarmIntent> : {};
  const cropKeys = new Set(crops.map((crop) => crop.key));
  const noteExcludedCropKeys = noteMatchedCrops(crops, preferences, "exclude").map((crop) => crop.key);
  const excludedCropKeys = new Set([...preferences.excludedCropKeys, ...noteExcludedCropKeys]);
  const livestockKeys = new Set(livestock.map((animal) => animal.key));
  const structureKeys = new Set([...structures.map((structure) => structure.key), "compost"]);
  const cropAssignments = Array.isArray(value.cropAssignments)
    ? value.cropAssignments.filter((item) => item && cropKeys.has(item.cropKey) && !excludedCropKeys.has(item.cropKey)).slice(0, 12)
    : [];
  if (cropAssignments.length < 3) throw new Error("Gemini returned too few valid crop assignments");

  return {
    planName: typeof value.planName === "string" ? value.planName.slice(0, 120) : "Gemini Homestead Plan",
    summary: {
      description: value.summary?.description?.slice(0, 280) || "An optimized Gemini-generated homestead draft.",
      highlights: Array.isArray(value.summary?.highlights) ? value.summary.highlights.slice(0, 4).map((item) => String(item).slice(0, 140)) : [],
      maintenanceLevel: enumValue(value.summary?.maintenanceLevel, ["low", "medium", "high"], "medium"),
    },
    cropAssignments: normalizeRatios(cropAssignments.map((item) => ({
      cropKey: item.cropKey,
      areaRatio: numberOr(item.areaRatio, 0.08),
      estimatedPlantCount: clampInt(Number(item.estimatedPlantCount), 1, 1000, 12),
      reason: typeof item.reason === "string" ? item.reason.slice(0, 180) : "Selected for the user goals.",
    })), 0.72),
    livestockAssignments: preferences.includeLivestock && Array.isArray(value.livestockAssignments)
      ? normalizeRatios(value.livestockAssignments.filter((item) => item && livestockKeys.has(item.livestockKey)).slice(0, 3).map((item) => ({
          livestockKey: item.livestockKey,
          count: clampInt(Number(item.count), 1, 40, 2),
          areaRatio: numberOr(item.areaRatio, 0.08),
          reason: typeof item.reason === "string" ? item.reason.slice(0, 180) : "Fits the homestead goals.",
        })), 0.18)
      : [],
    structures: preferences.includeStructures && Array.isArray(value.structures)
      ? normalizeRatios(value.structures.filter((item) => item && structureKeys.has(item.structureKey)).slice(0, 5).map((item) => ({
          structureKey: item.structureKey,
          areaRatio: numberOr(item.areaRatio, 0.035),
          reason: typeof item.reason === "string" ? item.reason.slice(0, 180) : "Supports farm operations.",
        })), 0.12)
      : [],
    budget: {
      estimatedSetupCostCents: clampInt(Number(value.budget?.estimatedSetupCostCents), 0, 50_000_000, preferences.budgetCents),
      seedCostCents: clampInt(Number(value.budget?.seedCostCents), 0, 50_000_000, 0),
      infrastructureCostCents: clampInt(Number(value.budget?.infrastructureCostCents), 0, 50_000_000, 0),
      livestockCostCents: clampInt(Number(value.budget?.livestockCostCents), 0, 50_000_000, 0),
      contingencyCents: clampInt(Number(value.budget?.contingencyCents), 0, 50_000_000, 0),
    },
    optimization: {
      objective: value.optimization?.objective?.slice(0, 180) || preferences.goal,
      tradeoffs: Array.isArray(value.optimization?.tradeoffs) ? value.optimization.tradeoffs.slice(0, 5).map((item) => String(item).slice(0, 140)) : [],
      expectedWeeklyHours: clampInt(Number(value.optimization?.expectedWeeklyHours), 1, 80, preferences.weeklyHours),
      confidence: Math.min(1, Math.max(0, Number(value.optimization?.confidence) || 0.65)),
    },
  };
}

function ensureSupportAssignments(
  intent: GeminiFarmIntent,
  input: {
    areaSquareFeet: number;
    preferences: FarmAiDraftPreferences;
    siteContext: SiteGrowingContext;
    candidateCrops: AiDraftCrop[];
    livestock: AiDraftLivestock[];
    structures: AiDraftStructure[];
  },
): GeminiFarmIntent {
  const cropAssignments = ensureCropAssignments(intent.cropAssignments, input.candidateCrops, input.preferences, input.siteContext, input.areaSquareFeet);
  const canPlaceLivestock = input.areaSquareFeet >= 650;
  const canPlaceStructures = input.areaSquareFeet >= 450;
  let livestockAssignments = canPlaceLivestock ? [...intent.livestockAssignments] : [];
  const allowedStructures = input.structures.filter((structure) => structure.key !== "greenhouse");
  const structureAssignments = canPlaceStructures ? intent.structures.filter((assignment) => assignment.structureKey !== "greenhouse") : [];
  const structureKeys = new Set(allowedStructures.map((structure) => structure.key));

  if (input.preferences.includeLivestock && input.livestock.length && canPlaceLivestock) {
    const animal = selectLivestockForSite(
      input.livestock,
      input.preferences,
      input.siteContext,
      input.areaSquareFeet,
      livestockAssignments[0]?.livestockKey,
    );
    livestockAssignments = animal ? [{
      livestockKey: animal.key,
      count: livestockCountForSite(animal, input.preferences, input.areaSquareFeet),
      areaRatio: livestockAreaRatioForSite(animal, input.areaSquareFeet),
      reason: `Selected by deterministic size-fit and climate scoring for ${Math.round(input.areaSquareFeet)} sq ft, ${input.siteContext.region}, budget, labor, experience, water, season, and household constraints.`,
    }] : [];
  }

  if (input.preferences.includeStructures && input.structures.length && canPlaceStructures) {
    const currentStructureKeys = new Set(structureAssignments.map((assignment) => assignment.structureKey));
    const targetStructureCount = input.areaSquareFeet >= 2400 && livestockAssignments.length ? 2 : 1;
    for (const key of preferredStructureKeys(livestockAssignments.length > 0)) {
      if (structureAssignments.length >= targetStructureCount) break;
      if (!structureKeys.has(key) || currentStructureKeys.has(key)) continue;
      structureAssignments.push({
        structureKey: key,
        areaRatio: structureAreaRatio(key),
        reason: "Reserved as compact support infrastructure so the generated plan includes usable farm operations space.",
      });
      currentStructureKeys.add(key);
    }
  }

  return {
    ...intent,
    cropAssignments,
    livestockAssignments: normalizeRatios(livestockAssignments, 0.2),
    structures: normalizeRatios(structureAssignments, 0.14),
  };
}

function ensureCropAssignments(
  assignments: GeminiFarmIntent["cropAssignments"],
  candidateCrops: AiDraftCrop[],
  preferences: FarmAiDraftPreferences,
  siteContext: SiteGrowingContext,
  areaSquareFeet: number,
): GeminiFarmIntent["cropAssignments"] {
  const targetCount = targetCropCountForLabor(areaSquareFeet, preferences);
  const assignmentMap = new Map(assignments.map((assignment) => [assignment.cropKey, assignment]));
  const maxCropCount = maxCropCountForLabor(preferences);
  const notePreferredCrops = noteMatchedCrops(candidateCrops, preferences, "prefer").slice(0, Math.max(1, Math.min(3, maxCropCount - 1)));
  const selected = selectDiverseCrops(candidateCrops, preferences, siteContext, Math.min(12, Math.max(targetCount + 4, assignments.length)), areaSquareFeet);
  const selectedWithNotes = mergePreferredCrops(notePreferredCrops, selected, Math.min(maxCropCount, Math.max(targetCount, Math.min(8, selected.length))));
  const merged = selectedWithNotes.map((crop) => {
    const existing = assignmentMap.get(crop.key);
    const notePreferred = notePreferredCrops.some((item) => item.key === crop.key);
    return {
      cropKey: crop.key,
      areaRatio: existing?.areaRatio ?? 0.08,
      estimatedPlantCount: existing?.estimatedPlantCount ?? (crop.defaultCount || 12),
      reason: existing?.reason || (notePreferred
        ? `Included because the user notes mention ${crop.name}.`
        : "Selected by deterministic popularity, local climate, season, labor, water, budget, household, and goal scoring."),
    };
  });

  return normalizeRatios(merged, 0.72);
}

function preferredStructureKeys(hasLivestock: boolean) {
  return hasLivestock
    ? ["coop", "shed", "storage", "barn", "compost"]
    : ["shed", "storage", "compost", "barn", "coop"];
}

function structureAreaRatio(structureKey: string) {
  switch (structureKey) {
    case "barn":
      return 0.055;
    case "coop":
    case "shed":
    case "storage":
      return 0.032;
    default:
      return 0.025;
  }
}

function targetCropCountForLabor(areaSquareFeet: number, preferences: FarmAiDraftPreferences) {
  const base = areaSquareFeet < 700 ? 2 : areaSquareFeet < 1500 ? 3 : areaSquareFeet < 2500 ? 4 : areaSquareFeet < 7000 ? 6 : 8;
  return Math.max(2, Math.min(base, maxCropCountForLabor(preferences)));
}

function maxCropCountForLabor(preferences: FarmAiDraftPreferences) {
  if (preferences.weeklyHours <= 3) return 2;
  if (preferences.weeklyHours <= 5) return 3;
  if (preferences.weeklyHours <= 8) return 5;
  if (preferences.weeklyHours <= 12) return 7;
  return 9;
}

function createObjectsFromIntent(
  boundary: LocalPoint[],
  intent: GeminiFarmIntent,
  crops: AiDraftCrop[],
  livestock: AiDraftLivestock[],
  structures: AiDraftStructure[],
): { objects: FarmV2Object[]; assessment: LayoutAssessment } {
  let best: { objects: FarmV2Object[]; assessment: LayoutAssessment } | null = null;
  const variants = createLayoutVariants(boundary, intent);

  for (const [index, variant] of variants.entries()) {
    const layout = createGeometricLayout(boundary, intent, variant);
    const objects = createObjectsForLayout(layout, intent, crops, livestock, structures);
    const assessment = assessGeneratedLayout(boundary, objects, variant, index + 1, intent);
    const candidate = { objects, assessment };
    if (!best || assessment.score > best.assessment.score) best = candidate;
    if (assessment.passed) return candidate;
  }

  return best || {
    objects: [],
    assessment: {
      passed: false,
      score: 0,
      iteration: 0,
      variant: "none",
      objectCount: 0,
      cropCount: 0,
      livestockCount: 0,
      structureCount: 0,
      overlapCount: 0,
      outsideCount: 0,
      pathCrossingCount: 0,
      labelCollisionCount: 0,
      wideLabelCount: 0,
      nonRectangularCount: 0,
      minSolidSide: 0,
      maxAspectRatio: 0,
      solidCoverageRatio: 0,
      notes: ["No valid deterministic layout candidates were produced."],
    },
  };
}

function createObjectsForLayout(
  layout: LayoutResult,
  intent: GeminiFarmIntent,
  crops: AiDraftCrop[],
  livestock: AiDraftLivestock[],
  structures: AiDraftStructure[],
): FarmV2Object[] {
  const objects: FarmV2Object[] = [];
  const cropAssignments = intent.cropAssignments.slice(0, layout.cropCells.length);

  cropAssignments.forEach((assignment, index) => {
    const crop = crops.find((item) => item.key === assignment.cropKey);
    if (!crop) return;
    const cell = layout.cropCells[index];
    const fieldId = `gemini-field-${crop.key}-${index + 1}`;
    objects.push({
      id: fieldId,
      label: `${crop.name} Field`,
      type: "cropField",
      parentId: null,
      polygon: cell.polygon,
      height: 0.76,
      attrs: {
        status: "AI planned",
        planted: new Date().toISOString().slice(0, 10),
        soil: crop.soilTexture || "Mixed",
        rows: Math.max(1, Math.round(Math.sqrt(assignment.estimatedPlantCount))),
        cropKey: crop.key,
        cropName: crop.name,
        count: assignment.estimatedPlantCount,
        visual: crop.visual,
        growth: cropRenderGrowth(crop),
        idealSpaceSqft: crop.idealSpaceSqft,
        harvestCycles: crop.harvestCycles,
        catalogKnown: true,
      },
    });
  });

  intent.livestockAssignments.slice(0, layout.livestockCells.length).forEach((assignment, index) => {
    const animal = livestock.find((item) => item.key === assignment.livestockKey);
    if (!animal) return;
    const cell = layout.livestockCells[index];
    objects.push({
      id: `gemini-livestock-${animal.key}-${index + 1}`,
      label: `${animal.name} Paddock`,
      type: "livestock",
      polygon: cell.polygon,
      height: 0.55,
      attrs: { species: animal.name, breed: "Mixed", count: assignment.count, status: "AI planned" },
    });
  });

  intent.structures.slice(0, layout.structureCells.length).forEach((assignment, index) => {
    const structure = structures.find((item) => item.key === assignment.structureKey) || {
      key: "compost",
      name: "Compost Bay",
      material: "Wood bays",
      height: 3.2,
    };
    const cell = layout.structureCells[index];
    const footprint = structureFootprint(cell, structure.key);
    objects.push({
      id: `gemini-structure-${structure.key}-${index + 1}`,
      label: structure.name,
      type: "structure",
      polygon: footprint,
      height: structure.height,
      attrs: { kind: structure.name, height: structure.height, material: structure.material, status: "AI planned" },
    });
  });

  return objects;
}

function cropRenderGrowth(crop: AiDraftCrop) {
  const text = `${crop.key} ${crop.name} ${crop.visual}`.toLowerCase();
  if (/\btomato|tomatoes\b/.test(text)) return 0.68;
  if (/\bpepper|eggplant|strawberr|blueberr|blackberr|raspberr\b/.test(text)) return 0.62;
  if (/\bcucumber|squash|pumpkin|melon|bean|pea\b/.test(text)) return 0.58;
  if (/\blettuce|spinach|kale|chard|basil|cilantro|parsley\b/.test(text)) return 0.64;
  return 0.52;
}

function rectPolygon({ x, y, width, depth }: Placement): LocalPoint[] {
  return [
    [roundPoint(x), roundPoint(y)],
    [roundPoint(x + width), roundPoint(y)],
    [roundPoint(x + width), roundPoint(y + depth)],
    [roundPoint(x), roundPoint(y + depth)],
  ];
}

function createLayoutVariants(boundary: LocalPoint[], intent: GeminiFarmIntent): LayoutVariant[] {
  const area = Math.max(1, polygonArea(boundary));
  const baseCropLimit = area < 700 ? 2 : area < 1500 ? 3 : area < 2500 ? 4 : area < 7000 ? 6 : 8;
  const requestedCropLimit = Math.min(baseCropLimit, Math.max(Math.min(3, baseCropLimit), intent.cropAssignments.length));
  const variants: LayoutVariant[] = [
    {
      name: "balanced",
      cropLimit: requestedCropLimit,
      gapScale: 0.85,
      minCellSide: 14,
    },
    {
      name: "spacious",
      cropLimit: Math.max(Math.min(2, baseCropLimit), requestedCropLimit - 1),
      gapScale: 1,
      minCellSide: 16,
    },
    {
      name: "wide-utility",
      cropLimit: Math.max(Math.min(2, baseCropLimit), requestedCropLimit - 1),
      gapScale: 1.1,
      minCellSide: 16,
    },
    {
      name: "label-safe",
      cropLimit: Math.max(Math.min(2, baseCropLimit), Math.min(5, requestedCropLimit - 2)),
      gapScale: 1.2,
      minCellSide: 18,
    },
  ];

  return variants.filter((variant, index, list) =>
    list.findIndex((item) =>
      item.cropLimit === variant.cropLimit
      && item.gapScale === variant.gapScale
      && item.minCellSide === variant.minCellSide
    ) === index,
  );
}

function createGeometricLayout(boundary: LocalPoint[], intent: GeminiFarmIntent, variant: LayoutVariant): LayoutResult {
  const buildablePolygon = createBuildablePolygon(boundary);
  const buildableBox = getBBox(buildablePolygon);
  const buildable = snapPlacement({
    x: buildableBox.minX,
    y: buildableBox.minY,
    width: Math.max(1, buildableBox.maxX - buildableBox.minX),
    depth: Math.max(1, buildableBox.maxY - buildableBox.minY),
  });
  const gap = Math.max(2, Math.min(4.2, Math.min(buildable.width, buildable.depth) * 0.045) * variant.gapScale);
  const content = snapPlacement({
    x: buildable.x,
    y: buildable.y,
    width: buildable.width,
    depth: buildable.depth,
  });
  const cropZone = content;
  const contentPolygon = clipPolygonToConvexClip(rectPolygon(content), buildablePolygon);
  const slots = createLayoutSlots(intent, variant);
  const gridCells = createWeightedGridCells(content, contentPolygon, slots, gap * 0.85, variant.minCellSide);
  const cropCells = gridCells.filter((cell) => cell.role === "crop").sort((a, b) => a.index - b.index);
  const structureCells = gridCells.filter((cell) => cell.role === "structure").sort((a, b) => a.index - b.index);
  const livestockCells = gridCells.filter((cell) => cell.role === "livestock").sort((a, b) => a.index - b.index);

  return {
    cropZone,
    cropCells,
    structureCells,
    livestockCells,
    gridCells,
  };
}

function findBuildableRect(boundary: LocalPoint[]): Placement {
  const box = getBBox(boundary);
  const width = box.maxX - box.minX;
  const depth = box.maxY - box.minY;
  for (const ratio of [0.035, 0.05, 0.07, 0.09, 0.12, 0.16, 0.22]) {
    const margin = Math.max(4, Math.min(width, depth) * ratio);
    const rect = snapPlacement({
      x: box.minX + margin,
      y: box.minY + margin,
      width: Math.max(20, width - margin * 2),
      depth: Math.max(20, depth - margin * 2),
    });
    if (rectPolygon(rect).every((point) => pointInPolygon(point, boundary))) return rect;
  }

  return snapPlacement({
    x: box.minX + width * 0.2,
    y: box.minY + depth * 0.2,
    width: Math.max(20, width * 0.6),
    depth: Math.max(20, depth * 0.6),
  });
}

function createBuildablePolygon(boundary: LocalPoint[]) {
  const sanitized = sanitizeLocalPoints(boundary);
  if (sanitized.length < 3) return rectPolygon(findBuildableRect(boundary));
  const box = getBBox(sanitized);
  const minDimension = Math.min(box.maxX - box.minX, box.maxY - box.minY);
  const margin = Math.max(2, Math.min(4.5, minDimension * 0.04));
  const centroid = polygonCentroid(sanitized);
  const inset = sanitized.map((point) => {
    const dx = centroid[0] - point[0];
    const dy = centroid[1] - point[1];
    const distance = Math.hypot(dx, dy);
    const shift = Math.min(margin, Math.max(0, distance * 0.32));
    return distance > 0
      ? [roundPoint(point[0] + dx / distance * shift), roundPoint(point[1] + dy / distance * shift)] as LocalPoint
      : point;
  });

  return inset.length >= 3 && Math.abs(polygonArea(inset)) >= 12 ? inset : rectPolygon(findBuildableRect(boundary));
}

function createLayoutSlots(intent: GeminiFarmIntent, variant: LayoutVariant): LayoutSlot[] {
  const cropCount = Math.min(variant.cropLimit, Math.max(3, intent.cropAssignments.length));
  const slots: LayoutSlot[] = [];

  intent.cropAssignments.slice(0, cropCount).forEach((assignment, index) => {
    slots.push({
      role: "crop",
      index,
      weight: roundPoint(2 + Math.max(0.04, assignment.areaRatio) * 7),
    });
  });

  intent.livestockAssignments.forEach((assignment, index) => {
    slots.push({
      role: "livestock",
      index,
      weight: roundPoint(2.2 + Math.max(0.04, assignment.areaRatio) * 5),
    });
  });

  intent.structures.forEach((assignment, index) => {
    slots.push({
      role: "structure",
      index,
      weight: structureSlotWeight(assignment.structureKey),
    });
  });

  return slots.sort((first, second) => rolePriority(first.role) - rolePriority(second.role) || second.weight - first.weight || first.index - second.index);
}

function structureSlotWeight(structureKey: string) {
  switch (structureKey) {
    case "barn":
      return 1.55;
    case "shed":
    case "storage":
      return 0.85;
    case "coop":
      return 0.7;
    default:
      return 0.75;
  }
}

function rolePriority(role: GridCell["role"]) {
  if (role === "livestock") return 0;
  if (role === "structure") return 1;
  return 2;
}

function createWeightedGridCells(
  zone: Placement,
  clipPolygon: LocalPoint[],
  slots: LayoutSlot[],
  gap: number,
  minSide: number,
): GridCell[] {
  const placements = splitWeightedPlacement(zone, slots, gap);
  return placements.map(({ placement, slot }) => ({
    placement,
    polygon: clippedCellPolygon(placement, clipPolygon),
    role: slot.role,
    index: slot.index,
  })).filter((cell) => {
    const box = getBBox(cell.polygon);
    const minDimension = Math.min(box.maxX - box.minX, box.maxY - box.minY);
    const minimumArea = cell.role === "structure" ? 16 : minSide * minSide * 0.22;
    return cell.polygon.length >= 3 && polygonArea(cell.polygon) >= minimumArea && minDimension >= (cell.role === "structure" ? 4 : minSide * 0.45);
  });
}

function splitWeightedPlacement(zone: Placement, slots: LayoutSlot[], gap: number): Array<{ placement: Placement; slot: LayoutSlot }> {
  if (slots.length <= 1) return slots.map((slot) => ({ placement: snapPlacement(zone), slot }));
  const totalWeight = slots.reduce((sum, slot) => sum + slot.weight, 0);
  let splitIndex = 1;
  let bestDifference = Infinity;
  let runningWeight = 0;

  for (let index = 0; index < slots.length - 1; index += 1) {
    runningWeight += slots[index].weight;
    const difference = Math.abs(totalWeight / 2 - runningWeight);
    if (difference < bestDifference) {
      bestDifference = difference;
      splitIndex = index + 1;
    }
  }

  const firstSlots = slots.slice(0, splitIndex);
  const secondSlots = slots.slice(splitIndex);
  const firstWeight = firstSlots.reduce((sum, slot) => sum + slot.weight, 0);
  const secondWeight = Math.max(0.1, totalWeight - firstWeight);
  const splitWidth = zone.width >= zone.depth;

  if (splitWidth) {
    const availableWidth = Math.max(1, zone.width - gap);
    const firstWidth = availableWidth * firstWeight / (firstWeight + secondWeight);
    const secondWidth = availableWidth - firstWidth;
    return [
      ...splitWeightedPlacement({ x: zone.x, y: zone.y, width: firstWidth, depth: zone.depth }, firstSlots, gap),
      ...splitWeightedPlacement({ x: zone.x + firstWidth + gap, y: zone.y, width: secondWidth, depth: zone.depth }, secondSlots, gap),
    ];
  }

  const availableDepth = Math.max(1, zone.depth - gap);
  const firstDepth = availableDepth * firstWeight / (firstWeight + secondWeight);
  const secondDepth = availableDepth - firstDepth;
  return [
    ...splitWeightedPlacement({ x: zone.x, y: zone.y, width: zone.width, depth: firstDepth }, firstSlots, gap),
    ...splitWeightedPlacement({ x: zone.x, y: zone.y + firstDepth + gap, width: zone.width, depth: secondDepth }, secondSlots, gap),
  ];
}

function clippedCellPolygon(placement: Placement, clipPolygon: LocalPoint[]) {
  if (clipPolygon.length < 3) return rectPolygon(placement);
  return simplifyPolygon(clipPolygonToConvexClip(rectPolygon(placement), clipPolygon));
}

function summarizeLayoutGeometry(boundary: LocalPoint[]) {
  const buildablePolygon = createBuildablePolygon(boundary);
  const box = getBBox(buildablePolygon);
  const buildable = snapPlacement({
    x: box.minX,
    y: box.minY,
    width: box.maxX - box.minX,
    depth: box.maxY - box.minY,
  });
  const gap = Math.max(2, Math.min(4.2, Math.min(buildable.width, buildable.depth) * 0.045));
  return {
    buildableRectFeet: buildable,
    buildableOutlineFeet: buildablePolygon,
    approximateWalkingGapFeet: roundPoint(gap),
    fillGoal: "Use most of the buildable rectangle. Leave only narrow walking gaps between plots and sections.",
    cropGeometry: "Crop plots are packed deterministically into full sections, then clipped to the inset land outline. Edge plots may become triangles, trapezoids, or irregular polygons when the land shape requires it.",
    generationBoundary: "Gemini chooses only crops, structures, livestock, budget, and agronomic priorities. Geometry is generated by code.",
  };
}

function snapPlacement(placement: Placement): Placement {
  return {
    x: roundPoint(placement.x),
    y: roundPoint(placement.y),
    width: roundPoint(placement.width),
    depth: roundPoint(placement.depth),
  };
}

function structureFootprint(cell: PlotCell, structureKey: string) {
  const box = getBBox(cell.polygon);
  const width = Math.max(1, box.maxX - box.minX);
  const depth = Math.max(1, box.maxY - box.minY);
  const cap = structureFootprintCap(structureKey);
  const footprintWidth = Math.min(width * 0.72, cap.width);
  const footprintDepth = Math.min(depth * 0.72, cap.depth);
  const x = box.minX + (width - footprintWidth) / 2;
  const y = box.minY + (depth - footprintDepth) / 2;
  const footprint = rectPolygon({ x, y, width: footprintWidth, depth: footprintDepth });
  const clipped = clippedCellPolygon({ x, y, width: footprintWidth, depth: footprintDepth }, cell.polygon);
  return clipped.length >= 3 && polygonArea(clipped) >= 12 ? clipped : footprint;
}

function structureFootprintCap(structureKey: string) {
  switch (structureKey) {
    case "barn":
      return { width: 26, depth: 20 };
    case "coop":
      return { width: 12, depth: 10 };
    case "shed":
      return { width: 14, depth: 11 };
    case "storage":
      return { width: 14, depth: 12 };
    default:
      return { width: 12, depth: 10 };
  }
}

function assessGeneratedLayout(
  boundary: LocalPoint[],
  objects: FarmV2Object[],
  variant: LayoutVariant,
  iteration: number,
  intent: GeminiFarmIntent,
): LayoutAssessment {
  const solids = objects.filter((object) => Boolean(objectPolygon(object)) && object.type !== "cropArea");
  const solidBoxes = solids.map((object) => ({ object, box: getBBox(objectPolygon(object) || []) }));
  const overlapPairs: string[] = [];
  const labelBoxes = solidBoxes.map(({ object, box }) => ({ object, box, labelBox: labelBBox(object, box) }));
  const labelCollisions: string[] = [];
  const wideLabels = labelBoxes.filter(({ box, labelBox }) => labelBox.maxX - labelBox.minX > (box.maxX - box.minX) + 4);
  const nonRectangularCount = solids.filter((object) => {
    const polygon = objectPolygon(object);
    return polygon ? !isAxisAlignedRectangle(polygon) : false;
  }).length;
  const buildablePolygon = createBuildablePolygon(boundary);
  const outside = solids.filter((object) => {
    const polygon = objectPolygon(object);
    return polygon ? polygon.some((point) => !pointInPolygon(point, boundary)) : false;
  });

  for (let i = 0; i < solidBoxes.length; i += 1) {
    for (let j = i + 1; j < solidBoxes.length; j += 1) {
      const firstPolygon = objectPolygon(solidBoxes[i].object);
      const secondPolygon = objectPolygon(solidBoxes[j].object);
      if (
        firstPolygon
        && secondPolygon
        && boxesOverlap(solidBoxes[i].box, solidBoxes[j].box, 0.1)
        && polygonOverlapArea(firstPolygon, secondPolygon) > 0.5
      ) {
        overlapPairs.push(`${solidBoxes[i].object.label} / ${solidBoxes[j].object.label}`);
      }
    }
  }

  for (let i = 0; i < labelBoxes.length; i += 1) {
    for (let j = i + 1; j < labelBoxes.length; j += 1) {
      if (boxesOverlap(labelBoxes[i].labelBox, labelBoxes[j].labelBox, 0.7)) {
        labelCollisions.push(`${labelBoxes[i].object.label} / ${labelBoxes[j].object.label}`);
      }
    }
  }

  const sides = solidBoxes.flatMap(({ box }) => [box.maxX - box.minX, box.maxY - box.minY]).filter((value) => value > 0);
  const aspects = solidBoxes.map(({ box }) => {
    const width = Math.max(1, box.maxX - box.minX);
    const depth = Math.max(1, box.maxY - box.minY);
    return Math.max(width / depth, depth / width);
  });
  const solidArea = solids.reduce((sum, object) => sum + polygonArea(objectPolygon(object) || []), 0);
  const solidCoverageRatio = clampScore(solidArea / Math.max(1, polygonArea(buildablePolygon)));
  const buildableArea = Math.max(1, polygonArea(buildablePolygon));
  const minSolidSide = sides.length ? Math.min(...sides) : 0;
  const maxAspectRatio = aspects.length ? Math.max(...aspects) : 0;
  const cropCount = objects.filter((object) => object.type === "cropField").length;
  const livestockCount = objects.filter((object) => object.type === "livestock").length;
  const structureCount = objects.filter((object) => object.type === "structure").length;
  const requiredCropCount = buildableArea < 700 ? 1 : buildableArea < 1500 ? 2 : 3;
  const requiredLivestockCount = intent.livestockAssignments.length ? 1 : 0;
  const requiredStructureCount = intent.structures.length ? 1 : 0;
  const minSideThreshold = buildableArea < 450 ? 3 : buildableArea < 1000 ? 3.5 : 8;
  const coverageThreshold = buildableArea < 450 ? 0.3 : buildableArea < 1000 ? 0.4 : 0.5;
  const labelCollisionAllowance = buildableArea < 1000 ? 4 : 1;
  const labelPenaltyScale = buildableArea < 1000 ? 0.015 : 0.07;
  const wideLabelPenaltyScale = buildableArea < 1000 ? 0.005 : 0.025;
  const notes: string[] = [];

  if (overlapPairs.length) notes.push(`Removed object overlap risk: ${overlapPairs.slice(0, 2).join("; ")}`);
  if (outside.length) notes.push(`Objects outside boundary: ${outside.map((object) => object.label).slice(0, 3).join(", ")}`);
  if (labelCollisions.length) notes.push(`Label collision risk: ${labelCollisions.slice(0, 2).join("; ")}`);
  if (wideLabels.length) notes.push(`Long labels need spacious cells: ${wideLabels.map(({ object }) => object.label).slice(0, 3).join(", ")}`);
  if (solidCoverageRatio < coverageThreshold) notes.push(`Low section fill ratio: ${solidCoverageRatio}`);
  if (livestockCount < requiredLivestockCount) notes.push("Livestock was requested but no paddock survived deterministic placement.");
  if (structureCount < requiredStructureCount) notes.push("Structures were requested but no compact structure survived deterministic placement.");
  if (minSolidSide < minSideThreshold) notes.push(`A generated cell is too small: ${roundPoint(minSolidSide)} ft`);
  if (!notes.length) notes.push("Plan passed deterministic geometry and label checks.");

  const score = clampScore(
    1
    - overlapPairs.length * 0.24
    - outside.length * 0.3
    - Math.max(0, labelCollisions.length - labelCollisionAllowance) * labelPenaltyScale
    - wideLabels.length * wideLabelPenaltyScale
    - Math.max(0, minSideThreshold - minSolidSide) * 0.035
    - Math.max(0, maxAspectRatio - 3.2) * 0.035
    - Math.max(0, coverageThreshold + 0.06 - solidCoverageRatio) * 0.4
    - (nonRectangularCount ? 0 : 0.04)
    - (cropCount < requiredCropCount ? 0.2 : 0)
    - (livestockCount < requiredLivestockCount ? 0.2 : 0)
    - (structureCount < requiredStructureCount ? 0.16 : 0),
  );
  const passed = score >= 0.9
    && overlapPairs.length === 0
    && outside.length === 0
    && labelCollisions.length <= labelCollisionAllowance
    && cropCount >= requiredCropCount
    && livestockCount >= requiredLivestockCount
    && structureCount >= requiredStructureCount
    && minSolidSide >= minSideThreshold
    && solidCoverageRatio >= coverageThreshold;

  return {
    passed,
    score,
    iteration,
    variant: variant.name,
    objectCount: objects.length,
    cropCount,
    livestockCount,
    structureCount,
    overlapCount: overlapPairs.length,
    outsideCount: outside.length,
    pathCrossingCount: 0,
    labelCollisionCount: labelCollisions.length,
    wideLabelCount: wideLabels.length,
    nonRectangularCount,
    minSolidSide: roundPoint(minSolidSide),
    maxAspectRatio: roundPoint(maxAspectRatio),
    solidCoverageRatio,
    notes,
  };
}

function objectPolygon(object: FarmV2Object): LocalPoint[] | null {
  return "polygon" in object && Array.isArray(object.polygon) ? object.polygon : null;
}

function labelBBox(object: FarmV2Object, box: ReturnType<typeof getBBox>) {
  const centerX = (box.minX + box.maxX) / 2;
  const centerY = (box.minY + box.maxY) / 2;
  const width = Math.max(12, Math.min(38, object.label.length * 1.12));
  const depth = 5.2;
  return {
    minX: centerX - width / 2,
    maxX: centerX + width / 2,
    minY: centerY - depth / 2,
    maxY: centerY + depth / 2,
  };
}

function boxesOverlap(
  first: ReturnType<typeof getBBox>,
  second: ReturnType<typeof getBBox>,
  padding: number,
) {
  return first.minX - padding < second.maxX
    && first.maxX + padding > second.minX
    && first.minY - padding < second.maxY
    && first.maxY + padding > second.minY;
}

function isAxisAlignedRectangle(polygon: LocalPoint[]) {
  if (polygon.length !== 4) return false;
  const uniqueX = new Set(polygon.map((point) => roundPoint(point[0])));
  const uniqueY = new Set(polygon.map((point) => roundPoint(point[1])));
  return uniqueX.size === 2 && uniqueY.size === 2;
}

function clipPolygonToConvexClip(subject: LocalPoint[], clip: LocalPoint[]) {
  if (subject.length < 3 || clip.length < 3) return [];
  let output = subject;
  const clipArea = signedPolygonArea(clip);
  for (let index = 0; index < clip.length; index += 1) {
    const clipStart = clip[index];
    const clipEnd = clip[(index + 1) % clip.length];
    const input = output;
    output = [];
    if (!input.length) break;

    let segmentStart = input[input.length - 1];
    for (const segmentEnd of input) {
      const endInside = insideClipEdge(segmentEnd, clipStart, clipEnd, clipArea);
      const startInside = insideClipEdge(segmentStart, clipStart, clipEnd, clipArea);
      if (endInside) {
        if (!startInside) output.push(lineIntersection(segmentStart, segmentEnd, clipStart, clipEnd));
        output.push(segmentEnd);
      } else if (startInside) {
        output.push(lineIntersection(segmentStart, segmentEnd, clipStart, clipEnd));
      }
      segmentStart = segmentEnd;
    }
  }

  return simplifyPolygon(output);
}

function simplifyPolygon(points: LocalPoint[]) {
  const deduped = points.filter((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    return !previous || Math.hypot(point[0] - previous[0], point[1] - previous[1]) > 0.05;
  });
  return deduped.filter((point, index) => {
    const previous = deduped[(index + deduped.length - 1) % deduped.length];
    const next = deduped[(index + 1) % deduped.length];
    return Math.abs(cross(previous, point, next)) > 0.05;
  });
}

function polygonOverlapArea(first: LocalPoint[], second: LocalPoint[]) {
  if (first.length < 3 || second.length < 3) return 0;
  const output = clipPolygonToConvexClip(first, second);
  return output.length >= 3 ? Math.abs(signedPolygonArea(output)) : 0;
}

function insideClipEdge(point: LocalPoint, start: LocalPoint, end: LocalPoint, clipArea: number) {
  const crossValue = cross(start, end, point);
  return clipArea >= 0 ? crossValue >= -0.001 : crossValue <= 0.001;
}

function lineIntersection(a: LocalPoint, b: LocalPoint, c: LocalPoint, d: LocalPoint): LocalPoint {
  const x1 = a[0];
  const y1 = a[1];
  const x2 = b[0];
  const y2 = b[1];
  const x3 = c[0];
  const y3 = c[1];
  const x4 = d[0];
  const y4 = d[1];
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 0.001) return [roundPoint(x2), roundPoint(y2)];
  const px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denominator;
  const py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denominator;
  return [roundPoint(px), roundPoint(py)];
}

function signedPolygonArea(points: LocalPoint[]) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
}

function cross(start: LocalPoint, end: LocalPoint, point: LocalPoint) {
  return (end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0]);
}

function polygonCentroid(points: LocalPoint[]): LocalPoint {
  const area = signedPolygonArea(points);
  if (Math.abs(area) < 0.001) {
    const sum = points.reduce((acc, point) => [acc[0] + point[0], acc[1] + point[1]] as LocalPoint, [0, 0]);
    return [sum[0] / points.length, sum[1] / points.length];
  }

  let x = 0;
  let y = 0;
  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const next = points[(index + 1) % points.length];
    const factor = point[0] * next[1] - next[0] * point[1];
    x += (point[0] + next[0]) * factor;
    y += (point[1] + next[1]) * factor;
  }

  return [x / (6 * area), y / (6 * area)];
}

function buildSiteGrowingContext(geo: GeoPoint[], preferences: FarmAiDraftPreferences): SiteGrowingContext {
  const centroid = geoCentroid(geo);
  const latitude = centroid?.latitude ?? 38.5449;
  const longitude = centroid?.longitude ?? -121.7405;
  const hemisphere = latitude !== null && latitude < 0 ? "south" : "north";
  const climate = classifyClimate(latitude, longitude);
  const { winterLow, summerHigh, rainfall, region } = estimateAnnualClimate(latitude, longitude, climate);
  const seasonWindow = estimateSeasonWindow(preferences.season, winterLow, summerHigh);

  return {
    latitude,
    longitude,
    hemisphere,
    region,
    climate,
    season: preferences.season,
    seasonLabel: seasonalLabel(preferences.season, hemisphere),
    estimatedSeasonLowC: seasonWindow.low,
    estimatedSeasonHighC: seasonWindow.high,
    estimatedWinterLowC: winterLow,
    estimatedSummerHighC: summerHigh,
    estimatedAnnualRainfallMm: rainfall,
    frostRisk: winterLow <= -8 ? "high" : winterLow <= 2 ? "medium" : "low",
    heatRisk: summerHigh >= 37 ? "high" : summerHigh >= 32 ? "medium" : "low",
    livestockHeatStress: summerHigh >= 35 ? "high" : summerHigh >= 30 ? "medium" : "low",
  };
}

function geoCentroid(points: GeoPoint[]) {
  const valid = points.filter((point) =>
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    point[0] >= -180 &&
    point[0] <= 180 &&
    point[1] >= -90 &&
    point[1] <= 90,
  );
  if (!valid.length) return null;
  return {
    longitude: valid.reduce((sum, point) => sum + point[0], 0) / valid.length,
    latitude: valid.reduce((sum, point) => sum + point[1], 0) / valid.length,
  };
}

function classifyClimate(latitude: number | null, longitude: number | null): SiteGrowingContext["climate"] {
  if (latitude === null || longitude === null) return "temperate";
  const absLat = Math.abs(latitude);
  if (absLat < 23.5) return "tropical";
  if (isCaliforniaMediterranean(latitude, longitude)) return "mediterranean";
  if (longitude >= -125 && longitude <= -100 && latitude >= 25 && latitude <= 45) return "arid";
  if (absLat >= 50) return "cold";
  if (longitude >= -100 && longitude <= -65 && latitude >= 24 && latitude <= 47) return "humid";
  return "temperate";
}

function estimateAnnualClimate(
  latitude: number | null,
  longitude: number | null,
  climate: SiteGrowingContext["climate"],
) {
  if (latitude !== null && longitude !== null && isCaliforniaMediterranean(latitude, longitude)) {
    return {
      winterLow: 2,
      summerHigh: 36,
      rainfall: 470,
      region: "California Mediterranean/Central Valley",
    };
  }

  switch (climate) {
    case "tropical":
      return { winterLow: 18, summerHigh: 34, rainfall: 1400, region: "Tropical/subtropical" };
    case "arid":
      return { winterLow: 0, summerHigh: 38, rainfall: 300, region: "Dry western interior" };
    case "humid":
      return { winterLow: -2, summerHigh: 33, rainfall: 1100, region: "Humid temperate" };
    case "cold":
      return { winterLow: -14, summerHigh: 27, rainfall: 650, region: "Cold northern" };
    case "mediterranean":
      return { winterLow: 3, summerHigh: 34, rainfall: 520, region: "Mediterranean" };
    default: {
      const absLat = Math.abs(latitude ?? 38);
      return {
        winterLow: Math.round(14 - absLat * 0.38),
        summerHigh: Math.round(34 - Math.max(0, absLat - 32) * 0.18),
        rainfall: 750,
        region: latitude === null || longitude === null ? "Unknown mapped site" : "Temperate",
      };
    }
  }
}

function estimateSeasonWindow(
  season: FarmAiDraftPreferences["season"],
  winterLow: number,
  summerHigh: number,
) {
  switch (season) {
    case "summer":
      return { low: Math.round(summerHigh - 16), high: summerHigh };
    case "fall":
      return { low: Math.round(winterLow + 8), high: Math.round(summerHigh - 6) };
    case "winter":
      return { low: winterLow, high: Math.round(winterLow + 13) };
    case "year-round":
      return { low: Math.round(winterLow + 4), high: Math.round(summerHigh - 3) };
    default:
      return { low: Math.round(winterLow + 6), high: Math.round(summerHigh - 8) };
  }
}

function isCaliforniaMediterranean(latitude: number, longitude: number) {
  return longitude >= -124.5 && longitude <= -114 && latitude >= 32 && latitude <= 42.5;
}

function seasonalLabel(season: FarmAiDraftPreferences["season"], hemisphere: SiteGrowingContext["hemisphere"]) {
  if (season === "year-round") return "Year-round rotation";
  return `${hemisphere === "south" ? "Southern" : "Northern"} hemisphere ${season}`;
}

function seasonForDate(date: Date): FarmAiDraftPreferences["season"] {
  const month = date.getMonth();
  if (month <= 1 || month === 11) return "winter";
  if (month <= 4) return "spring";
  if (month <= 7) return "summer";
  return "fall";
}

function selectCandidateCrops(crops: AiDraftCrop[], preferences: FarmAiDraftPreferences, siteContext: SiteGrowingContext) {
  const noteExcluded = new Set(noteMatchedCrops(crops, preferences, "exclude").map((crop) => crop.key));
  const notePreferred = new Set(noteMatchedCrops(crops, preferences, "prefer").map((crop) => crop.key));
  const excluded = new Set([...preferences.excludedCropKeys, ...noteExcluded]);
  const preferred = new Set([...preferences.preferredCropKeys, ...notePreferred]);
  const scored = crops
    .filter((crop) => !excluded.has(crop.key))
    .map((crop) => ({
      crop,
      score: cropScore(crop, preferences, siteContext, preferred.has(crop.key)),
      family: cropFamily(crop),
    }))
    .sort((a, b) => b.score - a.score || a.crop.name.localeCompare(b.crop.name));

  return diversifyScoredCrops(scored, 42).map((item) => item.crop);
}

function selectDiverseCrops(crops: AiDraftCrop[], preferences: FarmAiDraftPreferences, siteContext: SiteGrowingContext, limit: number, areaSquareFeet: number) {
  const noteExcluded = new Set(noteMatchedCrops(crops, preferences, "exclude").map((crop) => crop.key));
  const notePreferred = new Set(noteMatchedCrops(crops, preferences, "prefer").map((crop) => crop.key));
  const preferred = new Set([...preferences.preferredCropKeys, ...notePreferred]);
  const scored = crops
    .filter((crop) => !noteExcluded.has(crop.key))
    .map((crop) => ({
      crop,
      score: cropScore(crop, preferences, siteContext, preferred.has(crop.key), areaSquareFeet),
      family: cropFamily(crop),
    }))
    .sort((a, b) => b.score - a.score || a.crop.name.localeCompare(b.crop.name));

  return diversifyScoredCrops(scored, limit).map((item) => item.crop);
}

function diversifyScoredCrops(scored: ScoredCrop[], limit: number) {
  const selected: ScoredCrop[] = [];
  const selectedKeys = new Set<string>();
  const familyCounts = new Map<string, number>();
  const maxPerFamily = limit <= 4 ? 1 : limit <= 8 ? 2 : 4;

  for (const item of scored) {
    if (selected.length >= limit) break;
    const count = familyCounts.get(item.family) || 0;
    if (count >= maxPerFamily) continue;
    selected.push(item);
    selectedKeys.add(item.crop.key);
    familyCounts.set(item.family, count + 1);
  }

  for (const item of scored) {
    if (selected.length >= limit) break;
    if (selectedKeys.has(item.crop.key)) continue;
    selected.push(item);
    selectedKeys.add(item.crop.key);
  }

  return selected;
}

function mergePreferredCrops(preferred: AiDraftCrop[], selected: AiDraftCrop[], limit: number) {
  const merged: AiDraftCrop[] = [];
  const seen = new Set<string>();
  for (const crop of [...preferred, ...selected]) {
    if (merged.length >= limit) break;
    if (seen.has(crop.key)) continue;
    merged.push(crop);
    seen.add(crop.key);
  }
  return merged;
}

function cropScore(crop: AiDraftCrop, preferences: FarmAiDraftPreferences, siteContext: SiteGrowingContext, preferred: boolean, areaSquareFeet = 2500) {
  let score = preferred ? 100 : 0;
  const text = `${crop.name} ${crop.cropCategory} ${crop.lightRequirement} ${crop.howToGrow} ${crop.tips}`.toLowerCase();
  const weeklyMinutes = cropWeeklyMinutes(crop);
  score += noteCropScore(crop, preferences);
  score += popularCropScore(crop);
  score += categoryBaselineScore(crop);
  score += cropSiteFitScore(crop, preferences, siteContext);
  score += cropLaborFitScore(crop, preferences, weeklyMinutes);
  if (isNicheCrop(crop)) score -= 36;
  if (isTreeOrOrchardCrop(crop) && areaSquareFeet < 7000) score -= 42;
  if (isTreeOrOrchardCrop(crop) && preferences.budgetCents < 150_000) score -= 20;
  if (isLongTermPerennial(crop) && preferences.goal !== "low-maintenance" && areaSquareFeet < 4500) score -= 18;
  if (isStapleKitchenCrop(crop)) score += 12;
  if (preferences.waterPriority === "low-water" && (crop.waterConsumptionMl || 0) > 900) score -= 20;
  if (preferences.waterPriority === "low-water" && (crop.waterConsumptionMl || 0) <= 600) score += 18;
  if (preferences.irrigation === "none" && (crop.waterConsumptionMl || 0) > 650) score -= 12;
  if (preferences.irrigation === "drip" && /\b(tomato|pepper|berry|vine|trellis)\b/.test(text)) score += 8;
  if (preferences.season === "winter" && /\b(kale|cabbage|spinach|lettuce|greens|chard|root|carrot|radish)\b/.test(text)) score += 14;
  if (preferences.season === "summer" && /\b(tomato|pepper|eggplant|basil|squash|cucumber|melon)\b/.test(text)) score += 14;
  if (preferences.season === "fall" && /\b(kale|cabbage|broccoli|root|carrot|beet|radish|spinach|lettuce)\b/.test(text)) score += 10;
  if (preferences.season === "spring" && /\b(lettuce|spinach|arugula|pea|carrot|radish|kale|beet|potato|cilantro|broccoli|cabbage)\b/.test(text)) score += 14;
  if (preferences.goal === "food-security" && /\b(potato|corn|bean|pea|squash|tomato|carrot|cabbage|kale)\b/.test(text)) score += 24;
  if (preferences.goal === "family-kitchen" && /\b(tomato|lettuce|spinach|carrot|herb|basil|pepper|bean|cucumber)\b/.test(text)) score += 20;
  if (preferences.goal === "market-garden" && /\b(greens|lettuce|spinach|arugula|herb|basil|berry|strawberr|tomato|pepper|radish)\b/.test(text)) score += 22;
  if (preferences.goal === "profit" && /\b(herb|berry|tomato|pepper|greens|micro|sprout)\b/.test(text)) score += 24;
  if (preferences.goal === "low-maintenance" && crop.lifeSpan === "perennial") score += 16;
  if (preferences.weeklyHours <= 4 && /\b(sprout|microgreen|daily|trellis)\b/.test(text)) score -= 12;
  if (preferences.weeklyHours <= 4 && weeklyMinutes > 40) score -= 18;
  if (preferences.weeklyHours <= 8 && weeklyMinutes <= 24) score += 8;
  if (preferences.experience === "beginner" && /\b(trellis|prune|graft|daily|greenhouse)\b/.test(text)) score -= 8;
  if (preferences.householdSize >= 5 && /\b(potato|corn|bean|pea|squash|cabbage|kale|tomato)\b/.test(text)) score += 8;
  if (preferences.budgetCents <= 75_000 && crop.idealSpaceSqft && crop.idealSpaceSqft > 60) score -= 8;
  if (crop.idealSpaceSqft && crop.idealSpaceSqft <= 25) score += 10;
  if (crop.harvestCycles && crop.harvestCycles > 1) score += 8;
  return score;
}

function cropSiteFitScore(crop: AiDraftCrop, preferences: FarmAiDraftPreferences, siteContext: SiteGrowingContext) {
  let score = 0;
  const text = cropText(crop);
  const minTemp = crop.temperatureMinC;
  const maxTemp = crop.temperatureMaxC;
  const seasonLow = siteContext.estimatedSeasonLowC;
  const seasonHigh = siteContext.estimatedSeasonHighC;
  const winterLow = siteContext.estimatedWinterLowC;
  const summerHigh = siteContext.estimatedSummerHighC;
  const warmSeason = /\b(tomato|pepper|eggplant|okra|corn|cucumber|squash|pumpkin|melon|watermelon|basil|bean|beans)\b/.test(text);
  const coolSeason = /\b(lettuce|spinach|arugula|pea|peas|kale|cabbage|broccoli|cauliflower|chard|carrot|radish|beet|cilantro|bok choy)\b/.test(text);
  const tropical = minTemp !== undefined && minTemp >= 12 && /\b(banana|mango|guava|avocado|citrus|lemon|lime|orange|grapefruit|aloe|ginger)\b/.test(text);

  if (minTemp !== undefined) {
    if (preferences.season !== "year-round") {
      if (seasonHigh < minTemp) score -= Math.min(70, (minTemp - seasonHigh) * 7);
      if (seasonLow < minTemp && warmSeason) score -= Math.min(45, (minTemp - seasonLow) * 2.5);
    }
    if ((isTreeOrOrchardCrop(crop) || tropical) && winterLow + 5 < minTemp) {
      score -= Math.min(75, (minTemp - winterLow) * 4);
    }
  }

  if (maxTemp !== undefined) {
    if (preferences.season !== "year-round" && seasonLow > maxTemp) score -= Math.min(70, (seasonLow - maxTemp) * 7);
    if (preferences.season === "summer" && seasonHigh > maxTemp + 3) score -= Math.min(45, (seasonHigh - maxTemp) * 3);
    if (coolSeason && summerHigh > maxTemp + 8 && preferences.season === "summer") score -= 28;
  }

  if (preferences.season === "winter" && warmSeason) score -= 48;
  if (preferences.season === "summer" && coolSeason && siteContext.heatRisk !== "low") score -= 34;
  if (preferences.season === "spring" && warmSeason && minTemp !== undefined && seasonLow + 4 < minTemp) score -= 16;
  if (preferences.season === "fall" && warmSeason && minTemp !== undefined && seasonLow + 2 < minTemp) score -= 18;

  if (preferences.season === "winter" && coolSeason) score += siteContext.frostRisk === "high" ? 6 : 18;
  if ((preferences.season === "spring" || preferences.season === "fall") && coolSeason) score += 14;
  if (preferences.season === "summer" && warmSeason) score += siteContext.heatRisk === "high" && maxTemp !== undefined && summerHigh > maxTemp ? 4 : 18;

  if (siteContext.climate === "mediterranean" && /\b(tomato|pepper|eggplant|basil|squash|cucumber|fig|grape|olive|almond|rosemary|sage|thyme)\b/.test(text)) score += 10;
  if (siteContext.climate === "arid" && (crop.waterConsumptionMl || 0) >= 900) score -= 18;
  if (siteContext.climate === "arid" && (crop.waterConsumptionMl || 0) <= 350) score += 12;
  if (crop.rainfallMaxMl && siteContext.estimatedAnnualRainfallMm > crop.rainfallMaxMl + 250) score -= 10;
  if (preferences.waterPriority === "low-water" && siteContext.climate === "arid" && (crop.waterConsumptionMl || 0) > 650) score -= 18;
  if (tropical && siteContext.frostRisk !== "low") score -= 34;

  return score;
}

function cropLaborFitScore(crop: AiDraftCrop, preferences: FarmAiDraftPreferences, weeklyMinutes: number) {
  let score = 0;
  const weeklyHoursPerBlock = weeklyMinutes / 60;
  const text = cropText(crop);

  if (preferences.weeklyHours <= 3) {
    score += weeklyHoursPerBlock <= 0.35 ? 18 : -Math.min(42, weeklyHoursPerBlock * 24);
  } else if (preferences.weeklyHours <= 6) {
    score += weeklyHoursPerBlock <= 0.5 ? 12 : -Math.min(28, weeklyHoursPerBlock * 14);
  } else if (preferences.weeklyHours >= 12) {
    if (weeklyHoursPerBlock >= 0.65 && preferences.goal !== "low-maintenance") score += 8;
  }

  if (preferences.goal === "low-maintenance" && weeklyHoursPerBlock > 0.45) score -= 14;
  if (/\b(trellis|prune|pinch|daily|successive|succession|blanch|hand pollinat)\b/.test(text)) {
    score -= preferences.weeklyHours <= 5 ? 16 : 4;
  }
  if (/\b(perennial|rosemary|sage|thyme|oregano|mint|chard|kale|potato|garlic|onion)\b/.test(text)) {
    score += preferences.weeklyHours <= 6 ? 10 : 3;
  }

  return score;
}

function noteMatchedCrops(crops: AiDraftCrop[], preferences: FarmAiDraftPreferences, mode: "prefer" | "exclude") {
  return crops
    .filter((crop) => mode === "prefer" ? noteWantsCrop(crop, preferences.notes) : noteRejectsCrop(crop, preferences.notes))
    .sort((first, second) => first.name.localeCompare(second.name));
}

function noteCropScore(crop: AiDraftCrop, preferences: FarmAiDraftPreferences) {
  if (noteRejectsCrop(crop, preferences.notes)) return -500;
  if (noteWantsCrop(crop, preferences.notes)) return 240;
  if (noteMentionsCrop(crop, preferences.notes)) return 120;
  return 0;
}

function noteWantsCrop(crop: AiDraftCrop, notes: string) {
  return noteMentionsCrop(crop, notes) && !noteRejectsCrop(crop, notes);
}

function noteRejectsCrop(crop: AiDraftCrop, notes: string) {
  const normalized = normalizeNoteText(notes);
  if (!normalized) return false;
  return cropAliases(crop).some((alias) => {
    const escaped = escapeRegExp(alias);
    return new RegExp(`\\b(no|avoid|exclude|skip|without|hate|dislike|allergic to|allergy to|do not want|don't want|dont want|not interested in)\\s+(?:\\w+\\s+){0,3}${escaped}\\b`).test(normalized)
      || new RegExp(`\\b${escaped}\\b\\s+(?:\\w+\\s+){0,3}\\b(allergy|allergic|unwanted|excluded)\\b`).test(normalized);
  });
}

function noteMentionsCrop(crop: AiDraftCrop, notes: string) {
  const normalized = normalizeNoteText(notes);
  if (!normalized) return false;
  return cropAliases(crop).some((alias) => new RegExp(`\\b${escapeRegExp(alias)}\\b`).test(normalized));
}

function cropAliases(crop: AiDraftCrop) {
  const candidates = [
    crop.key,
    crop.name,
    crop.key.replace(/-/g, " "),
    crop.name.replace(/-/g, " "),
  ];
  return Array.from(new Set(candidates.flatMap((value) => {
    const normalized = normalizeNoteText(value);
    return normalized ? [normalized, singularizeCropAlias(normalized)] : [];
  }).filter(Boolean))).sort((first, second) => second.length - first.length);
}

function singularizeCropAlias(value: string) {
  return value.split(" ").map((word) => {
    if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
    if (word.endsWith("es") && word.length > 3) return word.slice(0, -2);
    if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
    return word;
  }).join(" ");
}

function normalizeNoteText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cropWeeklyMinutes(crop: AiDraftCrop) {
  const text = cropText(crop);
  let minutes = 28;

  if (/\b(sprout|microgreen|daily|mushroom)\b/.test(text)) minutes += 42;
  if (/\b(tomato|pepper|eggplant|cucumber|bean|pea|trellis|vine)\b/.test(text)) minutes += 28;
  if (/\b(lettuce|spinach|arugula|cilantro|basil|greens|radish)\b/.test(text)) minutes += 18;
  if (/\b(potato|garlic|onion|shallot|carrot|beet|turnip|rutabaga)\b/.test(text)) minutes -= 8;
  if (/\b(rosemary|sage|thyme|oregano|mint|perennial)\b/.test(text)) minutes -= 10;
  if (isTreeOrOrchardCrop(crop)) minutes += 16;
  if (crop.harvestCycles && crop.harvestCycles > 3) minutes += 10;
  if (crop.idealSpaceSqft && crop.idealSpaceSqft <= 1) minutes += 12;
  if (crop.waterConsumptionMl && crop.waterConsumptionMl > 900) minutes += 8;

  return Math.max(12, minutes);
}

function popularCropScore(crop: AiDraftCrop) {
  const text = cropText(crop);
  if (/\b(tomato|tomatoes)\b/.test(text)) return 62;
  if (/\b(lettuce|spinach|carrot|carrots|beans|potato|potatoes)\b/.test(text)) return 52;
  if (/\b(pepper|peppers|basil|cucumber|squash|kale|onion|onions|garlic|strawberr)\b/.test(text)) return 44;
  if (/\b(peas|beets|radish|radishes|corn|broccoli|cabbage|cilantro|parsley|chard)\b/.test(text)) return 34;
  if (/\b(pumpkin|melon|watermelon|blueberr|blackberr|raspberr|eggplant|scallion|shallot|dill)\b/.test(text)) return 24;
  if (/\b(asparagus|artichoke|rhubarb|rosemary|sage|thyme|oregano|mint)\b/.test(text)) return 12;
  return 0;
}

function categoryBaselineScore(crop: AiDraftCrop) {
  switch (cropFamily(crop)) {
    case "fruiting":
      return 18;
    case "leafy":
      return 16;
    case "root":
      return 15;
    case "legume":
      return 14;
    case "herb":
      return 10;
    case "brassica":
      return 9;
    case "berry":
      return 7;
    case "perennial":
      return 2;
    default:
      return 0;
  }
}

function cropFamily(crop: AiDraftCrop) {
  const text = cropText(crop);
  if (/\b(tomato|pepper|eggplant|cucumber|squash|pumpkin|melon|okra)\b/.test(text)) return "fruiting";
  if (/\b(lettuce|spinach|arugula|chard|collard|endive|watercress|greens)\b/.test(text)) return "leafy";
  if (/\b(carrot|beet|radish|potato|turnip|rutabaga|parsnip|onion|garlic|shallot|scallion|leek)\b/.test(text)) return "root";
  if (/\b(bean|beans|pea|peas)\b/.test(text)) return "legume";
  if (/\b(basil|cilantro|parsley|dill|oregano|thyme|sage|rosemary|mint|chive|tarragon|marjoram)\b/.test(text)) return "herb";
  if (/\b(kale|cabbage|broccoli|cauliflower|brussels|bok choy|mustard|radicchio)\b/.test(text)) return "brassica";
  if (/\b(strawberr|blueberr|blackberr|raspberr)\b/.test(text)) return "berry";
  if (isTreeOrOrchardCrop(crop)) return "orchard";
  if (isLongTermPerennial(crop)) return "perennial";
  return "specialty";
}

function isStapleKitchenCrop(crop: AiDraftCrop) {
  return /\b(tomato|lettuce|spinach|carrot|beans|potato|pepper|basil|cucumber|squash|kale|onion|garlic|peas|strawberr)\b/.test(cropText(crop));
}

function isNicheCrop(crop: AiDraftCrop) {
  return /\b(aloe|alfalfa sprouts|wheatgrass|licorice|burdock|dandelion|cacti|prickly pear|chamomile|fennel|horseradish|ginger)\b/.test(cropText(crop));
}

function isLongTermPerennial(crop: AiDraftCrop) {
  return crop.lifeSpan === "perennial" || /\b(asparagus|artichoke|rhubarb|grape|kiwi|berry|berries)\b/.test(cropText(crop));
}

function isTreeOrOrchardCrop(crop: AiDraftCrop) {
  return /\b(almond|apple|apricot|avocado|banana|cherry|fig|grapefruit|guava|lemon|lime|loquat|mango|nectarine|olive|orange|peach|pear|persimmon|pistachio|plum|pomegranate|quince|walnut)\b/.test(cropText(crop));
}

function cropText(crop: AiDraftCrop) {
  return `${crop.key} ${crop.name} ${crop.cropCategory ?? ""} ${crop.lifeSpan ?? ""} ${crop.lightRequirement ?? ""} ${crop.howToGrow ?? ""} ${crop.tips ?? ""}`.toLowerCase();
}

function selectLivestockForSite(
  livestock: AiDraftLivestock[],
  preferences: FarmAiDraftPreferences,
  siteContext: SiteGrowingContext,
  areaSquareFeet: number,
  preferredKey?: string,
) {
  const candidates = livestock
    .map((animal) => ({ animal, score: livestockScore(animal, preferences, siteContext, areaSquareFeet, preferredKey) }))
    .filter(({ score }) => score > -80)
    .sort((first, second) => second.score - first.score);

  return candidates[0]?.animal ?? null;
}

function livestockScore(
  animal: AiDraftLivestock,
  preferences: FarmAiDraftPreferences,
  siteContext: SiteGrowingContext,
  areaSquareFeet: number,
  preferredKey?: string,
) {
  const text = livestockText(animal);
  const idealSpace = livestockIdealSpace(animal);
  const targetSpace = targetLivestockSpace(preferences, areaSquareFeet);
  const availablePaddock = Math.max(90, areaSquareFeet * livestockAreaBudgetRatio(areaSquareFeet));
  const setupCost = livestockSetupCostCents(animal);
  const laborHours = livestockWeeklyHours(animal);
  const waterDemand = livestockWaterDemand(animal);
  const laborShare = laborHours / Math.max(1, preferences.weeklyHours);
  let score = preferredKey === animal.key ? 6 : 0;

  score -= Math.abs(Math.log2(idealSpace / targetSpace)) * 22;
  if (idealSpace <= availablePaddock) score += Math.min(28, Math.log2(availablePaddock / idealSpace + 1) * 8);
  else score -= 90 + Math.min(80, (idealSpace - availablePaddock) / Math.max(1, targetSpace) * 20);

  if (areaSquareFeet < 1500 && idealSpace <= 20) score += 28;
  if (areaSquareFeet < 1500 && idealSpace > 60) score -= 45;
  if (areaSquareFeet < 1500 && /\b(chicken|hen|duck|quail)\b/.test(text)) score += 8;
  if (areaSquareFeet >= 6500 && idealSpace >= 80) score += 14;
  if (areaSquareFeet >= 12000 && idealSpace >= 180) score += 22;
  if (areaSquareFeet >= 35000 && idealSpace >= 1000) score += 28;
  if (areaSquareFeet < 35000 && idealSpace >= 1000) score -= 80;

  if (preferences.budgetCents >= setupCost) score += 16;
  else score -= Math.min(70, (setupCost - preferences.budgetCents) / Math.max(1, setupCost) * 65);
  if (preferences.budgetCents < setupCost * 0.75) score -= 80;
  if (preferences.weeklyHours >= laborHours) score += 12;
  else score -= (laborHours - preferences.weeklyHours) * 10;
  if (laborShare > 0.75) score -= 34;
  if (laborShare <= 0.45) score += 8;
  if (preferences.weeklyHours <= 4 && laborHours > 2.5) score -= 30;

  if (preferences.experience === "beginner" && idealSpace >= 80) score -= 16;
  if (preferences.experience === "beginner" && idealSpace >= 180) score -= 18;
  if (preferences.experience === "advanced" && idealSpace >= 80) score += 10;

  if (preferences.householdSize >= 5 && idealSpace >= 80 && idealSpace < 1000) score += 8;
  if (preferences.householdSize <= 2 && idealSpace > 80) score -= 12;

  if (preferences.goal === "food-security" || preferences.goal === "family-kitchen") {
    if (animal.yieldTypes?.some((type) => type === "eggs" || type === "milk")) score += 12;
    if (/\b(chicken|duck|quail|rabbit)\b/.test(text)) score += 8;
  }
  if (preferences.goal === "balanced" && animal.yieldTypes?.includes("eggs")) score += 6;
  if (preferences.goal === "market-garden" || preferences.goal === "profit") {
    if (/\b(rabbit|quail|pig|goat|sheep)\b/.test(text)) score += 10;
  }
  if (preferences.goal === "low-maintenance") {
    if (idealSpace <= 20) score += 10;
    if (idealSpace >= 80) score -= 18;
  }

  if (preferences.waterPriority === "low-water") score -= waterDemand * 8;
  if (preferences.waterPriority === "high-production" && animal.yieldTypes?.includes("milk")) score += 8;
  if (preferences.irrigation === "none" && waterDemand >= 2) score -= 8;
  if (preferences.season === "summer" && /\b(pig|cow|duck)\b/.test(text)) score -= 6;
  if (preferences.season === "winter" && /\b(duck|quail|rabbit|chicken)\b/.test(text)) score += 5;
  score += livestockSiteFitScore(animal, preferences, siteContext);

  return score;
}

function livestockSiteFitScore(
  animal: AiDraftLivestock,
  preferences: FarmAiDraftPreferences,
  siteContext: SiteGrowingContext,
) {
  let score = 0;
  const text = livestockText(animal);
  const hotSeason = preferences.season === "summer" || preferences.season === "year-round";
  const drySite = siteContext.climate === "arid" || siteContext.climate === "mediterranean";

  if (siteContext.livestockHeatStress === "high") {
    if (/\b(rabbit|rabbits)\b/.test(text)) score -= hotSeason ? 46 : 28;
    if (/\b(pig|hog|cow|cattle|duck)\b/.test(text)) score -= hotSeason ? 24 : 12;
    if (/\b(quail|chicken|hen)\b/.test(text)) score += 8;
    if (/\b(goat|sheep)\b/.test(text)) score += drySite ? 10 : 4;
  }

  if (drySite) {
    if (/\b(duck|pig|hog|cow|cattle)\b/.test(text)) score -= preferences.waterPriority === "low-water" ? 28 : 14;
    if (/\b(goat|sheep|quail|chicken|hen)\b/.test(text)) score += 8;
  }

  if (siteContext.frostRisk === "high" && preferences.season === "winter") {
    if (/\b(duck|sheep|goat)\b/.test(text)) score += 8;
    if (/\b(quail|rabbit)\b/.test(text)) score -= 10;
  }

  if (siteContext.climate === "humid") {
    if (/\b(duck)\b/.test(text)) score += 8;
    if (/\b(sheep|goat)\b/.test(text)) score -= 4;
  }

  return score;
}

function targetLivestockSpace(preferences: FarmAiDraftPreferences, areaSquareFeet: number) {
  let target = 12;
  if (areaSquareFeet >= 1500) target = 18;
  if (areaSquareFeet >= 4500) target = 80;
  if (areaSquareFeet >= 9000) target = 200;
  if (areaSquareFeet >= 18000) target = 250;
  if (areaSquareFeet >= 35000) target = 4000;
  if (preferences.budgetCents < 400_000) target = Math.min(target, 250);
  if (preferences.budgetCents < 100_000) target = Math.min(target, 18);
  if (preferences.weeklyHours <= 5) target = Math.min(target, 20);
  if (preferences.experience === "beginner") target = Math.min(target, areaSquareFeet >= 12000 ? 250 : 80);
  if (preferences.householdSize >= 5 && preferences.weeklyHours >= 8 && preferences.budgetCents >= 150_000) target *= 1.2;
  if (preferences.goal === "low-maintenance") target = Math.min(target, 20);
  return target;
}

function livestockIdealSpace(animal: AiDraftLivestock) {
  if (animal.idealSpaceSqft && animal.idealSpaceSqft > 0) return animal.idealSpaceSqft;
  const text = livestockText(animal);
  if (/\b(cow|cattle)\b/.test(text)) return 4000;
  if (/\b(goat|sheep)\b/.test(text)) return 225;
  if (/\b(pig|hog)\b/.test(text)) return 80;
  if (/\b(duck)\b/.test(text)) return 15;
  if (/\b(chicken|hen|rabbit)\b/.test(text)) return 12;
  if (/\b(quail)\b/.test(text)) return 1;
  return 30;
}

function livestockAreaBudgetRatio(areaSquareFeet: number) {
  if (areaSquareFeet < 1500) return 0.11;
  if (areaSquareFeet < 4500) return 0.13;
  if (areaSquareFeet < 12000) return 0.16;
  return 0.2;
}

function livestockAreaRatioForSite(animal: AiDraftLivestock, areaSquareFeet: number) {
  const targetArea = Math.max(80, livestockIdealSpace(animal) * Math.max(2, Math.min(6, animal.defaultCount || 2)));
  return Math.max(0.08, Math.min(0.2, targetArea / Math.max(1, areaSquareFeet)));
}

function livestockCountForSite(animal: AiDraftLivestock, preferences: FarmAiDraftPreferences, areaSquareFeet: number) {
  const idealSpace = livestockIdealSpace(animal);
  const paddockArea = areaSquareFeet * livestockAreaRatioForSite(animal, areaSquareFeet);
  const capacity = Math.max(1, Math.floor(paddockArea / Math.max(1, idealSpace)));
  const laborCap = Math.max(1, Math.floor(preferences.weeklyHours / Math.max(1, livestockWeeklyHours(animal) / 2)));
  return Math.max(1, Math.min(animal.defaultCount || 2, capacity, laborCap, idealSpace >= 80 ? 3 : 12));
}

function livestockSetupCostCents(animal: AiDraftLivestock) {
  const text = livestockText(animal);
  if (/\b(cow|cattle)\b/.test(text)) return 500_000;
  if (/\b(goat|sheep)\b/.test(text)) return 150_000;
  if (/\b(pig|hog)\b/.test(text)) return 110_000;
  if (/\b(duck)\b/.test(text)) return 45_000;
  if (/\b(chicken|hen)\b/.test(text)) return 35_000;
  if (/\b(rabbit)\b/.test(text)) return 30_000;
  if (/\b(quail)\b/.test(text)) return 18_000;
  return 50_000;
}

function livestockWeeklyHours(animal: AiDraftLivestock) {
  const text = livestockText(animal);
  if (/\b(cow|cattle)\b/.test(text)) return 12;
  if (/\b(goat|sheep)\b/.test(text)) return 8;
  if (/\b(pig|hog)\b/.test(text)) return 7;
  if (/\b(duck)\b/.test(text)) return 5;
  if (/\b(chicken|hen|rabbit)\b/.test(text)) return 4;
  if (/\b(quail)\b/.test(text)) return 2;
  return 5;
}

function livestockWaterDemand(animal: AiDraftLivestock) {
  const text = livestockText(animal);
  if (/\b(cow|cattle)\b/.test(text)) return 3;
  if (/\b(pig|hog|duck)\b/.test(text)) return 2;
  if (/\b(goat|sheep)\b/.test(text)) return 1.4;
  return 0.7;
}

function livestockText(animal: AiDraftLivestock) {
  return `${animal.key} ${animal.name} ${animal.feed ?? ""} ${animal.yieldTypes?.join(" ") ?? ""}`.toLowerCase();
}

function scorePlan(
  intent: GeminiFarmIntent,
  objects: FarmV2Object[],
  preferences: FarmAiDraftPreferences,
  area: number,
  assessment?: LayoutAssessment,
  estimatedWeeklyHours = intent.optimization.expectedWeeklyHours,
) {
  let score = 0.55;
  const uniqueCrops = new Set(intent.cropAssignments.map((item) => item.cropKey)).size;
  score += Math.min(0.18, uniqueCrops * 0.018);
  if (intent.budget.estimatedSetupCostCents <= preferences.budgetCents) score += 0.12;
  else score -= Math.min(0.2, (intent.budget.estimatedSetupCostCents - preferences.budgetCents) / Math.max(1, preferences.budgetCents));
  if (estimatedWeeklyHours <= preferences.weeklyHours) score += 0.08;
  else score -= Math.min(0.2, (estimatedWeeklyHours - preferences.weeklyHours) / Math.max(1, preferences.weeklyHours) * 0.12);
  if (objects.length >= 8) score += 0.04;
  if (area >= 500 && intent.structures.length > 0) score += 0.03;
  if (assessment) score = score * 0.72 + assessment.score * 0.28;
  return clampScore(score);
}

function estimatePlanWeeklyHours(objects: FarmV2Object[], crops: AiDraftCrop[], livestock: AiDraftLivestock[]) {
  const cropHours = objects.reduce((sum, object) => {
    if (object.type !== "cropField") return sum;
    const cropKey = typeof object.attrs.cropKey === "string" ? object.attrs.cropKey : "";
    const cropName = typeof object.attrs.cropName === "string" ? object.attrs.cropName : "";
    const crop = crops.find((item) => item.key === cropKey) ?? {
      key: cropKey || cropName,
      name: cropName || cropKey || "Crop",
      visual: "generic",
      defaultCount: 12,
    };
    const countScale = Math.min(1.7, Math.max(0.65, Number(object.attrs.count || 12) / Math.max(1, crop.defaultCount || 12)));
    return sum + cropWeeklyMinutes(crop) * countScale / 60;
  }, 0);

  const livestockHours = objects.reduce((sum, object) => {
    if (object.type !== "livestock") return sum;
    const species = typeof object.attrs.species === "string" ? object.attrs.species : "";
    const animal = livestock.find((item) => item.name === species || item.key === species.toLowerCase());
    const count = Math.max(1, Number(object.attrs.count) || 1);
    const baseHours = animal ? livestockWeeklyHours(animal) : 4;
    return sum + baseHours * Math.min(1.8, Math.max(0.65, count / Math.max(1, animal?.defaultCount || 2)));
  }, 0);

  const structureHours = objects.filter((object) => object.type === "structure").length * 0.15;
  return Math.round((cropHours + livestockHours + structureHours) * 10) / 10;
}

function maintenanceLevelForHours(weeklyHours: number): GeminiFarmIntent["summary"]["maintenanceLevel"] {
  if (weeklyHours <= 5) return "low";
  if (weeklyHours <= 12) return "medium";
  return "high";
}

function createCatalogFallbackIntent(input: {
  areaSquareFeet: number;
  preferences: FarmAiDraftPreferences;
  siteContext: SiteGrowingContext;
  candidateCrops: AiDraftCrop[];
  livestock: AiDraftLivestock[];
  structures: AiDraftStructure[];
}): GeminiFarmIntent {
  const cropCount = Math.min(targetCropCountForLabor(input.areaSquareFeet, input.preferences), input.areaSquareFeet < 2500 ? 5 : input.areaSquareFeet < 7000 ? 7 : 9);
  const selectedCrops = input.candidateCrops.slice(0, Math.max(3, cropCount));
  const selectedLivestockAnimal = input.preferences.includeLivestock && input.areaSquareFeet >= 650
    ? selectLivestockForSite(input.livestock, input.preferences, input.siteContext, input.areaSquareFeet)
    : null;
  const selectedLivestock = selectedLivestockAnimal ? [selectedLivestockAnimal] : [];
  const structureKeys = new Set(input.structures.map((structure) => structure.key));
  const selectedStructures = input.preferences.includeStructures && input.areaSquareFeet >= 450
    ? ["shed", "coop", "storage", "barn"].filter((key) => structureKeys.has(key)).slice(0, selectedLivestock.length ? 2 : 1)
    : [];
  const cropRatio = selectedCrops.length ? 0.72 / selectedCrops.length : 0.12;

  return {
    planName: "Catalog Optimized Homestead Plan",
    summary: {
      description: "A catalog-scored fallback plan generated while the LLM planner is unavailable.",
      highlights: ["Crop choices use local climate and seasonal temperature scoring", "Layout remains deterministic and boundary-aware", "Structures are compact and grid cells follow the boundary"],
      maintenanceLevel: input.preferences.weeklyHours <= 5 ? "low" : "medium",
    },
    cropAssignments: selectedCrops.map((crop) => ({
      cropKey: crop.key,
      areaRatio: cropRatio,
      estimatedPlantCount: crop.defaultCount || 12,
      reason: "Selected from the catalog using local climate, season, goal, water, labor, and space scoring.",
    })),
    livestockAssignments: selectedLivestock.map((animal) => ({
      livestockKey: animal.key,
      count: livestockCountForSite(animal, input.preferences, input.areaSquareFeet),
      areaRatio: livestockAreaRatioForSite(animal, input.areaSquareFeet),
      reason: "Selected by catalog size-fit and climate scoring for land area, budget, labor, experience, water, season, and household constraints.",
    })),
    structures: selectedStructures.map((structureKey) => ({
      structureKey,
      areaRatio: structureAreaRatio(structureKey),
      reason: "Included as compact support infrastructure for the homestead.",
    })),
    budget: {
      estimatedSetupCostCents: Math.min(input.preferences.budgetCents, Math.max(50_000, Math.round(input.preferences.budgetCents * 0.82))),
      seedCostCents: Math.min(30_000, Math.round(input.preferences.budgetCents * 0.12)),
      infrastructureCostCents: Math.min(120_000, Math.round(input.preferences.budgetCents * 0.45)),
      livestockCostCents: selectedLivestock.length ? Math.min(45_000, Math.round(input.preferences.budgetCents * 0.18)) : 0,
      contingencyCents: Math.min(35_000, Math.round(input.preferences.budgetCents * 0.12)),
    },
    optimization: {
      objective: input.preferences.goal,
      tradeoffs: ["Used catalog scoring because LLM planning was unavailable", "Maintains deterministic geometry and compact structures"],
      expectedWeeklyHours: input.preferences.weeklyHours,
      confidence: 0.72,
    },
  };
}

function normalizeRatios<T extends { areaRatio: number }>(items: T[], maxTotal: number): T[] {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.areaRatio), 0);
  if (total <= maxTotal || total === 0) return items;
  return items.map((item) => ({ ...item, areaRatio: (item.areaRatio / total) * maxTotal }));
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function stringArray(value: unknown, maxItems: number, maxLength: number) {
  return Array.isArray(value)
    ? value.map((item) => typeof item === "string" ? item.trim().slice(0, maxLength) : "").filter(Boolean).slice(0, maxItems)
    : [];
}

function numberOr(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampInt(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function roundPoint(value: number) {
  return Math.round(value * 100) / 100;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100));
}

function isRecoverableGeminiError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("quota")
    || message.includes("rate limit")
    || message.includes("429")
    || message.includes("missing openai_api_key")
    || message.includes("missing gemini_api_key")
    || message.includes("temporarily")
    || message.includes("unavailable")
    || message.includes("timeout");
}

function readOpenAiResponseText(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const response = data as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ text?: unknown; type?: unknown }> }>;
  };
  if (typeof response.output_text === "string") return response.output_text;
  return response.output
    ?.flatMap((item) => item.content || [])
    .map((content) => typeof content.text === "string" ? content.text : "")
    .join("")
    .trim() || "";
}

function readOpenAiError(data: unknown) {
  if (data && typeof data === "object") {
    const error = (data as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return "OpenAI farm planning failed";
}

function readGeminiError(data: unknown) {
  if (data && typeof data === "object") {
    const error = (data as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string") return error.message;
  }
  return "Gemini farm generation failed";
}
