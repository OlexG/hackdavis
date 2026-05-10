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
    season: enumValue(body.season, ["spring", "summer", "fall", "winter", "year-round"], "spring"),
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
  const candidateCrops = selectCandidateCrops(crops, preferences);
  const planner = await createPlannerIntent({ boundaryLocal: local, areaSquareFeet, preferences, crops, candidateCrops, livestock, structures });
  const intent = planner.intent;
  const generated = createObjectsFromIntent(local, intent, crops, livestock, structures);
  const objects = generated.objects;
  const score = scorePlan(intent, objects, preferences, areaSquareFeet, generated.assessment);
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
        generatedObjectCount: objects.length,
        plannerSource: planner.source,
        plannerError: planner.error,
        estimatedSetupCostCents: intent.budget.estimatedSetupCostCents,
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
  crops: AiDraftCrop[];
  candidateCrops: AiDraftCrop[];
  livestock: AiDraftLivestock[];
  structures: AiDraftStructure[];
}) {
  return [
    "You are designing an optimized editable homestead farm plan.",
    "Return only data that matches the schema. Use only cropKey, livestockKey, and structureKey values from the allowed lists.",
    "Optimize for real farm usefulness: budget, weekly labor, crop diversity, water fit, household food value, maintenance level, and usable access.",
    "Do not invent crop names. Prefer compact annual vegetables for small sites, add perennials only when space and goal allow, and avoid livestock when labor or budget is too low.",
    "Use layoutGeometry to choose crop priorities for the available land shape.",
    "When includeStructures is true, include at least one compact support structure. When includeLivestock is true and the site has enough area, include a small livestock paddock.",
    "Do not choose shapes and do not place coordinates. The deterministic layout engine will partition the land outline, clip plots to the site geometry, and preserve walking gaps.",
    JSON.stringify({
      boundaryLocal: input.boundaryLocal,
      areaSquareFeet: input.areaSquareFeet,
      preferences: input.preferences,
      layoutGeometry: summarizeLayoutGeometry(input.boundaryLocal),
      allowedCropKeys: input.crops.map((crop) => crop.key),
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
  const livestockKeys = new Set(livestock.map((animal) => animal.key));
  const structureKeys = new Set([...structures.map((structure) => structure.key), "compost"]);
  const cropAssignments = Array.isArray(value.cropAssignments)
    ? value.cropAssignments.filter((item) => item && cropKeys.has(item.cropKey) && !preferences.excludedCropKeys.includes(item.cropKey)).slice(0, 12)
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
    livestock: AiDraftLivestock[];
    structures: AiDraftStructure[];
  },
): GeminiFarmIntent {
  const canPlaceLivestock = input.areaSquareFeet >= 650;
  const canPlaceStructures = input.areaSquareFeet >= 450;
  const livestockAssignments = canPlaceLivestock ? [...intent.livestockAssignments] : [];
  const structureAssignments = canPlaceStructures ? [...intent.structures] : [];
  const structureKeys = new Set(input.structures.map((structure) => structure.key));

  if (input.preferences.includeLivestock && input.livestock.length && canPlaceLivestock && !livestockAssignments.length) {
    const animal = pickLivestock(input.livestock);
    livestockAssignments.push({
      livestockKey: animal.key,
      count: Math.max(1, Math.min(6, animal.defaultCount || 2)),
      areaRatio: input.areaSquareFeet < 1500 ? 0.11 : 0.14,
      reason: "Reserved as a compact livestock paddock because livestock was enabled for a site with enough room.",
    });
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
    livestockAssignments: normalizeRatios(livestockAssignments, 0.2),
    structures: normalizeRatios(structureAssignments, 0.14),
  };
}

function pickLivestock(livestock: AiDraftLivestock[]) {
  return livestock.find((animal) => /\b(chicken|hen|duck|rabbit)\b/i.test(animal.name)) || livestock[0];
}

function preferredStructureKeys(hasLivestock: boolean) {
  return hasLivestock
    ? ["coop", "greenhouse", "shed", "storage", "barn", "compost"]
    : ["greenhouse", "shed", "storage", "compost", "barn", "coop"];
}

function structureAreaRatio(structureKey: string) {
  switch (structureKey) {
    case "barn":
      return 0.055;
    case "greenhouse":
      return 0.045;
    case "coop":
    case "shed":
    case "storage":
      return 0.032;
    default:
      return 0.025;
  }
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
        growth: 0.35,
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
    case "greenhouse":
      return 1.05;
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
    case "greenhouse":
      return { width: 22, depth: 16 };
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

function selectCandidateCrops(crops: AiDraftCrop[], preferences: FarmAiDraftPreferences) {
  const excluded = new Set(preferences.excludedCropKeys);
  const preferred = new Set(preferences.preferredCropKeys);
  return crops
    .filter((crop) => !excluded.has(crop.key))
    .map((crop) => ({ crop, score: cropScore(crop, preferences, preferred.has(crop.key)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 42)
    .map((item) => item.crop);
}

function cropScore(crop: AiDraftCrop, preferences: FarmAiDraftPreferences, preferred: boolean) {
  let score = preferred ? 100 : 0;
  const text = `${crop.name} ${crop.cropCategory} ${crop.lightRequirement} ${crop.howToGrow} ${crop.tips}`.toLowerCase();
  if (preferences.waterPriority === "low-water" && (crop.waterConsumptionMl || 0) > 900) score -= 20;
  if (preferences.waterPriority === "low-water" && (crop.waterConsumptionMl || 0) <= 600) score += 18;
  if (preferences.goal === "food-security" && /\b(potato|corn|bean|pea|squash|tomato|carrot|cabbage|kale)\b/.test(text)) score += 24;
  if (preferences.goal === "profit" && /\b(herb|berry|tomato|pepper|greens|micro|sprout)\b/.test(text)) score += 24;
  if (preferences.goal === "low-maintenance" && crop.lifeSpan === "perennial") score += 16;
  if (preferences.weeklyHours <= 4 && /\b(sprout|microgreen|daily|trellis)\b/.test(text)) score -= 12;
  if (crop.idealSpaceSqft && crop.idealSpaceSqft <= 25) score += 10;
  if (crop.harvestCycles && crop.harvestCycles > 1) score += 8;
  return score;
}

function scorePlan(
  intent: GeminiFarmIntent,
  objects: FarmV2Object[],
  preferences: FarmAiDraftPreferences,
  area: number,
  assessment?: LayoutAssessment,
) {
  let score = 0.55;
  const uniqueCrops = new Set(intent.cropAssignments.map((item) => item.cropKey)).size;
  score += Math.min(0.18, uniqueCrops * 0.018);
  if (intent.budget.estimatedSetupCostCents <= preferences.budgetCents) score += 0.12;
  else score -= Math.min(0.2, (intent.budget.estimatedSetupCostCents - preferences.budgetCents) / Math.max(1, preferences.budgetCents));
  if (intent.optimization.expectedWeeklyHours <= preferences.weeklyHours) score += 0.08;
  if (objects.length >= 8) score += 0.04;
  if (area >= 500 && intent.structures.length > 0) score += 0.03;
  if (assessment) score = score * 0.72 + assessment.score * 0.28;
  return clampScore(score);
}

function createCatalogFallbackIntent(input: {
  areaSquareFeet: number;
  preferences: FarmAiDraftPreferences;
  candidateCrops: AiDraftCrop[];
  livestock: AiDraftLivestock[];
  structures: AiDraftStructure[];
}): GeminiFarmIntent {
  const cropCount = input.areaSquareFeet < 2500 ? 5 : input.areaSquareFeet < 7000 ? 7 : 9;
  const selectedCrops = input.candidateCrops.slice(0, Math.max(3, cropCount));
  const includeLivestock = input.preferences.includeLivestock
    && input.areaSquareFeet >= 650
    && input.preferences.weeklyHours >= 5
    && input.preferences.budgetCents >= 120_000;
  const selectedLivestock = includeLivestock ? input.livestock.slice(0, 1) : [];
  const structureKeys = new Set(input.structures.map((structure) => structure.key));
  const selectedStructures = input.preferences.includeStructures && input.areaSquareFeet >= 450
    ? ["greenhouse", "shed", "coop"].filter((key) => structureKeys.has(key)).slice(0, selectedLivestock.length ? 2 : 1)
    : [];
  const cropRatio = selectedCrops.length ? 0.72 / selectedCrops.length : 0.12;

  return {
    planName: "Catalog Optimized Homestead Plan",
    summary: {
      description: "A catalog-scored fallback plan generated while the LLM planner is unavailable.",
      highlights: ["Crop choices use the local plant catalog", "Layout remains deterministic and boundary-aware", "Structures are compact and grid cells follow the boundary"],
      maintenanceLevel: input.preferences.weeklyHours <= 5 ? "low" : "medium",
    },
    cropAssignments: selectedCrops.map((crop) => ({
      cropKey: crop.key,
      areaRatio: cropRatio,
      estimatedPlantCount: crop.defaultCount || 12,
      reason: "Selected from the catalog using goal, water, labor, and space scoring.",
    })),
    livestockAssignments: selectedLivestock.map((animal) => ({
      livestockKey: animal.key,
      count: Math.max(1, Math.min(6, animal.defaultCount || 2)),
      areaRatio: 0.12,
      reason: "Included because budget and weekly labor can support a small paddock.",
    })),
    structures: selectedStructures.map((structureKey) => ({
      structureKey,
      areaRatio: structureKey === "greenhouse" ? 0.06 : 0.035,
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
