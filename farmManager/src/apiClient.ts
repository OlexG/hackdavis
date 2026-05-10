import type { Catalog, FarmManagerSnapshot } from "./types.js";
import { parseFarmManagerStateResponse } from "./stateContract.js";

const stateEndpoint = "/api/farm/manager-state";
const catalogEndpoint = "/api/farm/catalog";

export type LoadFarmStateResult =
  | { ok: true; state: FarmManagerSnapshot | null; hasSavedFarm: boolean; updatedAt: string | null }
  | { ok: false; error: string };

export type SaveFarmStateResult =
  | { ok: true; hasSavedFarm: boolean; updatedAt: string | null }
  | { ok: false; error: string };

export type LoadFarmCatalogResult =
  | { ok: true; catalog: Catalog }
  | { ok: false; error: string };

export async function loadFarmCatalog(): Promise<LoadFarmCatalogResult> {
  try {
    const response = await fetch(catalogEndpoint, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { ok: false, error: readError(data, "Unable to load farm catalog") };
    }

    return { ok: true, catalog: parseCatalog(data) };
  } catch (error) {
    return { ok: false, error: readUnknownError(error, "Unable to load farm catalog") };
  }
}

export async function loadFarmState(): Promise<LoadFarmStateResult> {
  try {
    const response = await fetch(stateEndpoint, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { ok: false, error: readError(data, "Unable to load saved farm state") };
    }

    return { ok: true, ...parseFarmManagerStateResponse(data) };
  } catch (error) {
    return { ok: false, error: readUnknownError(error, "Unable to load saved farm state") };
  }
}

export async function saveFarmState(state: FarmManagerSnapshot): Promise<SaveFarmStateResult> {
  try {
    const response = await fetch(stateEndpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return { ok: false, error: readError(data, "Unable to save farm state") };
    }

    const parsed = parseFarmManagerStateResponse({
      state,
      hasSavedFarm: data.hasSavedFarm,
      updatedAt: data.updatedAt
    });
    return { ok: true, hasSavedFarm: parsed.hasSavedFarm, updatedAt: parsed.updatedAt };
  } catch (error) {
    return { ok: false, error: readUnknownError(error, "Unable to save farm state") };
  }
}

function parseCatalog(data: unknown): Catalog {
  const candidate = data && typeof data === "object" ? data as Partial<Catalog> : {};
  return {
    crops: Array.isArray(candidate.crops) ? candidate.crops : [],
    livestock: Array.isArray(candidate.livestock) ? candidate.livestock : [],
    structures: Array.isArray(candidate.structures) ? candidate.structures : []
  };
}

function readError(data: unknown, fallback: string): string {
  return data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
    ? (data as { error: string }).error
    : fallback;
}

function readUnknownError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
