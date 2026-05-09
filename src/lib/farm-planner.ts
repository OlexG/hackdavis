import type {
  FarmObjectType,
  GeometryPoint,
  ObjectSize,
  PlanObject,
  PlanPartition,
  RenderConfig,
} from "./models";

export type FarmPlannerCatalogItem = {
  sourceId?: unknown;
  slug: string;
  type: FarmObjectType;
  name: string;
  defaultSize: ObjectSize;
  render: RenderConfig;
};

export type FarmPlannerInput = {
  points: GeometryPoint[];
  locationLabel: string;
  weatherProfile: "temperate" | "dry" | "wet" | "cold";
  strategy: "balanced" | "food" | "livestock" | "low-maintenance";
};

export type GeneratedFarmPlan = {
  name: string;
  bounds: ObjectSize;
  baseGeometry: {
    source: "satellite-drawn";
    locationLabel: string;
    points: GeometryPoint[];
    centroid: GeometryPoint;
    areaSquareMeters: number;
  };
  partitions: PlanPartition[];
  objects: Omit<PlanObject, "sourceId">[];
  summary: {
    description: string;
    highlights: string[];
    maintenanceLevel: "low" | "medium" | "high";
  };
  generation: {
    strategy: string;
    prompt: string;
    constraints: Record<string, unknown>;
    score: number;
  };
};

type PartitionTemplate = {
  id: string;
  label: string;
  type: PlanPartition["type"];
  slug: string;
  assignmentName: string;
  ratio: number;
  sunExposure: PlanPartition["sunExposure"];
  waterNeed: PlanPartition["waterNeed"];
  soilStrategy: string;
  render: RenderConfig;
  notes: string;
};

type PartitionRegion = {
  template: PartitionTemplate;
  corners: GeometryPoint[];
};

const fallbackQuad: GeometryPoint[] = [
  { x: 16, y: 18 },
  { x: 84, y: 16 },
  { x: 88, y: 78 },
  { x: 12, y: 82 },
];

const palette = {
  annual: "#66a95a",
  perennial: "#3f8a57",
  livestock: "#d6b36b",
  greenhouse: "#8fd3df",
  water: "#4aa8c7",
  habitat: "#9bb75d",
};

export function generateHomesteadPlan(
  input: FarmPlannerInput,
  catalog: FarmPlannerCatalogItem[],
): GeneratedFarmPlan {
  const points = normalizePoints(input.points);
  const centroid = getCentroid(points);
  const areaSquareMeters = Math.max(80, Math.round(shoelaceArea(points) * 0.24));
  const siteBounds = boundsFor(points);
  const siteArea = Math.max(1, shoelaceArea(points));
  const templates = getTemplates(input);
  const random = createSeededRandom(`${input.locationLabel}:${input.weatherProfile}:${input.strategy}:${Date.now()}`);
  const regions = createPartitionRegions(points, arrangeTemplates(templates, input, random), random);
  const widthMeters = Math.max(12, Math.round((siteBounds.maxX - siteBounds.minX) * 0.38));
  const depthMeters = Math.max(12, Math.round((siteBounds.maxY - siteBounds.minY) * 0.34));

  const partitions = regions.map(({ template, corners }, index) => {
    const center = getCentroid(corners);
    const catalogItem = catalog.find((item) => item.slug === template.slug);
    const render = catalogItem?.render ?? template.render;
    const partitionArea = Math.max(1, shoelaceArea(corners));

    return {
      partitionId: `${template.id}_${index + 1}`,
      label: template.label,
      type: template.type,
      assignmentSlug: catalogItem?.slug ?? template.slug,
      assignmentName: catalogItem?.name ?? template.assignmentName,
      geometry: { corners, center },
      areaSquareMeters: Math.max(8, Math.round(areaSquareMeters * (partitionArea / siteArea))),
      sunExposure: template.sunExposure,
      waterNeed: adjustWaterNeed(template.waterNeed, input.weatherProfile),
      soilStrategy: template.soilStrategy,
      render: {
        ...render,
        color: template.render.color,
        label: template.assignmentName,
      },
      notes: template.notes,
    } satisfies PlanPartition;
  });

  const objects = partitions.map((partition) => {
    const item = catalog.find((candidate) => candidate.slug === partition.assignmentSlug);
    const type = item?.type ?? (partition.type === "livestock" ? "livestock" : "crop");
    const size = sizeForPartition(partition, item?.defaultSize);

    return {
      instanceId: partition.partitionId,
      type,
      slug: partition.assignmentSlug,
      displayName: partition.assignmentName,
      status: "planned" as const,
      plantedAtDay: type === "crop" ? 0 : undefined,
      addedAtDay: type === "livestock" ? 0 : undefined,
      ageDaysAtStart: type === "livestock" ? 90 : undefined,
      position: {
        x: Number(((partition.geometry.center.x - 50) * 0.32).toFixed(2)),
        y: 0,
        z: Number(((partition.geometry.center.y - 50) * 0.26).toFixed(2)),
      },
      rotation: { x: 0, y: 0, z: 0 },
      size,
      renderOverrides: partition.render,
      notes: partition.notes,
    };
  });

  return {
    name: `Homestead Plan - ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`,
    bounds: { width: widthMeters, depth: depthMeters, height: 8 },
    baseGeometry: {
      source: "satellite-drawn",
      locationLabel: input.locationLabel.trim() || "Drawn homestead site",
      points,
      centroid,
      areaSquareMeters,
    },
    partitions,
    objects,
    summary: {
      description: `A ${input.strategy.replace("-", " ")} solar-punk homestead plan for ${input.locationLabel.trim() || "the selected site"}.`,
      highlights: [
        "Drawn satellite geometry is saved as the plan base.",
        "Each generated partition stores four-corner geometry and a crop, livestock, or infrastructure assignment.",
        weatherHighlight(input.weatherProfile),
      ],
      maintenanceLevel:
        input.strategy === "low-maintenance"
          ? "low"
          : input.strategy === "livestock"
            ? "high"
            : "medium",
    },
    generation: {
      strategy: input.strategy,
      prompt: `Partition drawn homestead geometry for ${input.locationLabel} with ${input.weatherProfile} weather and ${input.strategy} goals.`,
      constraints: {
        weatherProfile: input.weatherProfile,
        locationLabel: input.locationLabel,
        basePointCount: points.length,
        partitionGeometry: "four-corner-polygons",
      },
      score: scorePlan(input, partitions),
    },
  };
}

function normalizePoints(points: GeometryPoint[]) {
  const clean = points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({
      ...point,
      x: clamp(point.x, 0, 100),
      y: clamp(point.y, 0, 100),
    }));

  return clean.length >= 4 ? clean : fallbackQuad;
}

function getTemplates(input: FarmPlannerInput): PartitionTemplate[] {
  const foodBias = input.strategy === "food" ? 0.08 : 0;
  const livestockBias = input.strategy === "livestock" ? 0.1 : 0;
  const lowCareBias = input.strategy === "low-maintenance" ? 0.08 : 0;
  const dryWaterBias = input.weatherProfile === "dry" ? 0.06 : 0;

  return normalizeRatios([
    {
      id: "annual_beds",
      label: "Kitchen Beds",
      type: "annual_beds",
      slug: "tomatoes",
      assignmentName: "Tomatoes and companion herbs",
      ratio: 0.27 + foodBias,
      sunExposure: "full",
      waterNeed: "high",
      soilStrategy: input.weatherProfile === "wet" ? "Raised beds with wood-chip paths" : "Deep compost mulch over broadforked soil",
      render: { model: "plant", color: palette.annual, label: "Kitchen Beds" },
      notes: "High-yield annual beds near the access edge for frequent harvests.",
    },
    {
      id: "perennial_guild",
      label: "Perennial Guild",
      type: "perennial_guild",
      slug: "lettuce",
      assignmentName: "Fruit guild understory",
      ratio: 0.17 + lowCareBias,
      sunExposure: "partial",
      waterNeed: "medium",
      soilStrategy: "Fungal compost, leaf mulch, and perennial nitrogen fixers",
      render: { model: "tree_guild", color: palette.perennial, label: "Perennial Guild" },
      notes: "Long-lived fruit and herb layer to reduce annual replanting.",
    },
    {
      id: "greenhouse",
      label: "Greenhouse + Solar Shed",
      type: "greenhouse",
      slug: "tomatoes",
      assignmentName: "Greenhouse starts",
      ratio: 0.14,
      sunExposure: "full",
      waterNeed: "medium",
      soilStrategy: "Thermal mass, seed-start benching, and rain barrel feed",
      render: { model: "greenhouse", color: palette.greenhouse, label: "Greenhouse" },
      notes: "Protected starts, tool storage, and small solar charging zone.",
    },
    {
      id: "livestock",
      label: "Livestock Loop",
      type: "livestock",
      slug: input.strategy === "livestock" ? "goats" : "chickens",
      assignmentName: input.strategy === "livestock" ? "Goat paddock" : "Chicken compost run",
      ratio: 0.2 + livestockBias,
      sunExposure: "partial",
      waterNeed: "medium",
      soilStrategy: "Deep litter carbon bedding with rotational rest",
      render: { model: "coop", color: palette.livestock, label: "Livestock" },
      notes: "Animal zone is separated from tender crops and tied to compost cycling.",
    },
    {
      id: "water_habitat",
      label: "Water + Habitat",
      type: input.weatherProfile === "dry" ? "water" : "habitat",
      slug: "lettuce",
      assignmentName: input.weatherProfile === "dry" ? "Swale and cistern edge" : "Pollinator habitat",
      ratio: 0.22 + dryWaterBias,
      sunExposure: "partial",
      waterNeed: "low",
      soilStrategy: "Contour swale, native plants, and overflow-safe infiltration",
      render: {
        model: input.weatherProfile === "dry" ? "water" : "habitat",
        color: input.weatherProfile === "dry" ? palette.water : palette.habitat,
        label: "Habitat",
      },
      notes: "Ecological buffer for water capture, pollinators, and microclimate stability.",
    },
  ]);
}

function normalizeRatios(templates: PartitionTemplate[]) {
  const total = templates.reduce((sum, template) => sum + template.ratio, 0);
  return templates.map((template) => ({ ...template, ratio: template.ratio / total }));
}

function arrangeTemplates(
  templates: PartitionTemplate[],
  input: FarmPlannerInput,
  random: () => number,
) {
  const byId = new Map(templates.map((template) => [template.id, template]));
  const preferred =
    input.strategy === "livestock"
      ? ["livestock", "water_habitat", "perennial_guild", "greenhouse", "annual_beds"]
      : input.weatherProfile === "dry"
        ? ["water_habitat", "greenhouse", "annual_beds", "perennial_guild", "livestock"]
        : input.strategy === "low-maintenance"
          ? ["perennial_guild", "water_habitat", "greenhouse", "livestock", "annual_beds"]
          : random() > 0.5
            ? ["greenhouse", "annual_beds", "water_habitat", "perennial_guild", "livestock"]
            : ["annual_beds", "greenhouse", "perennial_guild", "water_habitat", "livestock"];
  const arranged = preferred.flatMap((id) => {
    const template = byId.get(id);
    return template ? [template] : [];
  });

  return arranged.length === templates.length ? arranged : templates;
}

function createPartitionRegions(
  sitePolygon: GeometryPoint[],
  templates: PartitionTemplate[],
  random: () => number,
) {
  const regions = splitRegions(sitePolygon, templates, random, 0);

  return regions.length === templates.length ? regions : createStripFallback(sitePolygon, templates);
}

function splitRegions(
  polygon: GeometryPoint[],
  templates: PartitionTemplate[],
  random: () => number,
  depth: number,
): PartitionRegion[] {
  if (templates.length === 1) {
    return [{ template: templates[0], corners: polygon }];
  }

  const bounds = boundsFor(polygon);
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const primaryAxis: "x" | "y" = width >= height ? "x" : "y";
  const axis: "x" | "y" = depth % 2 === 0 ? primaryAxis : primaryAxis === "x" ? "y" : "x";
  const totalRatio = templates.reduce((sum, template) => sum + template.ratio, 0);
  const splitIndex = chooseSplitIndex(templates, totalRatio, random);
  const firstTemplates = templates.slice(0, splitIndex);
  const secondTemplates = templates.slice(splitIndex);
  const firstRatio = firstTemplates.reduce((sum, template) => sum + template.ratio, 0) / totalRatio;
  const axisMin = axis === "x" ? bounds.minX : bounds.minY;
  const axisMax = axis === "x" ? bounds.maxX : bounds.maxY;
  const splitAt = axisMin + (axisMax - axisMin) * clamp(firstRatio + (random() - 0.5) * 0.14, 0.24, 0.76);
  const firstPolygon = clipPolygonToSlab(polygon, axis, axisMin, splitAt);
  const secondPolygon = clipPolygonToSlab(polygon, axis, splitAt, axisMax);

  if (firstPolygon.length < 3 || secondPolygon.length < 3) {
    const alternateAxis = axis === "x" ? "y" : "x";
    const alternateMin = alternateAxis === "x" ? bounds.minX : bounds.minY;
    const alternateMax = alternateAxis === "x" ? bounds.maxX : bounds.maxY;
    const alternateSplit =
      alternateMin + (alternateMax - alternateMin) * clamp(firstRatio + (random() - 0.5) * 0.12, 0.24, 0.76);
    const alternateFirst = clipPolygonToSlab(polygon, alternateAxis, alternateMin, alternateSplit);
    const alternateSecond = clipPolygonToSlab(polygon, alternateAxis, alternateSplit, alternateMax);

    if (alternateFirst.length < 3 || alternateSecond.length < 3) {
      return createStripFallback(polygon, templates);
    }

    return [
      ...splitRegions(alternateFirst, firstTemplates, random, depth + 1),
      ...splitRegions(alternateSecond, secondTemplates, random, depth + 1),
    ];
  }

  return [
    ...splitRegions(firstPolygon, firstTemplates, random, depth + 1),
    ...splitRegions(secondPolygon, secondTemplates, random, depth + 1),
  ];
}

function chooseSplitIndex(templates: PartitionTemplate[], totalRatio: number, random: () => number) {
  const target = totalRatio * (0.43 + random() * 0.14);
  let bestIndex = 1;
  let bestDistance = Number.POSITIVE_INFINITY;
  let cumulative = 0;

  for (let index = 1; index < templates.length; index += 1) {
    cumulative += templates[index - 1].ratio;
    const distance = Math.abs(cumulative - target);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function createStripFallback(sitePolygon: GeometryPoint[], templates: PartitionTemplate[]) {
  const bounds = boundsFor(sitePolygon);
  const axis: "x" | "y" = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY ? "x" : "y";
  const axisMin = axis === "x" ? bounds.minX : bounds.minY;
  const axisMax = axis === "x" ? bounds.maxX : bounds.maxY;
  const axisSpan = Math.max(1, axisMax - axisMin);
  let cursor = axisMin;

  return templates.map((template, index) => {
    const start = cursor;
    const end = index === templates.length - 1 ? axisMax : Math.min(axisMax, cursor + axisSpan * template.ratio);
    cursor = end;
    const clipped = clipPolygonToSlab(sitePolygon, axis, start, end);

    return {
      template,
      corners: clipped.length >= 3 ? clipped : sitePolygon,
    };
  });
}

function boundsFor(points: GeometryPoint[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

function clipPolygonToSlab(
  points: GeometryPoint[],
  axis: "x" | "y",
  minValue: number,
  maxValue: number,
) {
  const lowerClipped = clipHalfPlane(points, axis, minValue, true);
  return clipHalfPlane(lowerClipped, axis, maxValue, false);
}

function clipHalfPlane(
  points: GeometryPoint[],
  axis: "x" | "y",
  boundary: number,
  keepGreater: boolean,
) {
  if (!points.length) {
    return [];
  }

  const result: GeometryPoint[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[(index + points.length - 1) % points.length];
    const currentInside = keepGreater ? current[axis] >= boundary : current[axis] <= boundary;
    const previousInside = keepGreater ? previous[axis] >= boundary : previous[axis] <= boundary;

    if (currentInside !== previousInside) {
      result.push(intersection(previous, current, axis, boundary));
    }

    if (currentInside) {
      result.push(current);
    }
  }

  return dedupePoints(result);
}

function intersection(a: GeometryPoint, b: GeometryPoint, axis: "x" | "y", boundary: number) {
  const denominator = b[axis] - a[axis];

  if (Math.abs(denominator) < 0.000001) {
    return { ...a };
  }

  const ratio = (boundary - a[axis]) / denominator;

  return interpolate(a, b, ratio);
}

function dedupePoints(points: GeometryPoint[]) {
  return points.filter((point, index) => {
    const previous = points[(index + points.length - 1) % points.length];
    return !previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.001;
  });
}

function interpolate(a: GeometryPoint, b: GeometryPoint, value: number): GeometryPoint {
  const point: GeometryPoint = {
    x: Number((a.x + (b.x - a.x) * value).toFixed(2)),
    y: Number((a.y + (b.y - a.y) * value).toFixed(2)),
  };

  if (Number.isFinite(a.lat) && Number.isFinite(b.lat)) {
    point.lat = Number(((a.lat ?? 0) + ((b.lat ?? 0) - (a.lat ?? 0)) * value).toFixed(7));
  }

  if (Number.isFinite(a.lng) && Number.isFinite(b.lng)) {
    point.lng = Number(((a.lng ?? 0) + ((b.lng ?? 0) - (a.lng ?? 0)) * value).toFixed(7));
  }

  return point;
}

function getCentroid(points: GeometryPoint[]): GeometryPoint {
  const total = points.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );

  return {
    x: Number((total.x / points.length).toFixed(2)),
    y: Number((total.y / points.length).toFixed(2)),
  };
}

function shoelaceArea(points: GeometryPoint[]) {
  return Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
}

function sizeForPartition(partition: PlanPartition, fallback?: ObjectSize): ObjectSize {
  const width = Math.max(2, Math.sqrt(partition.areaSquareMeters) * 0.55);
  const depth = Math.max(2, partition.areaSquareMeters / Math.max(width, 1));

  return {
    width: Number((fallback?.width ? Math.max(fallback.width, width) : width).toFixed(1)),
    depth: Number((fallback?.depth ? Math.max(fallback.depth, depth) : depth).toFixed(1)),
    height: fallback?.height ?? (partition.type === "greenhouse" ? 2.8 : 1),
  };
}

function adjustWaterNeed(
  waterNeed: PlanPartition["waterNeed"],
  weatherProfile: FarmPlannerInput["weatherProfile"],
) {
  if (weatherProfile !== "dry" || waterNeed === "high") {
    return waterNeed;
  }

  return waterNeed === "medium" ? "high" : "medium";
}

function weatherHighlight(weatherProfile: FarmPlannerInput["weatherProfile"]) {
  switch (weatherProfile) {
    case "dry":
      return "Dry-weather logic increases water capture and assigns deeper mulch.";
    case "wet":
      return "Wet-weather logic favors raised beds and overflow-safe habitat edges.";
    case "cold":
      return "Cold-weather logic gives protected starts and thermal mass extra value.";
    default:
      return "Temperate-weather logic balances food, habitat, water, and animal cycling.";
  }
}

function scorePlan(input: FarmPlannerInput, partitions: PlanPartition[]) {
  const diversity = new Set(partitions.map((partition) => partition.type)).size / 6;
  const climateFit = input.weatherProfile === "temperate" ? 0.84 : 0.88;
  const goalFit = input.strategy === "balanced" ? 0.86 : 0.82;

  return Number(Math.min(0.97, climateFit * 0.45 + goalFit * 0.35 + diversity * 0.2).toFixed(2));
}

function createSeededRandom(seed: string) {
  let state = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
