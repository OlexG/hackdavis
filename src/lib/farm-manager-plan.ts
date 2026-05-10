import type { UpdateFilter } from "mongodb";
import {
  polygonArea,
  sanitizeFarmV2Objects,
  sanitizeGeoPoints,
  sanitizeLocalPoints,
} from "@/lib/farm-v2";
import type { FarmManagerCommit, FarmManagerObject, FarmManagerSnapshot } from "@/lib/farm-manager-state";
import type { FarmV2Plan, GeoPoint } from "@/lib/models";

type FarmManagerPlanFields = Omit<FarmV2Plan, "_id" | "farmId" | "userId" | "createdAt" | "updatedAt">;

export function farmV2PlanToFarmManagerSnapshot(plan: FarmV2Plan): FarmManagerSnapshot {
  const objects = sanitizeFarmV2Objects(plan.objects) as FarmManagerObject[];
  const commits = normalizePlanCommits(plan.commits);
  const commitIndex = clampCommitIndex(plan.commitIndex, commits);

  return {
    version: 1,
    boundaryConfirmed: plan.boundary.local.length >= 3,
    boundaryGeo: plan.boundary.geo,
    boundaryLocal: plan.boundary.local,
    objects,
    commits,
    commitIndex,
    units: plan.units,
    view: plan.view,
    selectedId: typeof plan.selectedId === "string" ? plan.selectedId : null,
  };
}

export function farmManagerSnapshotToPlanFields(
  snapshot: FarmManagerSnapshot,
  now: Date,
  existing?: FarmV2Plan | null,
): FarmManagerPlanFields {
  const objects = sanitizeFarmV2Objects(snapshot.objects) as FarmV2Plan["objects"];
  const commits = normalizeSnapshotCommits(snapshot.commits, objects, now);
  const boundaryLocal = sanitizeLocalPoints(snapshot.boundaryLocal);
  const boundaryGeo = sanitizeGeoPoints(snapshot.boundaryGeo);
  const mode = inferSetupMode(snapshot);

  return {
    schema: "farmv2",
    version: 8,
    name: existing?.name || `${mode === "manual" ? "Manual" : "Generated"} Farmv2 Plan - ${formatPlanDate(now)}`,
    status: existing?.status || "draft",
    units: snapshot.units,
    view: snapshot.view,
    selectedId: snapshot.selectedId,
    camera: existing?.camera || {
      zoom: 1,
      panX: 0,
      panY: -18,
      rotation: 0,
    },
    boundary: {
      source: boundaryGeo.length >= 3 ? "map" : "demo",
      geo: boundaryGeo.length >= 3 ? boundaryGeo : null,
      local: boundaryLocal,
      areaSquareFeet: Math.round(polygonArea(boundaryLocal)),
    },
    objects,
    commits,
    commitIndex: clampCommitIndex(snapshot.commitIndex, commits),
    summary: existing?.summary || {
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
        boundaryPointCount: boundaryLocal.length,
        generatedObjectCount: objects.length,
      },
      score: mode === "manual" ? 0.5 : 0.82,
    },
  };
}

export function farmManagerPlanUpdate(
  snapshot: FarmManagerSnapshot,
  now: Date,
  existing?: FarmV2Plan | null,
): UpdateFilter<FarmV2Plan> {
  const fields = farmManagerSnapshotToPlanFields(snapshot, now, existing);

  return {
    $set: {
      ...fields,
      updatedAt: now,
    },
    $setOnInsert: {
      createdAt: now,
    },
  } as UpdateFilter<FarmV2Plan>;
}

export function farmGeoPointFromSnapshot(snapshot: FarmManagerSnapshot) {
  const points = sanitizeGeoPoints(snapshot.boundaryGeo);

  if (!points.length) {
    return defaultFarmGeoPoint();
  }

  const longitude = roundGeo(points.reduce((sum, point) => sum + point[0], 0) / points.length);
  const latitude = roundGeo(points.reduce((sum, point) => sum + point[1], 0) / points.length);

  return {
    location: {
      type: "Point" as const,
      coordinates: [longitude, latitude] as GeoPoint,
    },
    coordinates: {
      latitude,
      longitude,
      x: 50,
      y: 50,
    },
  };
}

function normalizePlanCommits(commits: FarmV2Plan["commits"]): FarmManagerCommit[] {
  return commits.map((commit) => ({
    id: commit.id,
    timestamp: serializeTimestamp(commit.timestamp),
    name: commit.name,
    autoName: commit.autoName,
    objects: sanitizeFarmV2Objects(commit.objects) as FarmManagerObject[],
  }));
}

function normalizeSnapshotCommits(
  commits: FarmManagerCommit[],
  objects: FarmV2Plan["objects"],
  now: Date,
): FarmV2Plan["commits"] {
  const normalized = commits.map((commit) => ({
    id: commit.id || `commit-${now.getTime()}`,
    timestamp: parseTimestamp(commit.timestamp, now),
    name: commit.name || commit.autoName || "Farm snapshot",
    autoName: commit.autoName || commit.name || "Farm snapshot",
    objects: sanitizeFarmV2Objects(commit.objects) as FarmV2Plan["objects"],
  }));

  if (!normalized.length) {
    normalized.push({
      id: `commit-${now.getTime()}`,
      timestamp: now,
      name: "Boundary saved",
      autoName: "Boundary saved",
      objects,
    });
  }

  return normalized;
}

function inferSetupMode(snapshot: FarmManagerSnapshot) {
  const firstCommitName = snapshot.commits[0]?.name.toLowerCase() || "";
  return firstCommitName.includes("ai") || firstCommitName.includes("draft") || snapshot.objects.length > 0
    ? "deterministic-draft"
    : "manual";
}

function clampCommitIndex(index: number, commits: Array<unknown>) {
  return Math.min(Math.max(0, Number.isInteger(index) ? index : 0), Math.max(0, commits.length - 1));
}

function parseTimestamp(value: string, fallback: Date) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : fallback;
}

function serializeTimestamp(value: Date | string) {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function formatPlanDate(value: Date) {
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function defaultFarmGeoPoint() {
  const latitude = 38.5449;
  const longitude = -121.7405;

  return {
    location: {
      type: "Point" as const,
      coordinates: [longitude, latitude] as GeoPoint,
    },
    coordinates: {
      latitude,
      longitude,
      x: 50,
      y: 50,
    },
  };
}

function roundGeo(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
