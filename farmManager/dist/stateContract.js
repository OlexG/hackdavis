export function parseFarmManagerStateResponse(value) {
    const data = value && typeof value === "object" ? value : {};
    const state = isFarmManagerSnapshot(data.state) ? data.state : null;
    return {
        state,
        hasSavedFarm: data.hasSavedFarm === true && hasSavedFarmState(state),
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null
    };
}
export function hasSavedFarmState(snapshot) {
    return Boolean(snapshot?.boundaryConfirmed && snapshot.boundaryLocal?.length >= 3 && snapshot.commits?.length);
}
function isFarmManagerSnapshot(value) {
    if (!value || typeof value !== "object")
        return false;
    const snapshot = value;
    return snapshot.version === 1 &&
        Array.isArray(snapshot.boundaryLocal) &&
        Array.isArray(snapshot.objects) &&
        Array.isArray(snapshot.commits) &&
        (snapshot.units === "ft" || snapshot.units === "m") &&
        (snapshot.view === "grid" || snapshot.view === "satellite");
}
//# sourceMappingURL=stateContract.js.map