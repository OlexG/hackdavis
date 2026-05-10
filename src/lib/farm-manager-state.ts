export type FarmManagerPoint = [number, number];

export type FarmManagerObjectType = "cropArea" | "cropField" | "livestock" | "structure" | "path";

export type FarmManagerObject = {
  id: string;
  label: string;
  type: FarmManagerObjectType;
  attrs: Record<string, unknown>;
  polygon?: FarmManagerPoint[];
  points?: FarmManagerPoint[];
  parentId?: string | null;
  height?: number;
};

export type FarmManagerCommit = {
  id: string;
  timestamp: string;
  name: string;
  autoName: string;
  objects: FarmManagerObject[];
};

export type FarmManagerSnapshot = {
  version: 1;
  boundaryConfirmed: boolean;
  boundaryGeo: FarmManagerPoint[] | null;
  boundaryLocal: FarmManagerPoint[];
  objects: FarmManagerObject[];
  commits: FarmManagerCommit[];
  commitIndex: number;
  units: "ft" | "m";
  view: "grid" | "satellite";
  selectedId: string | null;
};

export function normalizeFarmManagerSnapshot(raw: unknown): FarmManagerSnapshot {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid farm manager state");
  }

  const candidate = raw as Record<string, unknown>;

  if (candidate.version !== 1) {
    throw new Error("Unsupported farm manager state version");
  }

  const objects = normalizeObjectArray(candidate.objects);
  const commits = normalizeCommitArray(candidate.commits);
  const maxCommitIndex = Math.max(0, commits.length - 1);

  return {
    version: 1,
    boundaryConfirmed: Boolean(candidate.boundaryConfirmed),
    boundaryGeo: normalizePointArray(candidate.boundaryGeo, true),
    boundaryLocal: normalizePointArray(candidate.boundaryLocal, false),
    objects,
    commits,
    commitIndex: clampInteger(candidate.commitIndex, 0, maxCommitIndex),
    units: candidate.units === "m" ? "m" : "ft",
    view: candidate.view === "satellite" ? "satellite" : "grid",
    selectedId: typeof candidate.selectedId === "string" ? candidate.selectedId.slice(0, 120) : null,
  };
}

export function hasSavedFarmState(snapshot: FarmManagerSnapshot | null): snapshot is FarmManagerSnapshot {
  return Boolean(snapshot?.boundaryConfirmed && snapshot.boundaryLocal.length >= 3 && snapshot.commits.length);
}

function normalizeCommitArray(raw: unknown): FarmManagerCommit[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((commit) => {
      if (!commit || typeof commit !== "object") return null;
      const candidate = commit as Record<string, unknown>;
      const id = normalizeString(candidate.id, 80);
      const timestamp = normalizeString(candidate.timestamp, 80);
      const name = normalizeString(candidate.name, 140);
      const autoName = normalizeString(candidate.autoName, 140);

      if (!id || !timestamp || !name || !autoName) return null;

      return {
        id,
        timestamp,
        name,
        autoName,
        objects: normalizeObjectArray(candidate.objects),
      };
    })
    .filter((commit): commit is FarmManagerCommit => Boolean(commit))
    .slice(0, 100);
}

function normalizeObjectArray(raw: unknown): FarmManagerObject[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map(normalizeObject)
    .filter((object): object is FarmManagerObject => Boolean(object))
    .slice(0, 500);
}

function normalizeObject(raw: unknown): FarmManagerObject | null {
  if (!raw || typeof raw !== "object") return null;

  const candidate = raw as Record<string, unknown>;
  const id = normalizeString(candidate.id, 120);
  const label = normalizeString(candidate.label, 160);
  const type = normalizeObjectType(candidate.type);
  const attrs = candidate.attrs && typeof candidate.attrs === "object" ? candidate.attrs as Record<string, unknown> : {};

  if (!id || !label || !type) return null;

  if (type === "path") {
    const points = normalizePointArray(candidate.points, false);
    if (points.length < 2) return null;

    return { id, label, type, points, attrs };
  }

  const polygon = normalizePointArray(candidate.polygon, false);
  if (polygon.length < 3) return null;

  return {
    id,
    label,
    type,
    polygon,
    attrs,
    parentId: typeof candidate.parentId === "string" ? candidate.parentId.slice(0, 120) : null,
    height: Number.isFinite(Number(candidate.height)) ? Math.max(0, Number(candidate.height)) : 0,
  };
}

function normalizePointArray(raw: unknown, allowNull: true): FarmManagerPoint[] | null;
function normalizePointArray(raw: unknown, allowNull: false): FarmManagerPoint[];
function normalizePointArray(raw: unknown, allowNull: boolean): FarmManagerPoint[] | null {
  if (raw === null && allowNull) return null;
  if (!Array.isArray(raw)) return allowNull ? null : [];

  return raw
    .map((point) => Array.isArray(point) ? [Number(point[0]), Number(point[1])] : null)
    .filter((point): point is FarmManagerPoint => Boolean(point && Number.isFinite(point[0]) && Number.isFinite(point[1])))
    .slice(0, 200);
}

function normalizeObjectType(value: unknown): FarmManagerObjectType | null {
  return value === "cropArea" || value === "cropField" || value === "livestock" || value === "structure" || value === "path"
    ? value
    : null;
}

function normalizeString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function clampInteger(value: unknown, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.floor(number)));
}
