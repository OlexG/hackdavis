import type {
  FarmObjectType,
  GeometryPoint,
  ObjectSize,
  PlanObject,
  PlanTile,
  PlanTileType,
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
    areaSquareFeet: number;
  };
  tiles: PlanTile[];
  partitions: [];
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

type TileTemplate = {
  tileType: PlanTileType;
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

type CandidateCell = {
  gridX: number;
  gridY: number;
  normalized: GeometryPoint;
  position: {
    x: number;
    z: number;
  };
  edgeDistance: number;
  centroidDistance: number;
};

const fallbackQuad: GeometryPoint[] = [
  { x: 16, y: 18 },
  { x: 84, y: 16 },
  { x: 88, y: 78 },
  { x: 12, y: 82 },
];

const iconPath = "/inventory-icons/";

const palette = {
  tomato: "#6e9f45",
  lettuce: "#7ec65b",
  corn: "#d5b84b",
  potato: "#9b7a4b",
  strawberry: "#5f9d58",
  pea: "#66ad63",
  mushroom: "#b99067",
  herb: "#3f8b58",
  pollinator: "#9bb75d",
};

export function generateHomesteadPlan(
  input: FarmPlannerInput,
  catalog: FarmPlannerCatalogItem[],
): GeneratedFarmPlan {
  const points = normalizePoints(input.points);
  const centroid = getCentroid(points);
  const rawSquareFeet = estimateAreaSquareFeet(points);
  const areaSquareFeet = Math.max(16, Math.round(rawSquareFeet));
  const areaSquareMeters = Math.max(1, Math.round(areaSquareFeet / 10.7639));
  const random = createSeededRandom(`${input.locationLabel}:${input.weatherProfile}:${input.strategy}:${Date.now()}`);
  const templates = normalizeRatios(getTileTemplates(input));
  const tiles = createPlanTiles(points, areaSquareFeet, templates, random);
  const tileBounds = tileBoundsFor(tiles);
  const objects = createPlanObjects(tiles, catalog);

  return {
    name: `Voxel Plan - ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`,
    bounds: {
      width: Math.max(8, tileBounds.width),
      depth: Math.max(8, tileBounds.depth),
      height: 4,
    },
    baseGeometry: {
      source: "satellite-drawn",
      locationLabel: input.locationLabel.trim() || "Drawn homestead site",
      points,
      centroid,
      areaSquareMeters,
      areaSquareFeet: tiles.length,
    },
    tiles,
    partitions: [],
    objects,
    summary: {
      description: `A ${tiles.length.toLocaleString("en-US")} sq ft voxel farm plan for ${input.locationLabel.trim() || "the selected site"}.`,
      highlights: [
        "The drawn satellite shape is rasterized into one-foot plant tiles.",
        "Every tile stores a plant type, icon, color, grid coordinate, and 1 sq ft area.",
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
      prompt: `Rasterize drawn homestead geometry for ${input.locationLabel} into one-foot plant tiles using ${input.weatherProfile} weather and ${input.strategy} goals.`,
      constraints: {
        weatherProfile: input.weatherProfile,
        locationLabel: input.locationLabel,
        basePointCount: points.length,
        tileSizeFeet: 1,
        tileGeometry: "voxel-grid",
        tileCount: tiles.length,
      },
      score: scorePlan(input, tiles),
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

function getTileTemplates(input: FarmPlannerInput): TileTemplate[] {
  const foodBias = input.strategy === "food" ? 0.1 : 0;
  const lowCareBias = input.strategy === "low-maintenance" ? 0.08 : 0;
  const dryBias = input.weatherProfile === "dry" ? 0.08 : 0;

  return [
    {
      tileType: "tomato",
      slug: "tomatoes",
      assignmentName: "Tomatoes",
      ratio: 0.18 + foodBias,
      color: palette.tomato,
      iconPath: `${iconPath}tomato.png`,
      sunExposure: "full",
      waterNeed: "high",
      soilStrategy: input.weatherProfile === "wet" ? "Raised compost mounds with airy spacing" : "Compost-rich soil with straw mulch",
      notes: "Warm-season fruiting tile for trellised annual beds.",
    },
    {
      tileType: "lettuce",
      slug: "lettuce",
      assignmentName: "Lettuce",
      ratio: 0.14,
      color: palette.lettuce,
      iconPath: `${iconPath}lettuce.png`,
      sunExposure: input.weatherProfile === "dry" ? "partial" : "full",
      waterNeed: adjustWaterNeed("medium", input.weatherProfile),
      soilStrategy: "Even moisture, fine compost, and light afternoon shade",
      notes: "Leafy green tile for quick harvest rotations.",
    },
    {
      tileType: "corn",
      slug: "corn",
      assignmentName: "Corn",
      ratio: 0.13 + foodBias,
      color: palette.corn,
      iconPath: `${iconPath}corn.png`,
      sunExposure: "full",
      waterNeed: adjustWaterNeed("medium", input.weatherProfile),
      soilStrategy: "Block-planted rich soil with wind-aware spacing",
      notes: "Tall grain tile clustered for pollination.",
    },
    {
      tileType: "potato",
      slug: "potatoes",
      assignmentName: "Potatoes",
      ratio: 0.12 + foodBias,
      color: palette.potato,
      iconPath: `${iconPath}potato.png`,
      sunExposure: "full",
      waterNeed: "medium",
      soilStrategy: "Loose soil, deep mulch, and steady hilling",
      notes: "Root crop tile for calorie-dense production.",
    },
    {
      tileType: "strawberry",
      slug: "strawberries",
      assignmentName: "Strawberries",
      ratio: 0.11 + lowCareBias,
      color: palette.strawberry,
      iconPath: `${iconPath}strawberry.png`,
      sunExposure: "full",
      waterNeed: "medium",
      soilStrategy: "Perennial mulch with drip irrigation",
      notes: "Low-growing perennial fruit tile.",
    },
    {
      tileType: "pea",
      slug: "peas",
      assignmentName: "Peas",
      ratio: 0.1,
      color: palette.pea,
      iconPath: `${iconPath}pea-pod.png`,
      sunExposure: input.weatherProfile === "dry" ? "partial" : "full",
      waterNeed: "medium",
      soilStrategy: "Cool-season trellis with inoculated soil",
      notes: "Nitrogen-fixing vine tile.",
    },
    {
      tileType: "mushroom",
      slug: "mushrooms",
      assignmentName: "Mushrooms",
      ratio: input.weatherProfile === "dry" ? 0.05 : 0.09,
      color: palette.mushroom,
      iconPath: `${iconPath}mushroom.png`,
      sunExposure: "shade",
      waterNeed: input.weatherProfile === "dry" ? "high" : "medium",
      soilStrategy: "Shaded wood-chip bed with stable moisture",
      notes: "Shade crop tile for damp edges.",
    },
    {
      tileType: "herb",
      slug: "herbs",
      assignmentName: "Herbs",
      ratio: 0.11 + dryBias,
      color: palette.herb,
      iconPath: `${iconPath}lettuce.png`,
      sunExposure: "full",
      waterNeed: input.weatherProfile === "dry" ? "low" : "medium",
      soilStrategy: "Lean soil, gravelly mulch, and frequent clipping",
      notes: "Culinary and pollinator herb tile.",
    },
    {
      tileType: "pollinator",
      slug: "pollinator-flowers",
      assignmentName: "Pollinator Flowers",
      ratio: 0.1 + lowCareBias,
      color: palette.pollinator,
      iconPath: `${iconPath}strawberry.png`,
      sunExposure: "partial",
      waterNeed: "low",
      soilStrategy: "Native flowers, leaf mulch, and no-till edges",
      notes: "Habitat tile for beneficial insects and seasonal resilience.",
    },
  ];
}

function normalizeRatios(templates: TileTemplate[]) {
  const total = templates.reduce((sum, template) => sum + template.ratio, 0);
  return templates.map((template) => ({ ...template, ratio: template.ratio / total }));
}

function createPlanTiles(
  polygon: GeometryPoint[],
  tileCount: number,
  templates: TileTemplate[],
  random: () => number,
) {
  const candidates = createCandidateCells(polygon, tileCount, random);
  const centers = createTemplateCenters(candidates, templates, random);
  const targets = createTemplateTargets(tileCount, templates);

  const assignedCounts = new Map<PlanTileType, number>();
  const sortedCandidates = [...candidates].sort((left, right) => left.centroidDistance - right.centroidDistance);

  return sortedCandidates
    .map((candidate, index) => {
      const template = chooseTemplate(candidate, centers, targets, assignedCounts);
      const tileIndex = (assignedCounts.get(template.tileType) ?? 0) + 1;
      assignedCounts.set(template.tileType, tileIndex);

      return {
        tileId: `tile_${index + 1}_${template.tileType}`,
        tileType: template.tileType,
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
        notes: template.notes,
      } satisfies PlanTile;
    })
    .sort((left, right) => left.grid.y - right.grid.y || left.grid.x - right.grid.x);
}

function createCandidateCells(
  polygon: GeometryPoint[],
  tileCount: number,
  random: () => number,
): CandidateCell[] {
  const bounds = boundsFor(polygon);
  const width = Math.max(1, bounds.maxX - bounds.minX);
  const height = Math.max(1, bounds.maxY - bounds.minY);
  const normalizedArea = Math.max(1, shoelaceArea(polygon));
  let scale = Math.sqrt(tileCount / normalizedArea);
  let candidates: CandidateCell[] = [];

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const columns = Math.max(1, Math.ceil(width * scale));
    const rows = Math.max(1, Math.ceil(height * scale));
    candidates = rasterizePolygon(polygon, bounds, columns, rows);

    if (candidates.length >= tileCount) {
      break;
    }

    scale *= 1.08;
  }

  if (candidates.length > tileCount) {
    return candidates
      .map((cell) => ({ cell, score: cell.edgeDistance + random() * 0.12 }))
      .sort((left, right) => {
        return right.score - left.score;
      })
      .map(({ cell }) => cell)
      .slice(0, tileCount);
  }

  if (candidates.length < tileCount) {
    const needed = tileCount - candidates.length;
    const expanded = createNearBoundaryCells(polygon, bounds, candidates, needed);
    return [...candidates, ...expanded].slice(0, tileCount);
  }

  return candidates;
}

function rasterizePolygon(
  polygon: GeometryPoint[],
  bounds: ReturnType<typeof boundsFor>,
  columns: number,
  rows: number,
) {
  const cells: CandidateCell[] = [];
  const stepX = Math.max(0.000001, (bounds.maxX - bounds.minX) / columns);
  const stepY = Math.max(0.000001, (bounds.maxY - bounds.minY) / rows);
  const centroid = getCentroid(polygon);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const normalized = {
        x: Number((bounds.minX + (x + 0.5) * stepX).toFixed(4)),
        y: Number((bounds.minY + (y + 0.5) * stepY).toFixed(4)),
      };

      if (!pointInPolygon(normalized, polygon)) {
        continue;
      }

      cells.push({
        gridX: x,
        gridY: y,
        normalized,
        position: {
          x: Number((x - (columns - 1) / 2).toFixed(2)),
          z: Number((y - (rows - 1) / 2).toFixed(2)),
        },
        edgeDistance: distanceToPolygonEdge(normalized, polygon),
        centroidDistance: Math.hypot(normalized.x - centroid.x, normalized.y - centroid.y),
      });
    }
  }

  return cells;
}

function createNearBoundaryCells(
  polygon: GeometryPoint[],
  bounds: ReturnType<typeof boundsFor>,
  existing: CandidateCell[],
  needed: number,
) {
  const existingKeys = new Set(existing.map((cell) => `${cell.gridX}:${cell.gridY}`));
  const maxX = Math.max(...existing.map((cell) => cell.gridX), 1);
  const maxY = Math.max(...existing.map((cell) => cell.gridY), 1);
  const columns = maxX + 1;
  const rows = maxY + 1;
  const stepX = Math.max(0.000001, (bounds.maxX - bounds.minX) / columns);
  const stepY = Math.max(0.000001, (bounds.maxY - bounds.minY) / rows);
  const centroid = getCentroid(polygon);
  const extras: CandidateCell[] = [];

  for (let y = -1; y <= rows; y += 1) {
    for (let x = -1; x <= columns; x += 1) {
      const key = `${x}:${y}`;

      if (existingKeys.has(key)) {
        continue;
      }

      const normalized = {
        x: Number((bounds.minX + (x + 0.5) * stepX).toFixed(4)),
        y: Number((bounds.minY + (y + 0.5) * stepY).toFixed(4)),
      };

      extras.push({
        gridX: x,
        gridY: y,
        normalized,
        position: {
          x: Number((x - (columns - 1) / 2).toFixed(2)),
          z: Number((y - (rows - 1) / 2).toFixed(2)),
        },
        edgeDistance: -distanceToPolygonEdge(normalized, polygon),
        centroidDistance: Math.hypot(normalized.x - centroid.x, normalized.y - centroid.y),
      });
    }
  }

  return extras
    .sort((left, right) => right.edgeDistance - left.edgeDistance || left.centroidDistance - right.centroidDistance)
    .slice(0, needed);
}

function createTemplateCenters(
  candidates: CandidateCell[],
  templates: TileTemplate[],
  random: () => number,
) {
  const sorted = [...candidates].sort((left, right) => left.position.x - right.position.x);
  const stride = Math.max(1, Math.floor(sorted.length / templates.length));

  return templates.map((template, index) => {
    const cell = sorted[Math.min(sorted.length - 1, index * stride + Math.floor(random() * stride))] ?? sorted[0];

    return {
      template,
      x: cell?.position.x ?? 0,
      z: cell?.position.z ?? 0,
    };
  });
}

function createTemplateTargets(tileCount: number, templates: TileTemplate[]) {
  const targets = new Map<PlanTileType, number>();
  const rawTargets = templates.map((template) => {
    const raw = tileCount * template.ratio;

    return {
      template,
      count: Math.floor(raw),
      remainder: raw % 1,
    };
  });
  let assigned = rawTargets.reduce((sum, target) => sum + target.count, 0);

  [...rawTargets]
    .sort((left, right) => right.remainder - left.remainder)
    .forEach((target) => {
      if (assigned < tileCount) {
        target.count += 1;
        assigned += 1;
      }
    });

  rawTargets.forEach(({ template, count }) => {
    targets.set(template.tileType, count);
  });

  return targets;
}

function chooseTemplate(
  candidate: CandidateCell,
  centers: ReturnType<typeof createTemplateCenters>,
  targets: Map<PlanTileType, number>,
  assignedCounts: Map<PlanTileType, number>,
) {
  const available = centers.filter(({ template }) => (assignedCounts.get(template.tileType) ?? 0) < (targets.get(template.tileType) ?? 0));
  const pool = available.length ? available : centers;
  const closest = pool.reduce((best, center) => {
    const distance = Math.hypot(candidate.position.x - center.x, candidate.position.z - center.z);
    return distance < best.distance ? { center, distance } : best;
  }, { center: pool[0], distance: Number.POSITIVE_INFINITY });

  return closest.center.template;
}

function createPlanObjects(tiles: PlanTile[], catalog: FarmPlannerCatalogItem[]) {
  const grouped = new Map<PlanTileType, PlanTile[]>();

  tiles.forEach((tile) => {
    grouped.set(tile.tileType, [...(grouped.get(tile.tileType) ?? []), tile]);
  });

  return [...grouped.entries()].map(([tileType, tileGroup]) => {
    const first = tileGroup[0];
    const catalogItem = catalog.find((item) => item.slug === first.assignmentSlug);
    const center = tileGroup.reduce(
      (sum, tile) => ({ x: sum.x + tile.position.x, z: sum.z + tile.position.z }),
      { x: 0, z: 0 },
    );
    const width = Math.max(1, Math.sqrt(tileGroup.length));

    return {
      instanceId: `${tileType}_${tileGroup.length}_tiles`,
      type: "crop" as const,
      slug: first.assignmentSlug,
      displayName: `${first.assignmentName} Tiles`,
      status: "planned" as const,
      plantedAtDay: 0,
      position: {
        x: Number((center.x / tileGroup.length).toFixed(2)),
        y: 0,
        z: Number((center.z / tileGroup.length).toFixed(2)),
      },
      rotation: { x: 0, y: 0, z: 0 },
      size: {
        width: Number(width.toFixed(1)),
        depth: Number(Math.max(1, tileGroup.length / width).toFixed(1)),
        height: catalogItem?.defaultSize.height ?? 1,
      },
      renderOverrides: {
        ...(catalogItem?.render ?? {}),
        color: first.color,
        label: first.assignmentName,
        iconPath: first.iconPath,
      },
      notes: `${tileGroup.length.toLocaleString("en-US")} one-foot ${first.assignmentName.toLowerCase()} tiles.`,
    } satisfies Omit<PlanObject, "sourceId">;
  });
}

function estimateAreaSquareFeet(points: GeometryPoint[]) {
  const latLngPoints = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

  if (latLngPoints.length === points.length) {
    const originLat = latLngPoints.reduce((sum, point) => sum + (point.lat ?? 0), 0) / latLngPoints.length;
    const originLng = latLngPoints.reduce((sum, point) => sum + (point.lng ?? 0), 0) / latLngPoints.length;
    const projected = latLngPoints.map((point) => latLngToFeet(point.lat ?? originLat, point.lng ?? originLng, originLat, originLng));

    return shoelaceArea(projected);
  }

  return shoelaceArea(points) * 2.6;
}

function latLngToFeet(lat: number, lng: number, originLat: number, originLng: number) {
  const metersPerDegreeLat = 111_132.92 - 559.82 * Math.cos(2 * toRadians(originLat)) + 1.175 * Math.cos(4 * toRadians(originLat));
  const metersPerDegreeLng = 111_412.84 * Math.cos(toRadians(originLat)) - 93.5 * Math.cos(3 * toRadians(originLat));

  return {
    x: (lng - originLng) * metersPerDegreeLng * 3.28084,
    y: (lat - originLat) * metersPerDegreeLat * 3.28084,
  };
}

function pointInPolygon(point: GeometryPoint, polygon: GeometryPoint[]) {
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

function distanceToPolygonEdge(point: GeometryPoint, polygon: GeometryPoint[]) {
  return polygon.reduce((best, current, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return Math.min(best, distanceToSegment(point, current, next));
  }, Number.POSITIVE_INFINITY);
}

function distanceToSegment(point: GeometryPoint, a: GeometryPoint, b: GeometryPoint) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;

  if (!lengthSquared) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }

  const ratio = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared, 0, 1);
  const x = a.x + ratio * dx;
  const y = a.y + ratio * dy;

  return Math.hypot(point.x - x, point.y - y);
}

function tileBoundsFor(tiles: PlanTile[]) {
  if (!tiles.length) {
    return { width: 8, depth: 8 };
  }

  const minX = Math.min(...tiles.map((tile) => tile.position.x));
  const maxX = Math.max(...tiles.map((tile) => tile.position.x));
  const minZ = Math.min(...tiles.map((tile) => tile.position.z));
  const maxZ = Math.max(...tiles.map((tile) => tile.position.z));

  return {
    width: Math.ceil(maxX - minX + 1),
    depth: Math.ceil(maxZ - minZ + 1),
  };
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

function shoelaceArea(points: { x: number; y: number }[]) {
  return Math.abs(
    points.reduce((sum, point, index) => {
      const next = points[(index + 1) % points.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0) / 2,
  );
}

function adjustWaterNeed(
  waterNeed: PlanTile["waterNeed"],
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
      return "Dry-weather logic favors mulch, herbs, and lower-water pollinator blocks.";
    case "wet":
      return "Wet-weather logic favors raised plant blocks and overflow-tolerant edges.";
    case "cold":
      return "Cold-weather logic keeps cool-season tiles prominent and clusters warm crops tightly.";
    default:
      return "Temperate-weather logic balances fruiting crops, greens, roots, herbs, and habitat.";
  }
}

function scorePlan(input: FarmPlannerInput, tiles: PlanTile[]) {
  const diversity = new Set(tiles.map((tile) => tile.tileType)).size / 9;
  const climateFit = input.weatherProfile === "temperate" ? 0.85 : 0.88;
  const goalFit = input.strategy === "balanced" ? 0.88 : 0.84;

  return Number(Math.min(0.98, climateFit * 0.42 + goalFit * 0.34 + diversity * 0.24).toFixed(2));
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
