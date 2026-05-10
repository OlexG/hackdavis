import type {
  CostBreakdown,
  FarmObjectType,
  FarmPlanAnalytics,
  FarmPlanContext,
  GeometryPoint,
  ObjectSize,
  PlanObject,
  PlanTile,
  PlanTileType,
  RenderConfig,
  RevenueMetrics,
} from "./models";

export type FarmPlannerCatalogItem = {
  sourceId?: unknown;
  slug: string;
  type: FarmObjectType;
  name: string;
  defaultSize: ObjectSize;
  render: RenderConfig;
  cropProfile?: {
    idealSoilTypes: string[];
    idealSun: PlanTile["sunExposure"];
    idealWater: PlanTile["waterNeed"];
    daysToGermination: [number, number];
    daysToMaturity: [number, number];
    harvestWindowDays: [number, number];
    spacingInches: number;
    yieldPerSquareFoot: number;
    yieldUnit: string;
    expectedPricePerUnit: number;
    failureRate: number;
    waterGallonsPerSqFtWeek: number;
  };
  livestockProfile?: {
    species: string;
    feedCostPerHeadWeek: number;
    eggsPerHeadWeek?: number;
    milkGallonsPerHeadWeek?: number;
    expectedPricePerEggDozen?: number;
    expectedPricePerMilkGallon?: number;
    spaceSquareFeetPerHead: number;
    waterGallonsPerHeadWeek: number;
  };
  structureProfile?: {
    structureType: "storage" | "greenhouse" | "coop" | "compost" | "irrigation" | "other";
    storageCapacity?: {
      amount: number;
      unit: string;
    };
  };
};

export type FarmPlannerInput = {
  points: GeometryPoint[];
  locationLabel: string;
  weatherProfile: "temperate" | "dry" | "wet" | "cold";
  strategy: "balanced" | "food" | "livestock" | "low-maintenance";
  includeLivestock?: boolean;
  includeStructures?: boolean;
};

export type GeneratedFarmPlan = {
  name: string;
  bounds: ObjectSize;
  farmContext: FarmPlanContext;
  baseGeometry: {
    source: "satellite-drawn";
    locationLabel: string;
    points: GeometryPoint[];
    centroid: GeometryPoint;
    areaSquareMeters: number;
    areaSquareFeet: number;
  };
  tiles: PlanTile[];
  objects: Omit<PlanObject, "sourceId">[];
  analytics: FarmPlanAnalytics;
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

type FeetPoint = {
  x: number;
  y: number;
};

type CandidateCell = {
  gridX: number;
  gridY: number;
  world: FeetPoint;
  position: {
    x: number;
    z: number;
  };
  edgeDistance: number;
  centroidDistance: number;
};

type TileTemplate = {
  tileType: PlanTileType;
  objectType: FarmObjectType;
  slug: string;
  assignmentName: string;
  ratio: number;
  color: string;
  iconPath: string;
  sunExposure: PlanTile["sunExposure"];
  waterNeed: PlanTile["waterNeed"];
  soilStrategy: string;
  notes: string;
};

type AssignedTile = PlanTile & {
  objectType: FarmObjectType;
  objectInstanceId: string;
};

type TemplateTarget = {
  template: TileTemplate;
  count: number;
};

type RectPlacement = {
  x: number;
  y: number;
  width: number;
  depth: number;
  centerX: number;
  centerY: number;
};

const fallbackQuad: GeometryPoint[] = [
  { x: 16, y: 18 },
  { x: 84, y: 16 },
  { x: 88, y: 78 },
  { x: 12, y: 82 },
];

const iconPath = "/inventory-icons/";

const palette: Record<PlanTileType, string> = {
  tomato: "#6e9f45",
  lettuce: "#7ec65b",
  corn: "#d5b84b",
  potato: "#9b7a4b",
  strawberry: "#5f9d58",
  pea: "#66ad63",
  mushroom: "#b99067",
  herb: "#3f8b58",
  pollinator: "#9bb75d",
  chicken: "#d8ae48",
  goat: "#b99a65",
  storage: "#92704d",
  greenhouse: "#74b8be",
  compost: "#7a5a34",
  path: "#c7ad72",
};

const seedDate = "2026-03-15";

export function generateHomesteadPlan(
  input: FarmPlannerInput,
  catalog: FarmPlannerCatalogItem[],
): GeneratedFarmPlan {
  const points = normalizePoints(input.points);
  const centroid = getCentroid(points);
  const projected = projectGeometryToFeet(points);
  const bounds = boundsFor(projected);
  const areaSquareFeet = Math.max(16, Math.round(shoelaceArea(projected)));
  const areaSquareMeters = Math.max(1, Math.round(areaSquareFeet / 10.7639));
  const random = createSeededRandom(`${input.locationLabel}:${input.weatherProfile}:${input.strategy}:${Date.now()}`);
  const templates = normalizeRatios(getTileTemplates(input));
  const tiles = createPlanTiles(projected, areaSquareFeet, templates, random);
  const tileBounds = tileBoundsFor(tiles);
  const objects = createPlanObjects(tiles, catalog);
  const analytics = calculateAnalytics(objects);
  const farmContext = {
    averageWeather: weatherLabel(input.weatherProfile),
    yearlyRainfallInches: yearlyRainfall(input.weatherProfile),
    bounds: {
      points,
      dimensions: {
        width: Math.max(8, Math.ceil(bounds.maxX - bounds.minX)),
        depth: Math.max(8, Math.ceil(bounds.maxY - bounds.minY)),
        height: 0,
      },
      areaSquareFeet: tiles.length,
    },
  } satisfies FarmPlanContext;

  return {
    name: `Modeled Voxel Farm - ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`,
    bounds: {
      width: Math.max(8, tileBounds.width),
      depth: Math.max(8, tileBounds.depth),
      height: 5,
    },
    farmContext,
    baseGeometry: {
      source: "satellite-drawn",
      locationLabel: input.locationLabel.trim() || "Drawn homestead site",
      points,
      centroid,
      areaSquareMeters,
      areaSquareFeet: tiles.length,
    },
    tiles,
    objects,
    analytics,
    summary: {
      description: `A ${tiles.length.toLocaleString("en-US")} sq ft object-modeled voxel farm for ${input.locationLabel.trim() || "the selected site"}.`,
      highlights: [
        "The selected outline is converted to exact one-square-foot voxel coordinates.",
        "Crops, livestock, and structures are modeled as editable footprint objects.",
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
      prompt: `Generate an object-modeled voxel farm for ${input.locationLabel} with ${input.weatherProfile} weather and ${input.strategy} goals.`,
      constraints: {
        weatherProfile: input.weatherProfile,
        locationLabel: input.locationLabel,
        basePointCount: points.length,
        tileSizeFeet: 1,
        tileGeometry: "feet-projected-object-voxel-grid",
        tileCount: tiles.length,
        includeLivestock: input.includeLivestock !== false,
        includeStructures: input.includeStructures !== false,
      },
      score: scorePlan(input, tiles, objects),
    },
  };
}

function getTileTemplates(input: FarmPlannerInput): TileTemplate[] {
  const includeLivestock = input.includeLivestock !== false;
  const includeStructures = input.includeStructures !== false;
  const foodBias = input.strategy === "food" ? 0.08 : 0;
  const livestockBias = input.strategy === "livestock" ? 0.09 : 0;
  const lowCareBias = input.strategy === "low-maintenance" ? 0.06 : 0;
  const dryBias = input.weatherProfile === "dry" ? 0.05 : 0;
  const templates: TileTemplate[] = [
    cropTemplate("tomato", "tomatoes", "Tomatoes", 0.15 + foodBias, "full", "high", input, "Warm-season fruiting crop."),
    cropTemplate("lettuce", "lettuce", "Lettuce", 0.11, input.weatherProfile === "dry" ? "partial" : "full", "medium", input, "Quick leafy-green crop."),
    cropTemplate("corn", "corn", "Corn", 0.1 + foodBias, "full", "medium", input, "Tall grain crop block."),
    cropTemplate("potato", "potatoes", "Potatoes", 0.1 + foodBias, "full", "medium", input, "Calorie-dense root crop."),
    cropTemplate("strawberry", "strawberries", "Strawberries", 0.09 + lowCareBias, "full", "medium", input, "Low perennial fruit crop."),
    cropTemplate("pea", "peas", "Peas", 0.08, input.weatherProfile === "dry" ? "partial" : "full", "medium", input, "Nitrogen-fixing vine crop."),
    cropTemplate("mushroom", "mushrooms", "Mushrooms", input.weatherProfile === "dry" ? 0.035 : 0.065, "shade", input.weatherProfile === "dry" ? "high" : "medium", input, "Shade crop for damp edges."),
    cropTemplate("herb", "herbs", "Herbs", 0.09 + dryBias, "full", input.weatherProfile === "dry" ? "low" : "medium", input, "Culinary herb crop."),
    cropTemplate("pollinator", "pollinator-flowers", "Pollinator Flowers", 0.075 + lowCareBias, "partial", "low", input, "Beneficial insect habitat crop."),
  ];

  if (includeLivestock) {
    templates.push(
      objectTemplate("chicken", "livestock", "chickens", "Chicken Run", 0.045 + livestockBias, "full", "medium", "Bedded run with rotated feed and water points.", "Egg-laying flock footprint."),
      objectTemplate("goat", "livestock", "goats", "Goat Pen", input.strategy === "livestock" ? 0.055 : 0.025, "partial", "medium", "Dry shelter, browsing space, and mineral access.", "Small dairy/meat livestock footprint."),
    );
  }

  if (includeStructures) {
    templates.push(
      objectTemplate("path", "structure", "farm-paths", "Walkable Paths", 0.055, "full", "low", "Compacted walking routes between production zones.", "Walkable access path footprint."),
      objectTemplate("storage", "structure", "storage-shed", "Storage Shed", 0.025, "partial", "low", "Dry, shaded storage near harvest paths.", "Storage unit footprint."),
      objectTemplate("greenhouse", "structure", "greenhouse", "Greenhouse", 0.035, "full", "medium", "Protected warm-season starts and shoulder-season production.", "Protected growing structure."),
      objectTemplate("compost", "structure", "compost-bay", "Compost Bay", 0.02, "partial", "low", "Browns, greens, and manure staged away from harvest wash areas.", "Compost and manure handling footprint."),
    );
  }

  return templates;
}

function cropTemplate(
  tileType: PlanTileType,
  slug: string,
  assignmentName: string,
  ratio: number,
  sunExposure: PlanTile["sunExposure"],
  waterNeed: PlanTile["waterNeed"],
  input: FarmPlannerInput,
  notes: string,
): TileTemplate {
  return objectTemplate(
    tileType,
    "crop",
    slug,
    assignmentName,
    ratio,
    sunExposure,
    adjustWaterNeed(waterNeed, input.weatherProfile),
    soilStrategyFor(tileType, input.weatherProfile),
    notes,
  );
}

function objectTemplate(
  tileType: PlanTileType,
  objectType: FarmObjectType,
  slug: string,
  assignmentName: string,
  ratio: number,
  sunExposure: PlanTile["sunExposure"],
  waterNeed: PlanTile["waterNeed"],
  soilStrategy: string,
  notes: string,
): TileTemplate {
  return {
    tileType,
    objectType,
    slug,
    assignmentName,
    ratio,
    color: palette[tileType],
    iconPath: iconFor(tileType),
    sunExposure,
    waterNeed,
    soilStrategy,
    notes,
  };
}

function createPlanTiles(
  polygonFeet: FeetPoint[],
  tileCount: number,
  templates: TileTemplate[],
  random: () => number,
) {
  const candidates = createExactCells(polygonFeet, tileCount, random);
  const assignments = assignCandidatesToRectangularFootprints(candidates, templates, tileCount, random);
  const assignedCounts = new Map<PlanTileType, number>();

  return assignments
    .map(({ candidate, template }, index) => {
      const tileIndex = (assignedCounts.get(template.tileType) ?? 0) + 1;
      assignedCounts.set(template.tileType, tileIndex);
      const objectInstanceId = `${template.objectType}_${template.slug}_${template.tileType}`;

      return {
        tileId: `tile_${index + 1}_${template.tileType}`,
        tileType: template.tileType,
        objectType: template.objectType,
        objectInstanceId,
        assignmentSlug: template.slug,
        assignmentName: template.assignmentName,
        grid: {
          x: candidate.gridX,
          y: candidate.gridY,
        },
        position: candidate.position,
        sizeFeet: 1,
        areaSquareFeet: 1,
        color: template.color,
        iconPath: template.iconPath,
        sunExposure: template.sunExposure,
        waterNeed: template.waterNeed,
        soilStrategy: template.soilStrategy,
        notes: `${template.notes} Tile ${tileIndex.toLocaleString("en-US")}.`,
      } satisfies AssignedTile;
    })
    .sort((left, right) => left.grid.y - right.grid.y || left.grid.x - right.grid.x);
}

function createPlanObjects(tiles: AssignedTile[], catalog: FarmPlannerCatalogItem[]) {
  const grouped = new Map<string, AssignedTile[]>();

  tiles.forEach((tile) => {
    grouped.set(tile.objectInstanceId, [...(grouped.get(tile.objectInstanceId) ?? []), tile]);
  });

  return [...grouped.values()].map((tileGroup) => {
    const first = tileGroup[0];
    const catalogItem = catalog.find((item) => item.slug === first.assignmentSlug);
    const rect = rectForTiles(tileGroup);
    const areaSquareFeet = tileGroup.length;
    const position = {
      x: Number(((rect.minX + rect.maxX) / 2).toFixed(2)),
      y: 0,
      z: Number(((rect.minZ + rect.maxZ) / 2).toFixed(2)),
    };
    const base = {
      instanceId: first.objectInstanceId,
      type: first.objectType,
      slug: first.assignmentSlug,
      displayName: first.objectType === "crop" ? `${first.assignmentName} Plot` : first.assignmentName,
      status: "planned" as const,
      plantedAtDay: first.objectType === "crop" ? 0 : undefined,
      addedAtDay: first.objectType !== "crop" ? 0 : undefined,
      position,
      rotation: { x: 0, y: 0, z: 0 },
      size: {
        width: Number(Math.max(1, rect.maxX - rect.minX + 1).toFixed(1)),
        depth: Number(Math.max(1, rect.maxZ - rect.minZ + 1).toFixed(1)),
        height: catalogItem?.defaultSize.height ?? 1,
      },
      geometry: {
        points: [
          { x: rect.minX - 0.5, y: rect.minZ - 0.5 },
          { x: rect.maxX + 0.5, y: rect.minZ - 0.5 },
          { x: rect.maxX + 0.5, y: rect.maxZ + 0.5 },
          { x: rect.minX - 0.5, y: rect.maxZ + 0.5 },
        ],
        areaSquareFeet,
      },
      areaSquareFeet,
      renderOverrides: {
        ...(catalogItem?.render ?? {}),
        color: first.color,
        label: first.assignmentName,
        iconPath: first.iconPath,
      },
      notes: `${areaSquareFeet.toLocaleString("en-US")} sq ft ${first.objectType} footprint.`,
    } satisfies Omit<PlanObject, "sourceId">;

    if (first.objectType === "crop") {
      return addCropModel(base, first, catalogItem);
    }

    if (first.objectType === "livestock") {
      return addLivestockModel(base, first, catalogItem);
    }

    return addStructureModel(base, first, catalogItem);
  });
}

function addCropModel(
  object: Omit<PlanObject, "sourceId">,
  tile: PlanTile,
  catalogItem?: FarmPlannerCatalogItem,
) {
  const profile = catalogItem?.cropProfile ?? defaultCropProfile(tile.tileType);
  const plantCount = Math.max(1, Math.floor((object.areaSquareFeet ?? 1) * 144 / (profile.spacingInches ** 2)));
  const monthlyRevenue = (object.areaSquareFeet ?? 0) * profile.yieldPerSquareFoot * profile.expectedPricePerUnit;
  const weeklyWater = (object.areaSquareFeet ?? 0) * profile.waterGallonsPerSqFtWeek;
  const cropCost = {
    seeds: Number(((object.areaSquareFeet ?? 0) * 0.08).toFixed(2)),
    amendments: Number(((object.areaSquareFeet ?? 0) * 0.04).toFixed(2)),
    compost: Number(((object.areaSquareFeet ?? 0) * 0.05).toFixed(2)),
    pesticides: Number(((object.areaSquareFeet ?? 0) * 0.01).toFixed(2)),
  } satisfies CostBreakdown;

  return {
    ...object,
    costBreakdown: cropCost,
    recurringCost: recurringFromWeekly(sumCosts(cropCost) / 12),
    revenue: revenueFromMonthly(monthlyRevenue, object.areaSquareFeet, plantCount),
    waterGallonsPerWeek: Number(weeklyWater.toFixed(1)),
    crop: {
      cropType: tile.assignmentSlug,
      seedLot: `${tile.assignmentSlug.toUpperCase()}-2026-A`,
      seedSource: "Seeded catalog source",
      seedOrTransplantDate: seedDate,
      soilType: tile.soilStrategy,
      soilWarning: profile.idealSoilTypes.some((soil) => tile.soilStrategy.toLowerCase().includes(soil.toLowerCase()))
        ? undefined
        : `Compare against ideal soil: ${profile.idealSoilTypes.join(", ")}.`,
      sunExposure: tile.sunExposure,
      sunWarning: tile.sunExposure === profile.idealSun ? undefined : `Ideal sun is ${profile.idealSun}.`,
      fertilizer: { type: "organic fertilizer", status: "planned", appliedAt: seedDate },
      manure: { type: "aged manure", status: "planned" },
      compost: { type: "finished compost", status: "planned", appliedAt: seedDate },
      pesticides: [],
      priorCrops: [],
      harvestEvents: [],
      deathEvents: [],
      producedMetrics: {
        expectedGerminationDays: profile.daysToGermination,
        daysToMaturity: profile.daysToMaturity,
        expectedHarvestWindow: [addDays(seedDate, profile.harvestWindowDays[0]), addDays(seedDate, profile.harvestWindowDays[1])],
        averageSpacingInches: profile.spacingInches,
        yieldPerSquareFoot: profile.yieldPerSquareFoot,
        yieldPerPlant: Number((profile.yieldPerSquareFoot / Math.max(1, plantCount / (object.areaSquareFeet ?? 1))).toFixed(2)),
        daysFromPlantingToFirstHarvest: profile.harvestWindowDays[0],
        daysInProduction: Math.max(1, profile.harvestWindowDays[1] - profile.harvestWindowDays[0]),
        cropFailureRate: profile.failureRate,
      },
    },
  } satisfies Omit<PlanObject, "sourceId">;
}

function addLivestockModel(
  object: Omit<PlanObject, "sourceId">,
  tile: PlanTile,
  catalogItem?: FarmPlannerCatalogItem,
) {
  const profile = catalogItem?.livestockProfile ?? defaultLivestockProfile(tile.tileType);
  const headCount = Math.max(1, Math.floor((object.areaSquareFeet ?? 1) / profile.spaceSquareFeetPerHead));
  const feedWeekly = headCount * profile.feedCostPerHeadWeek;
  const eggsWeekly = headCount * (profile.eggsPerHeadWeek ?? 0);
  const milkWeekly = headCount * (profile.milkGallonsPerHeadWeek ?? 0);
  const revenueWeekly =
    (eggsWeekly / 12) * (profile.expectedPricePerEggDozen ?? 0) +
    milkWeekly * (profile.expectedPricePerMilkGallon ?? 0);
  const costBreakdown = {
    feed: Number(feedWeekly.toFixed(2)),
    bedding: Number((headCount * 0.7).toFixed(2)),
  } satisfies CostBreakdown;

  return {
    ...object,
    costBreakdown,
    recurringCost: recurringFromWeekly(sumCosts(costBreakdown)),
    revenue: revenueFromWeekly(revenueWeekly),
    waterGallonsPerWeek: Number((headCount * profile.waterGallonsPerHeadWeek).toFixed(1)),
    livestock: {
      animalId: `${tile.assignmentSlug}-group-1`,
      species: profile.species,
      breed: tile.tileType === "chicken" ? "Layer mix" : "Mixed dairy",
      birthOrHatchDate: "2026-02-01",
      source: "Seeded local livestock source",
      weight: { amount: tile.tileType === "chicken" ? 5 : 85, unit: "lb" },
      vaccinations: [],
      feedType: tile.tileType === "chicken" ? "layer feed + forage" : "hay + browse",
      headCount,
      harvestEvents: [],
      deathEvents: [],
      producedMetrics: {
        feedCost: recurringFromWeekly(feedWeekly),
        eggsPerPeriod: eggsWeekly ? recurringFromWeekly(eggsWeekly) : undefined,
        milkGallonsPerPeriod: milkWeekly ? recurringFromWeekly(milkWeekly) : undefined,
        revenue: revenueFromWeekly(revenueWeekly),
      },
    },
  } satisfies Omit<PlanObject, "sourceId">;
}

function addStructureModel(
  object: Omit<PlanObject, "sourceId">,
  tile: PlanTile,
  catalogItem?: FarmPlannerCatalogItem,
) {
  const structureType = catalogItem?.structureProfile?.structureType ?? (tile.tileType === "storage" ? "storage" : tile.tileType === "greenhouse" ? "greenhouse" : tile.tileType === "path" ? "other" : "compost");
  const costBreakdown = {
    infrastructure: Number(((object.areaSquareFeet ?? 0) * (structureType === "greenhouse" ? 4.2 : 1.4)).toFixed(2)),
    utilities: structureType === "greenhouse" ? 8 : 0,
  } satisfies CostBreakdown;

  return {
    ...object,
    costBreakdown,
    recurringCost: recurringFromWeekly(costBreakdown.utilities ?? 0),
    revenue: revenueFromWeekly(0),
    waterGallonsPerWeek: structureType === "greenhouse" ? Number(((object.areaSquareFeet ?? 0) * 1.2).toFixed(1)) : 0,
    structure: {
      structureType,
      invisibleExternalStorage: structureType === "storage",
      storedItems:
        structureType === "storage"
          ? [
              {
                itemType: "mixed harvest",
                quantity: { amount: Math.max(10, Math.round((object.areaSquareFeet ?? 0) * 2)), unit: "lb" },
                forSale: true,
                pricePerUnit: 4,
              },
            ]
          : undefined,
    },
  } satisfies Omit<PlanObject, "sourceId">;
}

function calculateAnalytics(objects: Omit<PlanObject, "sourceId">[]) {
  const weekly = totalCosts(objects.map((object) => object.recurringCost ? periodToCost(object.costBreakdown, object.recurringCost.weekly) : object.costBreakdown));
  const monthly = totalCosts(objects.map((object) => scaleCost(object.costBreakdown, 1)));
  const yearly = totalCosts(objects.map((object) => scaleCost(object.costBreakdown, 12)));
  const revenueWeekly = sum(objects.map((object) => object.revenue?.weekly ?? 0));
  const revenueMonthly = sum(objects.map((object) => object.revenue?.monthly ?? 0));
  const revenueYearly = sum(objects.map((object) => object.revenue?.yearly ?? 0));
  const storage = objects.flatMap((object) =>
    object.structure?.storedItems?.map((item) => ({
      unitId: object.instanceId,
      itemType: item.itemType,
      quantity: item.quantity.amount,
      unit: item.quantity.unit,
      weeksRemaining: item.quantity.amount > 0 ? Math.round(item.quantity.amount / 5) : 0,
      forSale: item.forSale,
      pricePerUnit: item.pricePerUnit,
    })) ?? [],
  );

  return {
    costBreakdown: {
      weekly,
      monthly,
      yearly,
    },
    potentialMonthlyEarnings: Number(revenueMonthly.toFixed(2)),
    revenue: {
      weekly: Number(revenueWeekly.toFixed(2)),
      monthly: Number(revenueMonthly.toFixed(2)),
      yearly: Number(revenueYearly.toFixed(2)),
    },
    profit: {
      weekly: Number((revenueWeekly - weekly.total).toFixed(2)),
      monthly: Number((revenueMonthly - monthly.total).toFixed(2)),
      yearly: Number((revenueYearly - yearly.total).toFixed(2)),
    },
    waterGallonsPerWeek: Number(sum(objects.map((object) => object.waterGallonsPerWeek ?? 0)).toFixed(1)),
    storage,
  } satisfies FarmPlanAnalytics;
}

function createExactCells(polygonFeet: FeetPoint[], tileCount: number, random: () => number) {
  const bounds = boundsFor(polygonFeet);
  const minGridX = Math.floor(bounds.minX);
  const maxGridX = Math.ceil(bounds.maxX) - 1;
  const minGridY = Math.floor(bounds.minY);
  const maxGridY = Math.ceil(bounds.maxY) - 1;
  const centroid = getFeetCentroid(polygonFeet);
  const inside: CandidateCell[] = [];
  const outside: CandidateCell[] = [];

  for (let gridY = minGridY - 1; gridY <= maxGridY + 1; gridY += 1) {
    for (let gridX = minGridX - 1; gridX <= maxGridX + 1; gridX += 1) {
      const world = { x: gridX + 0.5, y: gridY + 0.5 };
      const candidate = {
        gridX: gridX - minGridX,
        gridY: gridY - minGridY,
        world,
        position: {
          x: Number((world.x - centroid.x).toFixed(2)),
          z: Number((world.y - centroid.y).toFixed(2)),
        },
        edgeDistance: distanceToPolygonEdge(world, polygonFeet),
        centroidDistance: Math.hypot(world.x - centroid.x, world.y - centroid.y),
      };

      if (pointInPolygon(world, polygonFeet)) {
        inside.push(candidate);
      } else {
        outside.push(candidate);
      }
    }
  }

  if (inside.length > tileCount) {
    return inside
      .map((cell) => ({ cell, score: cell.edgeDistance + random() * 0.01 }))
      .sort((left, right) => right.score - left.score)
      .map(({ cell }) => cell)
      .slice(0, tileCount);
  }

  if (inside.length < tileCount) {
    const additions = outside
      .map((cell) => ({ cell, score: cell.edgeDistance + cell.centroidDistance * 0.002 + random() * 0.01 }))
      .sort((left, right) => left.score - right.score)
      .map(({ cell }) => cell)
      .slice(0, tileCount - inside.length);

    return [...inside, ...additions].slice(0, tileCount);
  }

  return inside;
}

function assignCandidatesToRectangularFootprints(
  candidates: CandidateCell[],
  templates: TileTemplate[],
  tileCount: number,
  random: () => number,
) {
  const targets = createTemplateTargets(tileCount, templates);
  const orderedTargets = orderTargetsForPacking(templates
    .map((template) => ({ template, count: targets.get(template.tileType) ?? 0 }))
    .filter((target) => target.count > 0));
  const available = new Map(candidates.map((candidate) => [cellKey(candidate), candidate]));
  const candidateBounds = candidateGridBounds(candidates);
  const assignments: Array<{ candidate: CandidateCell; template: TileTemplate }> = [];

  orderedTargets.forEach((target, index) => {
    const remainingTargets = orderedTargets.length - index - 1;
    const targetCount = remainingTargets === 0 ? available.size : Math.min(target.count, available.size);
    const placement = findRectPlacement(target, index, orderedTargets.length, candidateBounds, available, random);
    const chosen = pickRectCells(placement, targetCount, available, target.template.tileType === "path" || remainingTargets === 0);

    chosen.forEach((candidate) => {
      available.delete(cellKey(candidate));
      assignments.push({ candidate, template: target.template });
    });
  });

  if (available.size) {
    const fallbackTemplate = orderedTargets.at(-1)?.template ?? templates[0];
    [...available.values()]
      .sort((left, right) => left.gridY - right.gridY || left.gridX - right.gridX)
      .forEach((candidate) => assignments.push({ candidate, template: fallbackTemplate }));
  }

  return assignments;
}

function orderTargetsForPacking(targets: TemplateTarget[]) {
  return [...targets].sort((left, right) => {
    const priority = packingPriority(left.template) - packingPriority(right.template);

    if (priority) {
      return priority;
    }

    return right.count - left.count;
  });
}

function packingPriority(template: TileTemplate) {
  if (template.tileType === "path") {
    return 3;
  }

  if (template.objectType === "structure") {
    return 0;
  }

  if (template.objectType === "livestock") {
    return 1;
  }

  return 2;
}

function findRectPlacement(
  target: TemplateTarget,
  index: number,
  totalTargets: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number; width: number; depth: number },
  available: Map<string, CandidateCell>,
  random: () => number,
): RectPlacement {
  const dims = rectangleDimensions(target, bounds);
  const preferred = preferredPackingPoint(index, totalTargets, bounds);
  const stepX = Math.max(1, Math.floor(dims.width / 5));
  const stepY = Math.max(1, Math.floor(dims.depth / 5));
  let best: RectPlacement | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let y = bounds.minY; y <= bounds.maxY - dims.depth + 1; y += stepY) {
    for (let x = bounds.minX; x <= bounds.maxX - dims.width + 1; x += stepX) {
      const placement = {
        x,
        y,
        width: dims.width,
        depth: dims.depth,
        centerX: x + dims.width / 2,
        centerY: y + dims.depth / 2,
      };
      const availableCount = countAvailableInRect(placement, available);
      const fillRatio = availableCount / Math.max(1, dims.width * dims.depth);
      const enoughBonus = availableCount >= target.count ? 12_000 : availableCount * 7;
      const distancePenalty = Math.hypot(placement.centerX - preferred.x, placement.centerY - preferred.y) * 1.8;
      const score = enoughBonus + fillRatio * 900 - distancePenalty + random() * 0.001;

      if (score > bestScore) {
        bestScore = score;
        best = placement;
      }
    }
  }

  return best ?? {
    x: bounds.minX,
    y: bounds.minY,
    width: dims.width,
    depth: dims.depth,
    centerX: bounds.minX + dims.width / 2,
    centerY: bounds.minY + dims.depth / 2,
  };
}

function rectangleDimensions(
  target: TemplateTarget,
  bounds: { width: number; depth: number },
) {
  const aspect =
    target.template.objectType === "structure"
      ? 1
      : target.template.objectType === "livestock"
        ? target.template.tileType === "chicken" ? 1.5 : 1.25
        : target.count > 1_500
          ? 1.25
          : 1.1;
  let width = Math.max(1, Math.round(Math.sqrt(target.count * aspect)));
  let depth = Math.max(1, Math.ceil(target.count / width));

  if (width > bounds.width) {
    width = bounds.width;
    depth = Math.ceil(target.count / width);
  }

  if (depth > bounds.depth) {
    depth = bounds.depth;
    width = Math.ceil(target.count / depth);
  }

  width = Math.min(bounds.width, Math.max(1, width));
  depth = Math.min(bounds.depth, Math.max(1, depth));

  return { width, depth };
}

function preferredPackingPoint(
  index: number,
  totalTargets: number,
  bounds: { minX: number; minY: number; width: number; depth: number },
) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(totalTargets)));
  const rows = Math.max(1, Math.ceil(totalTargets / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);

  return {
    x: bounds.minX + ((column + 0.5) / columns) * bounds.width,
    y: bounds.minY + ((row + 0.5) / rows) * bounds.depth,
  };
}

function pickRectCells(
  placement: RectPlacement,
  targetCount: number,
  available: Map<string, CandidateCell>,
  allowSpillover: boolean,
) {
  const expandedPlacement = allowSpillover ? expandPlacementToFit(placement, targetCount, available) : placement;
  const inRect = cellsInRect(expandedPlacement, available);
  const chosen = inRect.slice(0, targetCount);

  if (chosen.length >= targetCount || !allowSpillover) {
    return chosen;
  }

  const chosenKeys = new Set(chosen.map(cellKey));
  const topUp = [...available.values()]
    .filter((candidate) => !chosenKeys.has(cellKey(candidate)))
    .map((candidate) => ({
      candidate,
      score:
        distanceToRect(candidate, placement) * 10 +
        Math.hypot(candidate.gridX - expandedPlacement.centerX, candidate.gridY - expandedPlacement.centerY) +
        candidate.edgeDistance * 0.04,
    }))
    .sort((left, right) => left.score - right.score)
    .map(({ candidate }) => candidate)
    .slice(0, targetCount - chosen.length);

  return [...chosen, ...topUp];
}

function expandPlacementToFit(
  placement: RectPlacement,
  targetCount: number,
  available: Map<string, CandidateCell>,
) {
  const bounds = candidateGridBounds([...available.values()]);
  let expanded = placement;
  let availableCount = countAvailableInRect(expanded, available);

  while (availableCount < targetCount && (expanded.width < bounds.width || expanded.depth < bounds.depth)) {
    const nextWidth = Math.min(bounds.width, expanded.width + 2);
    const nextDepth = Math.min(bounds.depth, expanded.depth + 2);
    const nextX = clamp(Math.round(expanded.centerX - nextWidth / 2), bounds.minX, bounds.maxX - nextWidth + 1);
    const nextY = clamp(Math.round(expanded.centerY - nextDepth / 2), bounds.minY, bounds.maxY - nextDepth + 1);
    expanded = {
      x: nextX,
      y: nextY,
      width: nextWidth,
      depth: nextDepth,
      centerX: nextX + nextWidth / 2,
      centerY: nextY + nextDepth / 2,
    };
    availableCount = countAvailableInRect(expanded, available);
  }

  return expanded;
}

function cellsInRect(placement: RectPlacement, available: Map<string, CandidateCell>) {
  const cells: CandidateCell[] = [];

  for (let y = placement.y; y < placement.y + placement.depth; y += 1) {
    for (let x = placement.x; x < placement.x + placement.width; x += 1) {
      const candidate = available.get(`${x}:${y}`);

      if (candidate) {
        cells.push(candidate);
      }
    }
  }

  return cells.sort((left, right) => left.gridY - right.gridY || left.gridX - right.gridX);
}

function countAvailableInRect(placement: RectPlacement, available: Map<string, CandidateCell>) {
  let count = 0;

  for (let y = placement.y; y < placement.y + placement.depth; y += 1) {
    for (let x = placement.x; x < placement.x + placement.width; x += 1) {
      if (available.has(`${x}:${y}`)) {
        count += 1;
      }
    }
  }

  return count;
}

function distanceToRect(candidate: CandidateCell, placement: RectPlacement) {
  const dx = Math.max(placement.x - candidate.gridX, 0, candidate.gridX - (placement.x + placement.width - 1));
  const dy = Math.max(placement.y - candidate.gridY, 0, candidate.gridY - (placement.y + placement.depth - 1));
  return Math.hypot(dx, dy);
}

function candidateGridBounds(candidates: CandidateCell[]) {
  const minX = Math.min(...candidates.map((candidate) => candidate.gridX));
  const maxX = Math.max(...candidates.map((candidate) => candidate.gridX));
  const minY = Math.min(...candidates.map((candidate) => candidate.gridY));
  const maxY = Math.max(...candidates.map((candidate) => candidate.gridY));

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    depth: maxY - minY + 1,
  };
}

function cellKey(candidate: CandidateCell) {
  return `${candidate.gridX}:${candidate.gridY}`;
}

function createTemplateTargets(tileCount: number, templates: TileTemplate[]) {
  const targets = new Map<PlanTileType, number>();
  const rawTargets = templates.map((template) => {
    const raw = tileCount * template.ratio;
    const minimum = template.objectType === "crop" ? 1 : Math.min(4, tileCount);

    return {
      template,
      count: Math.max(minimum, Math.floor(raw)),
      remainder: raw % 1,
    };
  });
  let assigned = rawTargets.reduce((sum, target) => sum + target.count, 0);

  while (assigned > tileCount) {
    const target = rawTargets
      .filter((item) => item.count > 1)
      .sort((left, right) => left.count - right.count)[0];

    if (!target) {
      break;
    }

    target.count -= 1;
    assigned -= 1;
  }

  [...rawTargets]
    .sort((left, right) => right.remainder - left.remainder)
    .forEach((target) => {
      if (assigned < tileCount) {
        target.count += 1;
        assigned += 1;
      }
    });

  rawTargets.forEach(({ template, count }) => targets.set(template.tileType, count));

  return targets;
}

function normalizeRatios(templates: TileTemplate[]) {
  const total = templates.reduce((sum, template) => sum + template.ratio, 0);
  return templates.map((template) => ({ ...template, ratio: template.ratio / total }));
}

function normalizePoints(points: GeometryPoint[]) {
  const clean = points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .map((point) => ({ ...point, x: clamp(point.x, 0, 100), y: clamp(point.y, 0, 100) }));

  return clean.length >= 4 ? clean : fallbackQuad;
}

function projectGeometryToFeet(points: GeometryPoint[]) {
  const latLngPoints = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

  if (latLngPoints.length === points.length) {
    const originLat = latLngPoints.reduce((sum, point) => sum + (point.lat ?? 0), 0) / latLngPoints.length;
    const originLng = latLngPoints.reduce((sum, point) => sum + (point.lng ?? 0), 0) / latLngPoints.length;

    return latLngPoints.map((point) => latLngToFeet(point.lat ?? originLat, point.lng ?? originLng, originLat, originLng));
  }

  return points.map((point) => ({ x: (point.x - 50) * 2, y: (point.y - 50) * 2 }));
}

function latLngToFeet(lat: number, lng: number, originLat: number, originLng: number) {
  const metersPerDegreeLat = 111_132.92 - 559.82 * Math.cos(2 * toRadians(originLat)) + 1.175 * Math.cos(4 * toRadians(originLat));
  const metersPerDegreeLng = 111_412.84 * Math.cos(toRadians(originLat)) - 93.5 * Math.cos(3 * toRadians(originLat));

  return {
    x: (lng - originLng) * metersPerDegreeLng * 3.28084,
    y: (lat - originLat) * metersPerDegreeLat * 3.28084,
  };
}

function rectForTiles(tiles: PlanTile[]) {
  return {
    minX: Math.min(...tiles.map((tile) => tile.position.x)),
    maxX: Math.max(...tiles.map((tile) => tile.position.x)),
    minZ: Math.min(...tiles.map((tile) => tile.position.z)),
    maxZ: Math.max(...tiles.map((tile) => tile.position.z)),
  };
}

function tileBoundsFor(tiles: PlanTile[]) {
  if (!tiles.length) {
    return { width: 8, depth: 8 };
  }

  const rect = rectForTiles(tiles);

  return {
    width: Math.ceil(rect.maxX - rect.minX + 1),
    depth: Math.ceil(rect.maxZ - rect.minZ + 1),
  };
}

function pointInPolygon(point: FeetPoint, polygon: FeetPoint[]) {
  let inside = false;

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y || 0.000001) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function distanceToPolygonEdge(point: FeetPoint, polygon: FeetPoint[]) {
  return polygon.reduce((best, current, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return Math.min(best, distanceToSegment(point, current, next));
  }, Number.POSITIVE_INFINITY);
}

function distanceToSegment(point: FeetPoint, a: FeetPoint, b: FeetPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (!lengthSquared) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }

  const ratio = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - (a.x + ratio * dx), point.y - (a.y + ratio * dy));
}

function getCentroid(points: GeometryPoint[]): GeometryPoint {
  const total = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return { x: Number((total.x / points.length).toFixed(2)), y: Number((total.y / points.length).toFixed(2)) };
}

function getFeetCentroid(points: FeetPoint[]) {
  const total = points.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length };
}

function shoelaceArea(points: FeetPoint[]) {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2);
}

function boundsFor(points: FeetPoint[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY },
  );
}

function defaultCropProfile(tileType: PlanTileType) {
  const profiles: Record<string, NonNullable<FarmPlannerCatalogItem["cropProfile"]>> = {
    tomato: { idealSoilTypes: ["compost", "loam"], idealSun: "full", idealWater: "high", daysToGermination: [5, 10], daysToMaturity: [70, 85], harvestWindowDays: [75, 130], spacingInches: 24, yieldPerSquareFoot: 1.8, yieldUnit: "lb", expectedPricePerUnit: 4.5, failureRate: 0.08, waterGallonsPerSqFtWeek: 1.2 },
    lettuce: { idealSoilTypes: ["fine compost"], idealSun: "partial", idealWater: "medium", daysToGermination: [2, 8], daysToMaturity: [30, 55], harvestWindowDays: [35, 70], spacingInches: 10, yieldPerSquareFoot: 0.8, yieldUnit: "head", expectedPricePerUnit: 3, failureRate: 0.05, waterGallonsPerSqFtWeek: 0.8 },
    corn: { idealSoilTypes: ["rich soil"], idealSun: "full", idealWater: "medium", daysToGermination: [7, 10], daysToMaturity: [75, 100], harvestWindowDays: [85, 105], spacingInches: 12, yieldPerSquareFoot: 0.45, yieldUnit: "ear", expectedPricePerUnit: 1.25, failureRate: 0.1, waterGallonsPerSqFtWeek: 1 },
    potato: { idealSoilTypes: ["loose soil", "mulch"], idealSun: "full", idealWater: "medium", daysToGermination: [14, 28], daysToMaturity: [80, 110], harvestWindowDays: [90, 120], spacingInches: 12, yieldPerSquareFoot: 1.4, yieldUnit: "lb", expectedPricePerUnit: 2, failureRate: 0.07, waterGallonsPerSqFtWeek: 0.75 },
    strawberry: { idealSoilTypes: ["compost", "mulch"], idealSun: "full", idealWater: "medium", daysToGermination: [7, 21], daysToMaturity: [90, 120], harvestWindowDays: [100, 170], spacingInches: 12, yieldPerSquareFoot: 0.7, yieldUnit: "pint", expectedPricePerUnit: 5, failureRate: 0.06, waterGallonsPerSqFtWeek: 0.7 },
    pea: { idealSoilTypes: ["inoculated soil"], idealSun: "full", idealWater: "medium", daysToGermination: [7, 14], daysToMaturity: [55, 70], harvestWindowDays: [60, 90], spacingInches: 4, yieldPerSquareFoot: 0.45, yieldUnit: "lb", expectedPricePerUnit: 4, failureRate: 0.08, waterGallonsPerSqFtWeek: 0.65 },
    mushroom: { idealSoilTypes: ["wood-chip"], idealSun: "shade", idealWater: "medium", daysToGermination: [14, 30], daysToMaturity: [45, 90], harvestWindowDays: [60, 150], spacingInches: 8, yieldPerSquareFoot: 0.65, yieldUnit: "lb", expectedPricePerUnit: 8, failureRate: 0.12, waterGallonsPerSqFtWeek: 1.1 },
    herb: { idealSoilTypes: ["lean soil"], idealSun: "full", idealWater: "low", daysToGermination: [7, 21], daysToMaturity: [45, 70], harvestWindowDays: [50, 160], spacingInches: 8, yieldPerSquareFoot: 0.35, yieldUnit: "bunch", expectedPricePerUnit: 3, failureRate: 0.04, waterGallonsPerSqFtWeek: 0.35 },
    pollinator: { idealSoilTypes: ["native soil"], idealSun: "partial", idealWater: "low", daysToGermination: [7, 21], daysToMaturity: [60, 90], harvestWindowDays: [75, 180], spacingInches: 10, yieldPerSquareFoot: 0, yieldUnit: "bunch", expectedPricePerUnit: 0, failureRate: 0.03, waterGallonsPerSqFtWeek: 0.25 },
  };

  return profiles[tileType] ?? profiles.herb;
}

function defaultLivestockProfile(tileType: PlanTileType) {
  return tileType === "goat"
    ? { species: "Goat", feedCostPerHeadWeek: 8, milkGallonsPerHeadWeek: 2.2, expectedPricePerMilkGallon: 10, spaceSquareFeetPerHead: 32, waterGallonsPerHeadWeek: 14 }
    : { species: "Chicken", feedCostPerHeadWeek: 1.8, eggsPerHeadWeek: 5, expectedPricePerEggDozen: 7, spaceSquareFeetPerHead: 8, waterGallonsPerHeadWeek: 1.8 };
}

function soilStrategyFor(tileType: PlanTileType, weatherProfile: FarmPlannerInput["weatherProfile"]) {
  if (tileType === "mushroom") return "Shaded wood-chip bed with stable moisture";
  if (tileType === "herb") return weatherProfile === "dry" ? "Lean soil, gravelly mulch, and drip line" : "Lean soil and frequent clipping";
  if (tileType === "pollinator") return "Native soil, leaf mulch, and no-till edges";
  if (tileType === "potato") return "Loose soil, deep mulch, and steady hilling";
  return weatherProfile === "wet" ? "Raised compost mounds with airy spacing" : "Compost-rich loam with straw mulch";
}

function iconFor(tileType: PlanTileType) {
  const icons: Partial<Record<PlanTileType, string>> = {
    tomato: "tomato.png",
    lettuce: "lettuce.png",
    corn: "corn.png",
    potato: "potato.png",
    strawberry: "strawberry.png",
    pea: "pea-pod.png",
    mushroom: "mushroom.png",
    herb: "lettuce.png",
    pollinator: "strawberry.png",
    chicken: "egg.png",
    goat: "hammer.png",
    storage: "hammer.png",
    greenhouse: "hammer.png",
    compost: "hammer.png",
    path: "hammer.png",
  };

  return `${iconPath}${icons[tileType] ?? "seed-packet.png"}`;
}

function adjustWaterNeed(waterNeed: PlanTile["waterNeed"], weatherProfile: FarmPlannerInput["weatherProfile"]) {
  if (weatherProfile !== "dry" || waterNeed === "high") return waterNeed;
  return waterNeed === "medium" ? "high" : "medium";
}

function weatherLabel(weatherProfile: FarmPlannerInput["weatherProfile"]) {
  return `${weatherProfile} small-farm weather`;
}

function yearlyRainfall(weatherProfile: FarmPlannerInput["weatherProfile"]) {
  return weatherProfile === "dry" ? 19 : weatherProfile === "wet" ? 48 : weatherProfile === "cold" ? 34 : 28;
}

function weatherHighlight(weatherProfile: FarmPlannerInput["weatherProfile"]) {
  switch (weatherProfile) {
    case "dry":
      return "Dry-weather logic warns high-water crops and pushes storage, mulch, and lower-water plantings.";
    case "wet":
      return "Wet-weather logic favors raised crop blocks and protected structures.";
    case "cold":
      return "Cold-weather logic favors protected starts, cool-season crops, and tighter animal shelter.";
    default:
      return "Temperate-weather logic balances crop revenue, animal outputs, storage, and water demand.";
  }
}

function scorePlan(input: FarmPlannerInput, tiles: PlanTile[], objects: Omit<PlanObject, "sourceId">[]) {
  const diversity = new Set(tiles.map((tile) => tile.tileType)).size / 14;
  const objectCoverage = new Set(objects.map((object) => object.type)).size / 3;
  const climateFit = input.weatherProfile === "temperate" ? 0.87 : 0.84;
  return Number(Math.min(0.98, climateFit * 0.4 + diversity * 0.3 + objectCoverage * 0.3).toFixed(2));
}

function totalCosts(costs: Array<CostBreakdown | undefined>) {
  const total = costs.reduce<CostBreakdown & { total: number }>(
    (acc, cost) => {
      if (!cost) return acc;
      Object.entries(cost).forEach(([key, value]) => {
        if (typeof value === "number") {
          const costKey = key as keyof CostBreakdown;
          acc[costKey] = Number(((acc[costKey] ?? 0) + value).toFixed(2));
          acc.total = Number((acc.total + value).toFixed(2));
        }
      });
      return acc;
    },
    { total: 0 },
  );

  return total;
}

function scaleCost(cost: CostBreakdown | undefined, multiplier: number) {
  if (!cost) return undefined;
  return Object.fromEntries(Object.entries(cost).map(([key, value]) => [key, typeof value === "number" ? Number((value * multiplier).toFixed(2)) : value])) as CostBreakdown;
}

function periodToCost(cost: CostBreakdown | undefined, total: number) {
  if (!cost) return { other: total };
  const existing = sumCosts(cost);
  return existing ? scaleCost(cost, total / existing) : { other: total };
}

function sumCosts(cost: CostBreakdown | undefined) {
  return sum(Object.values(cost ?? {}).filter((value): value is number => typeof value === "number"));
}

function recurringFromWeekly(weekly: number) {
  return {
    weekly: Number(weekly.toFixed(2)),
    monthly: Number((weekly * 4.345).toFixed(2)),
    yearly: Number((weekly * 52).toFixed(2)),
  };
}

function revenueFromWeekly(weekly: number): RevenueMetrics {
  return {
    weekly: Number(weekly.toFixed(2)),
    monthly: Number((weekly * 4.345).toFixed(2)),
    yearly: Number((weekly * 52).toFixed(2)),
  };
}

function revenueFromMonthly(monthly: number, areaSquareFeet = 0, plantCount = 0): RevenueMetrics {
  return {
    weekly: Number((monthly / 4.345).toFixed(2)),
    monthly: Number(monthly.toFixed(2)),
    yearly: Number((monthly * 12).toFixed(2)),
    perSquareFoot: areaSquareFeet ? Number((monthly / areaSquareFeet).toFixed(2)) : undefined,
    perPlant: plantCount ? Number((monthly / plantCount).toFixed(2)) : undefined,
    totalPlot: Number(monthly.toFixed(2)),
  };
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
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

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
