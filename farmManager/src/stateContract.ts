import type { FarmManagerSnapshot } from "./types.js";

export type FarmManagerStateResponse = {
  state: FarmManagerSnapshot | null;
  hasSavedFarm: boolean;
  updatedAt: string | null;
};

export function parseFarmManagerStateResponse(value: unknown): FarmManagerStateResponse {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const state = isFarmManagerSnapshot(data.state) ? data.state : null;

  return {
    state,
    hasSavedFarm: data.hasSavedFarm === true && hasSavedFarmState(state),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null
  };
}

export function hasSavedFarmState(snapshot: FarmManagerSnapshot | null): snapshot is FarmManagerSnapshot {
  return Boolean(snapshot?.boundaryConfirmed && snapshot.boundaryLocal?.length >= 3 && snapshot.commits?.length);
}

function isFarmManagerSnapshot(value: unknown): value is FarmManagerSnapshot {
  if (!value || typeof value !== "object") return false;

  const snapshot = value as Partial<FarmManagerSnapshot>;
  return snapshot.version === 1 &&
    Array.isArray(snapshot.boundaryLocal) &&
    Array.isArray(snapshot.objects) &&
    Array.isArray(snapshot.commits) &&
    (snapshot.units === "ft" || snapshot.units === "m") &&
    (snapshot.view === "grid" || snapshot.view === "satellite");
}
