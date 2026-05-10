import { parseFarmManagerStateResponse } from "./stateContract.js";
const stateEndpoint = "/api/farm/manager-state";
const catalogEndpoint = "/api/farm/catalog";
export async function loadFarmCatalog() {
    try {
        const response = await fetch(catalogEndpoint, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { ok: false, error: readError(data, "Unable to load farm catalog") };
        }
        return { ok: true, catalog: parseCatalog(data) };
    }
    catch (error) {
        return { ok: false, error: readUnknownError(error, "Unable to load farm catalog") };
    }
}
export async function loadFarmState() {
    try {
        const response = await fetch(stateEndpoint, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { ok: false, error: readError(data, "Unable to load saved farm state") };
        }
        return { ok: true, ...parseFarmManagerStateResponse(data) };
    }
    catch (error) {
        return { ok: false, error: readUnknownError(error, "Unable to load saved farm state") };
    }
}
export async function saveFarmState(state) {
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
    }
    catch (error) {
        return { ok: false, error: readUnknownError(error, "Unable to save farm state") };
    }
}
function parseCatalog(data) {
    const candidate = data && typeof data === "object" ? data : {};
    return {
        crops: Array.isArray(candidate.crops) ? candidate.crops : [],
        livestock: Array.isArray(candidate.livestock) ? candidate.livestock : [],
        structures: Array.isArray(candidate.structures) ? candidate.structures : []
    };
}
function readError(data, fallback) {
    return data && typeof data === "object" && typeof data.error === "string"
        ? data.error
        : fallback;
}
function readUnknownError(error, fallback) {
    return error instanceof Error && error.message ? error.message : fallback;
}
//# sourceMappingURL=apiClient.js.map