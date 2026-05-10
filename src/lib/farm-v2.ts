import type {
  FarmV2Commit,
  FarmV2Object,
  FarmV2Plan,
  GeoPoint,
  LocalPoint,
} from "./models";

export type FarmV2SetupMode = "manual" | "deterministic-draft";

export type FarmV2InventoryNeed = {
  name: string;
  category: "seeds" | "feed" | "tools";
  quantity: {
    amount: number;
    unit: string;
  };
  reason: string;
  location: string;
};

export type FarmV2CatalogCrop = {
  key: string;
  name: string;
  visual: string;
  defaultCount: number;
  growth: number;
};

export const farmV2Catalog = {
  crops: [
    { key: "tomato", name: "Tomato", visual: "fruiting", defaultCount: 16, growth: 0.62 },
    { key: "corn", name: "Corn", visual: "grain", defaultCount: 18, growth: 0.58 },
    { key: "lettuce", name: "Lettuce", visual: "leafy", defaultCount: 24, growth: 0.7 },
    { key: "basil", name: "Basil", visual: "herb", defaultCount: 20, growth: 0.64 },
    { key: "pepper", name: "Pepper", visual: "fruiting", defaultCount: 14, growth: 0.55 },
    { key: "potato", name: "Potato", visual: "mound", defaultCount: 22, growth: 0.48 },
    { key: "squash", name: "Squash", visual: "vine", defaultCount: 8, growth: 0.58 },
    { key: "carrot", name: "Carrot", visual: "root", defaultCount: 36, growth: 0.52 },
    { key: "strawberry", name: "Strawberry", visual: "groundcover", defaultCount: 28, growth: 0.66 },
    { key: "wheat", name: "Wheat", visual: "grain", defaultCount: 48, growth: 0.72 },
  ],
  livestock: [
    { key: "chicken", name: "Chicken", breed: "Rhode Island Red", breeds: ["Rhode Island Red", "Leghorn", "Plymouth Rock"], defaultCount: 12 },
    { key: "goat", name: "Goat", breed: "Nigerian Dwarf", breeds: ["Nigerian Dwarf", "Boer", "Alpine"], defaultCount: 4 },
    { key: "sheep", name: "Sheep", breed: "Dorper", breeds: ["Dorper", "Katahdin", "Merino"], defaultCount: 6 },
    { key: "duck", name: "Duck", breed: "Khaki Campbell", breeds: ["Khaki Campbell", "Pekin", "Runner"], defaultCount: 8 },
  ],
  structures: [
    { key: "barn", name: "Barn", material: "Timber frame", height: 8.6 },
    { key: "shed", name: "Shed", material: "Cedar siding", height: 5.8 },
    { key: "greenhouse", name: "Greenhouse", material: "Polycarbonate", height: 6.6 },
    { key: "coop", name: "Coop", material: "Pine", height: 4.2 },
    { key: "storage", name: "Storage Unit", material: "Timber", height: 5.2 },
  ],
};

export const defaultFarmV2Boundary: LocalPoint[] = [
  [0, 0],
  [108, 0],
  [108, 82],
  [0, 82],
];

export const demoFarmV2GeoBoundary: GeoPoint[] = [
  [-121.7471, 38.5484],
  [-121.7354, 38.5488],
  [-121.7334, 38.5407],
  [-121.7462, 38.5399],
];

export function createFarmV2PlanSeed({
  mode,
  boundaryGeo,
  boundaryLocal,
  now,
}: {
  mode: FarmV2SetupMode;
  boundaryGeo: GeoPoint[] | null;
  boundaryLocal?: LocalPoint[];
  now: Date;
}): Omit<FarmV2Plan, "_id" | "farmId" | "userId"> {
  const local = sanitizeLocalPoints(
    boundaryLocal?.length ? boundaryLocal : boundaryGeo?.length ? geoPolygonToLocal(boundaryGeo) : defaultFarmV2Boundary,
  );
  const objects = mode === "manual" ? [] : createDeterministicDraftObjects(local);
  const commitName = mode === "manual" ? "Boundary saved" : "AI draft preset";
  const commit = createFarmV2Commit(commitName, objects, now);
  const area = Math.round(polygonArea(local));

  return {
    schema: "farmv2",
    version: 8,
    name: `${mode === "manual" ? "Manual" : "Generated"} Farmv2 Plan - ${now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })}`,
    status: "draft",
    units: "ft",
    view: "grid",
    selectedId: objects[0]?.id ?? null,
    camera: {
      zoom: 1,
      panX: 0,
      panY: -18,
      rotation: 0,
    },
    boundary: {
      source: boundaryGeo?.length ? "map" : "demo",
      geo: boundaryGeo?.length ? sanitizeGeoPoints(boundaryGeo) : null,
      local,
      areaSquareFeet: area,
    },
    objects,
    commits: [commit],
    commitIndex: 0,
    summary: {
      description:
        mode === "manual"
          ? "A saved Farmv2 boundary ready for manual crop areas, fields, paddocks, structures, and paths."
          : "A deterministic Farmv2 draft with crop areas, crop fields, livestock, structures, paths, and timeline state.",
      highlights:
        mode === "manual"
          ? ["Boundary saved as local planning coordinates.", "Manual drawing starts with an empty object layer."]
          : ["Draft objects are scaled to the saved boundary.", "Timeline starts with a generated recommendation snapshot."],
      maintenanceLevel: mode === "manual" ? "medium" : "high",
    },
    generation: {
      mode,
      strategy: mode === "manual" ? "manual-boundary" : "deterministic-farmv2-draft",
      prompt:
        mode === "manual"
          ? "Save the drawn boundary for manual Farmv2 planning."
          : "Create a deterministic Farmv2 farm draft using the built-in demo object recipe scaled to the boundary.",
      constraints: {
        coordinateType: "LocalPoint tuple [x,y]",
        boundaryPointCount: local.length,
        generatedObjectCount: objects.length,
      },
      score: mode === "manual" ? 0.5 : 0.82,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function createFarmV2Commit(name: string, objects: FarmV2Object[], now = new Date()): FarmV2Commit {
  const autoName = `Farm snapshot - ${now.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;

  return {
    id: `commit-${now.getTime()}`,
    timestamp: now,
    name: name.trim() || autoName,
    autoName,
    objects: cloneFarmV2Objects(objects),
  };
}

export function createDeterministicDraftObjects(boundary: LocalPoint[]): FarmV2Object[] {
  return scaleObjects([...initialFarmV2Objects, ...southRotationObjects], defaultFarmV2Boundary, boundary);
}

export function geoPolygonToLocal(points: GeoPoint[]): LocalPoint[] {
  const closed = sanitizeGeoPoints(points);

  if (closed.length < 3) {
    return cloneLocalPoints(defaultFarmV2Boundary);
  }

  const lngs = closed.map((point) => point[0]);
  const lats = closed.map((point) => point[1]);
  const minLng = Math.min(...lngs);
  const maxLat = Math.max(...lats);
  const minLat = Math.min(...lats);
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const feetPerDegreeLat = 364000;
  const feetPerDegreeLng = Math.max(1, feetPerDegreeLat * Math.cos(midLat));
  const projected = closed.map<LocalPoint>((point) => [
    (point[0] - minLng) * feetPerDegreeLng,
    (maxLat - point[1]) * feetPerDegreeLat,
  ]);
  const bbox = getBBox(projected);

  return projected.map<LocalPoint>((point) => [
    roundPoint(point[0] - bbox.minX),
    roundPoint(point[1] - bbox.minY),
  ]);
}

export function polygonArea(poly: LocalPoint[]) {
  let total = 0;
  for (let index = 0; index < poly.length; index += 1) {
    const current = poly[index];
    const next = poly[(index + 1) % poly.length];
    total += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(total / 2);
}

export function polygonCentroid(poly: LocalPoint[]): LocalPoint {
  const total = poly.reduce<LocalPoint>((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);
  return [total[0] / Math.max(1, poly.length), total[1] / Math.max(1, poly.length)];
}

export function pointInPolygon(point: LocalPoint, poly: LocalPoint[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersects = yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function getBBox(poly: LocalPoint[]) {
  return poly.reduce(
    (box, point) => ({
      minX: Math.min(box.minX, point[0]),
      maxX: Math.max(box.maxX, point[0]),
      minY: Math.min(box.minY, point[1]),
      maxY: Math.max(box.maxY, point[1]),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
}

export function distance(a: LocalPoint, b: LocalPoint) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function rotatePoint(point: LocalPoint, center: LocalPoint, degrees: number): LocalPoint {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point[0] - center[0];
  const dy = point[1] - center[1];
  return [center[0] + dx * cos - dy * sin, center[1] + dx * sin + dy * cos];
}

export function snapPoint(point: LocalPoint): LocalPoint {
  return [Math.round(point[0] * 2) / 2, Math.round(point[1] * 2) / 2];
}

export function cloneFarmV2Objects(objects: FarmV2Object[]) {
  return JSON.parse(JSON.stringify(objects)) as FarmV2Object[];
}

export function sanitizeFarmV2Objects(value: unknown): FarmV2Object[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeFarmV2Object).filter((object): object is FarmV2Object => Boolean(object));
}

export function sanitizeLocalPoints(value: unknown): LocalPoint[] {
  if (!Array.isArray(value)) return cloneLocalPoints(defaultFarmV2Boundary);
  const points = value
    .map((point) => {
      if (Array.isArray(point)) {
        return toLocalPoint(point[0], point[1]);
      }
      if (point && typeof point === "object") {
        const objectPoint = point as { x?: unknown; y?: unknown };
        return toLocalPoint(objectPoint.x, objectPoint.y);
      }
      return null;
    })
    .filter((point): point is LocalPoint => Boolean(point))
    .slice(0, 32);
  return points.length >= 3 ? points : cloneLocalPoints(defaultFarmV2Boundary);
}

export function sanitizeGeoPoints(value: unknown): GeoPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((point) => {
      if (Array.isArray(point)) {
        const lng = Number(point[0]);
        const lat = Number(point[1]);
        return Number.isFinite(lng) && Number.isFinite(lat) ? ([lng, lat] satisfies GeoPoint) : null;
      }
      return null;
    })
    .filter((point): point is GeoPoint => Boolean(point))
    .slice(0, 32);
}

export function farmv2ToInventoryInputs(plan: FarmV2Plan): FarmV2InventoryNeed[] {
  return plan.objects.reduce<FarmV2InventoryNeed[]>((items, object) => {
    if (object.type === "cropField" && object.attrs.cropKey) {
      items.push({
        name: `${object.attrs.cropName || object.attrs.cropKey} seed`,
        category: "seeds" as const,
        quantity: { amount: Math.max(1, Math.round(Number(object.attrs.count) || 12)), unit: "seeds" },
        reason: `${object.label} is in the latest Farmv2 plan.`,
        location: object.label,
      });
      return items;
    }

    if (object.type === "livestock") {
      items.push({
        name: `${object.attrs.species} feed`,
        category: "feed" as const,
        quantity: { amount: Math.max(1, Number(object.attrs.count) * 5), unit: "lb" },
        reason: `${object.label} has ${object.attrs.count} head in the latest Farmv2 plan.`,
        location: object.label,
      });
      return items;
    }

    if (object.type === "structure") {
      items.push({
        name: `${object.attrs.kind} supplies`,
        category: "tools" as const,
        quantity: { amount: 1, unit: "set" },
        reason: `${object.label} is planned as a Farmv2 structure.`,
        location: object.label,
      });
      return items;
    }

    return items;
  }, []);
}

export function summarizeFarmV2ForIntelligence(plan: FarmV2Plan) {
  const counts = plan.objects.reduce<Record<string, number>>((summary, object) => {
    summary[object.type] = (summary[object.type] ?? 0) + 1;
    return summary;
  }, {});

  return {
    schema: plan.schema,
    name: plan.name,
    status: plan.status,
    version: plan.version,
    units: plan.units,
    view: plan.view,
    boundary: {
      source: plan.boundary.source,
      pointCount: plan.boundary.local.length,
      areaSquareFeet: plan.boundary.areaSquareFeet,
    },
    objectCounts: counts,
    cropFields: plan.objects
      .filter((object): object is Extract<FarmV2Object, { type: "cropField" }> => object.type === "cropField")
      .map((object) => ({
        label: object.label,
        cropKey: object.attrs.cropKey,
        cropName: object.attrs.cropName,
        count: object.attrs.count,
        status: object.attrs.status,
      })),
    livestock: plan.objects
      .filter((object): object is Extract<FarmV2Object, { type: "livestock" }> => object.type === "livestock")
      .map((object) => ({
        label: object.label,
        species: object.attrs.species,
        breed: object.attrs.breed,
        count: object.attrs.count,
        status: object.attrs.status,
      })),
    structures: plan.objects
      .filter((object): object is Extract<FarmV2Object, { type: "structure" }> => object.type === "structure")
      .map((object) => ({
        label: object.label,
        kind: object.attrs.kind,
        material: object.attrs.material,
        status: object.attrs.status,
      })),
    timeline: {
      commitCount: plan.commits.length,
      activeCommit: plan.commits[plan.commitIndex]?.name,
    },
    summary: plan.summary,
    generation: plan.generation,
  };
}

function cropArea(id: string, label: string, polygon: LocalPoint[], attrs = {}): FarmV2Object {
  return {
    id,
    label,
    type: "cropArea",
    polygon,
    height: 0.38,
    attrs: {
      status: "Planned crop area",
      soil: "Unassigned",
      ...attrs,
    },
  };
}

function cropField(id: string, label: string, polygon: LocalPoint[], parentId: string | null, cropKey: string | null, attrs = {}): FarmV2Object {
  const crop = cropKey ? farmV2Catalog.crops.find((item) => item.key === cropKey) : null;
  return {
    id,
    label,
    type: "cropField",
    parentId,
    polygon,
    height: 0.76,
    attrs: {
      status: "Growing",
      planted: "2026-04-06",
      soil: "Sandy loam",
      rows: 5,
      cropKey: crop?.key || null,
      cropName: crop?.name || "",
      count: crop?.defaultCount || 0,
      visual: crop?.visual || "generic",
      growth: crop?.growth || 0.2,
      ...attrs,
    },
  };
}

const initialFarmV2Objects: FarmV2Object[] = [
  cropArea("north-field", "North Crop Area", [[13, 8], [63, 7], [67, 36], [15, 39]], { status: "Parent crop area", soil: "Sandy loam" }),
  cropField("tomato-slot", "Tomato Field", [[16, 11], [39, 10], [41, 31], [18, 34]], "north-field", "tomato", { status: "Vegetative growth", count: 16, growth: 0.58 }),
  cropField("corn-slot", "Corn Field", [[42, 10], [59, 10], [63, 30], [44, 31]], "north-field", "corn", { status: "Vegetative growth", count: 12, growth: 0.52 }),
  cropArea("east-garden", "East Garden", [[69, 26], [94, 25], [96, 41], [70, 43]], { status: "Parent crop area", soil: "Compost blend" }),
  cropField("basil-slot", "Basil Bed", [[72, 29], [83, 28], [84, 39], [72, 40]], "east-garden", "basil", { status: "Established", count: 22, growth: 0.66 }),
  cropField("lettuce-slot", "Lettuce Bed", [[85, 28], [93, 28], [94, 38], [85, 39]], "east-garden", "lettuce", { status: "Established", count: 18, growth: 0.74 }),
  { id: "hen-yard", label: "Hen Yard", type: "livestock", polygon: [[60, 49], [86, 45], [92, 62], [66, 68]], height: 0.55, attrs: { species: "Chicken", breed: "Rhode Island Red", count: 12, status: "Pastured" } },
  { id: "goat-run", label: "Goat Run", type: "livestock", polygon: [[10, 40], [31, 38], [39, 48], [20, 52]], height: 0.55, attrs: { species: "Goat", breed: "Nigerian Dwarf", count: 4, status: "Rotational graze" } },
  { id: "tool-shed", label: "Tool Shed", type: "structure", polygon: [[71, 13], [84, 12], [85, 23], [72, 24]], height: 5.8, attrs: { kind: "Shed", height: 5.8, material: "Cedar siding", status: "Stocked" } },
  { id: "main-barn", label: "Main Barn", type: "structure", polygon: [[20, 52], [37, 50], [42, 64], [24, 68]], height: 8.6, attrs: { kind: "Barn", height: 8.6, material: "Timber frame", status: "Ready" } },
  { id: "greenhouse", label: "Greenhouse", type: "structure", polygon: [[44, 48], [58, 46], [61, 58], [47, 61]], height: 6.6, attrs: { kind: "Greenhouse", height: 6.6, material: "Polycarbonate", status: "In use" } },
  { id: "main-path", label: "Main Path", type: "path", points: [[6, 70], [22, 62], [40, 55], [61, 50], [87, 54], [101, 62]], attrs: { status: "Primary access", material: "Packed gravel" } },
];

const southRotationObjects: FarmV2Object[] = [
  cropArea("south-rotation", "South Rotation", [[45, 62], [65, 59], [73, 74], [50, 78]], { status: "AI draft crop area", soil: "Loam" }),
  cropField("squash-slot", "Squash Patch", [[48, 64], [62, 62], [67, 73], [51, 76]], "south-rotation", "squash", { status: "AI draft", count: 8, growth: 0.42 }),
];

function scaleObjects(objects: FarmV2Object[], fromBoundary: LocalPoint[], toBoundary: LocalPoint[]) {
  const from = getBBox(fromBoundary);
  const to = getBBox(toBoundary);
  const fromWidth = Math.max(1, from.maxX - from.minX);
  const fromHeight = Math.max(1, from.maxY - from.minY);
  const toWidth = Math.max(1, to.maxX - to.minX);
  const toHeight = Math.max(1, to.maxY - to.minY);
  const scale = Math.min(toWidth / fromWidth, toHeight / fromHeight);
  const width = fromWidth * scale;
  const height = fromHeight * scale;
  const offsetX = to.minX + (toWidth - width) / 2;
  const offsetY = to.minY + (toHeight - height) / 2;
  const mapPoint = (point: LocalPoint): LocalPoint => [
    roundPoint(offsetX + (point[0] - from.minX) * scale),
    roundPoint(offsetY + (point[1] - from.minY) * scale),
  ];

  return objects.map((object) => {
    const clone = JSON.parse(JSON.stringify(object)) as FarmV2Object;
    if ("polygon" in clone) clone.polygon = clone.polygon.map(mapPoint);
    if ("points" in clone) clone.points = clone.points.map(mapPoint);
    return clone;
  });
}

function normalizeFarmV2Object(raw: unknown): FarmV2Object | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<FarmV2Object> & Record<string, unknown>;
  const id = typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim().slice(0, 120) : "";
  const label = typeof candidate.label === "string" && candidate.label.trim() ? candidate.label.trim().slice(0, 140) : "Farm object";
  const attrs = candidate.attrs && typeof candidate.attrs === "object" ? candidate.attrs as Record<string, string | number | boolean | null | undefined> : {};

  if (!id) return null;

  if (candidate.type === "path") {
    return {
      id,
      label,
      type: "path",
      points: sanitizeLocalPoints(candidate.points),
      attrs: {
        status: typeof attrs.status === "string" ? attrs.status : "Open",
        material: typeof attrs.material === "string" ? attrs.material : "Packed gravel",
      },
    };
  }

  if (candidate.type === "cropArea") {
    return {
      id,
      label,
      type: "cropArea",
      polygon: sanitizeLocalPoints(candidate.polygon),
      height: numberOr(candidate.height, 0.38),
      attrs,
    };
  }

  if (candidate.type === "cropField") {
    return {
      id,
      label,
      type: "cropField",
      parentId: typeof candidate.parentId === "string" ? candidate.parentId : null,
      polygon: sanitizeLocalPoints(candidate.polygon),
      height: numberOr(candidate.height, 0.76),
      attrs: {
        status: typeof attrs.status === "string" ? attrs.status : "Growing",
        planted: typeof attrs.planted === "string" ? attrs.planted : undefined,
        soil: typeof attrs.soil === "string" ? attrs.soil : undefined,
        rows: numberOr(attrs.rows, 5),
        cropKey: typeof attrs.cropKey === "string" ? attrs.cropKey : null,
        cropName: typeof attrs.cropName === "string" ? attrs.cropName : "",
        count: numberOr(attrs.count, 0),
        visual: typeof attrs.visual === "string" ? attrs.visual : "generic",
        growth: numberOr(attrs.growth, 0.2),
      },
    };
  }

  if (candidate.type === "livestock") {
    return {
      id,
      label,
      type: "livestock",
      polygon: sanitizeLocalPoints(candidate.polygon),
      height: numberOr(candidate.height, 0.55),
      attrs: {
        species: typeof attrs.species === "string" ? attrs.species : "Goat",
        breed: typeof attrs.breed === "string" ? attrs.breed : "Mixed",
        count: numberOr(attrs.count, 1),
        status: typeof attrs.status === "string" ? attrs.status : "Planned",
      },
    };
  }

  if (candidate.type === "structure") {
    return {
      id,
      label,
      type: "structure",
      polygon: sanitizeLocalPoints(candidate.polygon),
      height: numberOr(candidate.height, numberOr(attrs.height, 5)),
      attrs: {
        kind: typeof attrs.kind === "string" ? attrs.kind : "Storage Unit",
        height: Number.isFinite(Number(attrs.height)) ? Number(attrs.height) : undefined,
        material: typeof attrs.material === "string" ? attrs.material : "Timber",
        status: typeof attrs.status === "string" ? attrs.status : "Planned",
      },
    };
  }

  return null;
}

function toLocalPoint(x: unknown, y: unknown): LocalPoint | null {
  const nextX = Number(x);
  const nextY = Number(y);
  return Number.isFinite(nextX) && Number.isFinite(nextY) ? [roundPoint(nextX), roundPoint(nextY)] : null;
}

function cloneLocalPoints(points: LocalPoint[]) {
  return points.map<LocalPoint>((point) => [point[0], point[1]]);
}

function numberOr(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundPoint(value: number) {
  return Math.round(value * 100) / 100;
}
