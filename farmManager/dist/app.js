import * as BoundaryMap from "./boundaryMap.js";
import * as DemoState from "./demoState.js";
import * as FarmRenderer from "./renderer.js";
import * as G from "./geometry.js";
import * as ApiClient from "./apiClient.js";
import { CATALOG } from "./catalog.js";
import { hasSavedFarmState } from "./stateContract.js";
const { state } = DemoState;
const byId = (root, id) => {
    const element = root.querySelector(`#${id}`);
    if (!element)
        throw new Error(`Missing farmManager element: #${id}`);
    return element;
};
const createUi = (root) => ({
    canvas: byId(root, "farmCanvas"),
    boundaryMap: byId(root, "boundaryMap"),
    mapFallback: byId(root, "mapFallback")
});
let ui;
let mountOptions = {};
let commitModalOpen = false;
let savingCommit = false;
let backendMessage = null;
let backendError = false;
let onboardingVisible = true;
let setupChoiceVisible = false;
export function mountFarmManager(root = document, options = {}) {
    mountOptions = options;
    ui = createUi(root);
    commitModalOpen = false;
    savingCommit = false;
    onboardingVisible = true;
    setupChoiceVisible = false;
    const controller = new AbortController();
    let rendererCleanup = null;
    let boundaryCleanup = null;
    let hudTimer = null;
    setBackendGate("Loading saved farm state...");
    void bootFarmManager(controller.signal).then((cleanup) => {
        if (!cleanup)
            return;
        if (controller.signal.aborted) {
            cleanup.rendererCleanup();
            cleanup.boundaryCleanup();
            window.clearInterval(cleanup.hudTimer);
            return;
        }
        rendererCleanup = cleanup.rendererCleanup;
        boundaryCleanup = cleanup.boundaryCleanup;
        hudTimer = cleanup.hudTimer;
    });
    const cleanup = () => {
        controller.abort();
        if (hudTimer)
            window.clearInterval(hudTimer);
        if (state.playTimer) {
            window.clearInterval(state.playTimer);
            state.playTimer = null;
        }
        boundaryCleanup?.();
        rendererCleanup?.();
    };
    return {
        cleanup,
        actions: createActions(),
        getChromeState,
        getContentState
    };
}
async function bootFarmManager(signal) {
    try {
        const loadResult = await ApiClient.loadFarmState();
        if (signal.aborted)
            return null;
        if (loadResult.ok === false)
            throw new Error(loadResult.error);
        if (loadResult.hasSavedFarm && hasSavedFarmState(loadResult.state)) {
            DemoState.importSnapshot(loadResult.state);
            hideOnboarding();
        }
        else {
            showOnboarding();
        }
        state.view = "satellite";
        const rendererCleanup = FarmRenderer.init(ui.canvas);
        const boundaryCleanup = BoundaryMap.init(ui, onBoundarySaved, { bindControls: false });
        updateDrawControls();
        syncControlState();
        fitFarmToView();
        updateTimeline();
        updatePanel();
        clearBackendGate();
        emitChromeChange();
        emitContentChange();
        const hudTimer = window.setInterval(updateHud, 150);
        return { rendererCleanup, boundaryCleanup, hudTimer };
    }
    catch (error) {
        setBackendGate(readErrorMessage(error), true);
        return null;
    }
}
function onBoundarySaved(points) {
    DemoState.setBoundaryFromGeo(points);
    setupChoiceVisible = true;
    emitChromeChange();
}
function showOnboarding() {
    onboardingVisible = true;
    setupChoiceVisible = false;
    emitChromeChange();
}
function hideOnboarding() {
    onboardingVisible = false;
    setupChoiceVisible = false;
    emitChromeChange();
}
async function persistToBackend() {
    const result = await ApiClient.saveFarmState(DemoState.exportSnapshot());
    if (result.ok === false) {
        setBackendGate(result.error, true);
        return false;
    }
    clearBackendGate();
    return true;
}
function setBackendGate(message, isError = false) {
    backendMessage = message;
    backendError = isError;
    emitChromeChange();
}
function clearBackendGate() {
    backendMessage = null;
    backendError = false;
    emitChromeChange();
}
function syncControlState() {
}
function createActions() {
    return {
        setMode,
        setDrawType,
        setView,
        setUnits,
        finishDraft,
        clearDraft,
        zoomIn: () => zoomAtScreenPoint(canvasCenter(), 0.18),
        zoomOut: () => zoomAtScreenPoint(canvasCenter(), -0.18),
        rotateView,
        resetView,
        openBoundarySettings,
        useDemoBoundary: BoundaryMap.useDemoBoundary,
        clearBoundary: BoundaryMap.clearBoundary,
        saveBoundary: () => BoundaryMap.saveBoundary(onBoundarySaved),
        startManualSetup,
        startAiSetup,
        loadCommit,
        togglePlayback,
        openCommitModal,
        closeCommitModal,
        saveCommit,
        renameSelectedObject,
        deleteSelectedObject,
        setCropCount,
        setCropType,
        setLivestockSpecies,
        setLivestockBreed,
        setStructureType,
        handleCanvasPointerDown: onPointerDown,
        handleCanvasPointerMove: onPointerMove,
        handleCanvasPointerUp: onPointerUp,
        handleCanvasPointerLeave,
        handleCanvasClick: onCanvasClick,
        handleCanvasWheel,
        handleKeyDown: onKeyDown
    };
}
function getChromeState() {
    return {
        mode: state.mode,
        drawType: state.drawType,
        view: state.view,
        units: state.units,
        onboardingVisible,
        setupChoiceVisible,
        ready: backendMessage === null,
        backendMessage,
        backendError
    };
}
function getContentState() {
    const commit = state.commits[state.commitIndex];
    return {
        selectedObject: state.objects.find((item) => item.id === state.selectedId) || null,
        objects: DemoState.clone(state.objects),
        timeline: {
            commits: DemoState.clone(state.commits),
            commitIndex: state.commitIndex,
            playing: state.playing,
            snapshotDate: commit ? formatDate(commit.timestamp) : "",
            snapshotLabel: commit?.name || ""
        },
        draftCount: state.draft.length,
        boundaryPointCount: DemoState.activeBoundary().length,
        boundarySource: state.boundaryGeo ? "Map" : "Demo",
        units: state.units,
        catalog: CATALOG,
        commitModalOpen,
        savingCommit
    };
}
function emitChromeChange() {
    syncControlState();
    mountOptions.onChromeChange?.(getChromeState());
}
function emitContentChange() {
    mountOptions.onContentChange?.(getContentState());
}
function setMode(mode) {
    state.mode = mode;
    ui.canvas.style.cursor = mode === "draw" ? "crosshair" : "grab";
    updateDrawControls();
    emitChromeChange();
}
function setDrawType(drawType) {
    state.drawType = drawType;
    clearDraft();
    updateDrawControls();
    emitChromeChange();
}
function setView(view) {
    state.view = view;
    syncControlState();
    emitChromeChange();
}
function setUnits(units) {
    state.units = units;
    markPanelDirty();
    syncControlState();
    emitChromeChange();
}
function rotateView() {
    state.rotation = (state.rotation + 90) % 360;
    state.zoom = G.clamp(state.zoom, FarmRenderer.getZoomLimits().min, FarmRenderer.getZoomLimits().max);
}
function resetView() {
    state.rotation = 0;
    fitFarmToView();
}
function openBoundarySettings() {
    BoundaryMap.redraw();
    showOnboarding();
}
function startManualSetup() {
    DemoState.resetForManualPlan();
    hideOnboarding();
    fitFarmToView();
    updateTimeline();
    markPanelDirty();
    setMode("draw");
}
function startAiSetup() {
    DemoState.useAiPreset();
    hideOnboarding();
    state.selectedId = "squash-slot";
    updateTimeline();
    markPanelDirty();
    emitChromeChange();
}
function updateDrawControls() {
}
function onPointerDown(event) {
    state.pointerDown = {
        x: event.clientX,
        y: event.clientY,
        panX: state.panX,
        panY: state.panY
    };
    state.isPanning = false;
    ui.canvas.setPointerCapture?.(event.pointerId);
}
function onPointerMove(event) {
    if (state.pointerDown && event.buttons === 1) {
        const dx = event.clientX - state.pointerDown.x;
        const dy = event.clientY - state.pointerDown.y;
        if (Math.hypot(dx, dy) > 4)
            state.isPanning = true;
        if (state.isPanning) {
            state.panX = state.pointerDown.panX + dx;
            state.panY = state.pointerDown.panY + dy;
            ui.canvas.style.cursor = "grabbing";
            return;
        }
    }
    ui.canvas.style.cursor = state.mode === "draw" ? "crosshair" : "grab";
    const world = screenToWorld(event);
    if (isInsideFarm(world))
        state.mouse = G.snapPoint(world);
    else
        state.mouse = null;
}
function onPointerUp() {
    window.setTimeout(() => {
        state.pointerDown = null;
        state.isPanning = false;
    }, 0);
}
function handleCanvasPointerLeave() {
    state.mouse = null;
    onPointerUp();
    emitContentChange();
}
function zoomAtCursor(event) {
    const rect = ui.canvas.getBoundingClientRect();
    zoomAtScreenPoint({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    }, event.deltaY < 0 ? 0.18 : -0.18);
}
function handleCanvasWheel(event) {
    event.preventDefault();
    zoomAtCursor(event);
}
function canvasCenter() {
    const rect = ui.canvas.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
}
function fitFarmToView() {
    const limits = FarmRenderer.getZoomLimits();
    state.zoom = limits.min;
    const pan = FarmRenderer.getCenteredPan(state.zoom);
    state.panX = pan.x;
    state.panY = pan.y;
}
function zoomAtScreenPoint(cursor, delta) {
    const worldBefore = FarmRenderer.unproject(cursor.x, cursor.y);
    const limits = FarmRenderer.getZoomLimits();
    state.zoom = G.clamp(state.zoom + delta, limits.min, limits.max);
    const after = FarmRenderer.project(worldBefore);
    state.panX += cursor.x - after.x;
    state.panY += cursor.y - after.y;
}
function onCanvasClick(event) {
    if (state.isPanning)
        return;
    if (event.detail > 1)
        return;
    const world = G.snapPoint(screenToWorld(event));
    if (!isInsideFarm(world))
        return;
    if (state.mode === "draw") {
        state.draft.push(world);
        markPanelDirty();
        emitContentChange();
        return;
    }
    const hits = FarmRenderer.hitTestAll(world);
    state.selectedId = selectFromHitStack(world, hits);
    markPanelDirty();
    emitContentChange();
}
function onKeyDown(event) {
    const target = event.target;
    const isTextInput = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    if (isTextInput)
        return;
    if (event.key === "Enter" && state.mode === "draw") {
        event.preventDefault();
        finishDraft();
    }
    if (event.key === "Escape") {
        event.preventDefault();
        clearDraft();
    }
}
function selectFromHitStack(world, hits) {
    if (!hits.length) {
        state.lastHitCycle = null;
        return null;
    }
    const ids = hits.map((hit) => hit.id);
    const cycleKey = ids.join("|");
    const nearPriorClick = state.lastHitCycle &&
        state.lastHitCycle.key === cycleKey &&
        G.distance(world, state.lastHitCycle.world) <= 2.5;
    const index = nearPriorClick ? (state.lastHitCycle.index + 1) % hits.length : 0;
    state.lastHitCycle = { key: cycleKey, index, world };
    return hits[index].id;
}
function screenToWorld(event) {
    const rect = ui.canvas.getBoundingClientRect();
    return FarmRenderer.unproject(event.clientX - rect.left, event.clientY - rect.top);
}
function clearDraft() {
    state.draft = [];
    state.mouse = null;
    markPanelDirty();
    emitContentChange();
}
function finishDraft() {
    if (state.drawType === "path") {
        if (state.draft.length < 2)
            return;
        addObject(DemoState.path(`user-path-${Date.now()}`, "New Path", state.draft.slice()));
        clearDraft();
        setMode("select");
        return;
    }
    if (state.draft.length < 3)
        return;
    const polygon = state.draft.slice();
    if (state.drawType === "cropArea") {
        addObject(DemoState.cropArea(`user-crop-area-${Date.now()}`, "New Crop Area", polygon, {
            status: "Parent crop area"
        }));
    }
    else if (state.drawType === "cropField") {
        const parent = findContainingCropArea(polygon);
        addObject(DemoState.cropField(`user-crop-field-${Date.now()}`, "Unpopulated Crop Field", polygon, parent?.id || null, null, {
            status: parent ? "Needs crop details" : "Needs parent crop area",
            count: 0,
            growth: 0.2
        }));
    }
    else if (state.drawType === "livestock") {
        addObject(DemoState.livestock(`user-livestock-${Date.now()}`, "New Paddock", polygon, {
            species: "Goat",
            breed: "Mixed",
            count: 4,
            status: "Planned"
        }));
    }
    else if (state.drawType === "structure") {
        addObject(DemoState.structure(`user-structure-${Date.now()}`, "New Structure", polygon, {
            kind: "Storage Unit",
            height: 5.2,
            material: "Timber",
            status: "Planned"
        }));
    }
    clearDraft();
    setMode("select");
}
function addObject(object) {
    state.objects.push(object);
    state.selectedId = object.id;
    markPanelDirty();
}
function findContainingCropArea(polygon) {
    const centroid = G.polygonCentroid(polygon);
    return state.objects.find((object) => object.type === "cropArea" && G.pointInPolygon(centroid, object.polygon));
}
function updateHud() {
    const commit = state.commits[state.commitIndex];
    const panelKey = [
        state.selectedId,
        state.units,
        state.commitIndex,
        state.objects.length,
        state.pendingCatalogMode,
        JSON.stringify(state.objects.map((object) => [object.id, object.label, object.attrs]))
    ].join("|");
    if (panelKey !== state.dirtyPanelKey) {
        state.dirtyPanelKey = panelKey;
        updatePanel();
        updateTimeline();
    }
}
function updatePanel() {
    emitContentChange();
}
function applyCatalogEntry(object, mode, key) {
    if (mode === "crop") {
        const crop = CATALOG.crops.find((item) => item.key === key);
        object.label = `${crop.name} Field`;
        object.attrs.cropKey = crop.key;
        object.attrs.cropName = crop.name;
        object.attrs.visual = crop.visual;
        object.attrs.count = crop.defaultCount;
        object.attrs.growth = crop.growth;
        object.attrs.status = "Growing";
    }
    else if (mode === "livestock") {
        const animal = CATALOG.livestock.find((item) => item.key === key);
        object.label = `${animal.name} Paddock`;
        object.attrs.species = animal.name;
        object.attrs.breed = animal.breed;
        object.attrs.count = animal.defaultCount;
        object.attrs.status = "Planned";
    }
    else {
        const structure = CATALOG.structures.find((item) => item.key === key);
        object.label = structure.name;
        object.attrs.kind = structure.name;
        object.attrs.material = structure.material;
        object.height = structure.height;
        object.attrs.height = structure.height;
        object.attrs.status = "Planned";
    }
}
function applyCustomEntry(object, mode, name) {
    if (mode === "crop") {
        object.label = `${name} Field`;
        object.attrs.cropKey = "custom";
        object.attrs.cropName = name;
        object.attrs.visual = "generic";
        object.attrs.count = object.attrs.count || 12;
        object.attrs.growth = object.attrs.growth || 0.45;
        object.attrs.status = "Custom crop";
    }
    else if (mode === "livestock") {
        object.label = `${name} Paddock`;
        object.attrs.species = name;
        object.attrs.breed = "Custom";
        object.attrs.count = object.attrs.count || 1;
        object.attrs.status = "Custom livestock";
    }
    else {
        object.label = name;
        object.attrs.kind = name;
        object.attrs.material = "Custom";
        object.attrs.status = "Custom structure";
    }
}
function loadCommit(index) {
    DemoState.loadCommit(index);
    state.selectedId = DemoState.currentObjects()[0]?.id || null;
    updateTimeline();
    markPanelDirty();
    emitContentChange();
}
function renameSelectedObject(name) {
    const object = state.objects.find((item) => item.id === state.selectedId);
    const nextName = name.trim();
    if (!object || !nextName)
        return;
    object.label = nextName;
    markPanelDirty();
    emitContentChange();
}
function deleteSelectedObject() {
    if (!state.selectedId)
        return;
    DemoState.deleteObject(state.selectedId);
    state.lastHitCycle = null;
    markPanelDirty();
    emitContentChange();
}
function setCropCount(count) {
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (object?.type !== "cropField")
        return;
    object.attrs.count = Math.max(0, Number(count) || 0);
    markPanelDirty();
    emitContentChange();
}
function setCropType(cropKey) {
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (object?.type !== "cropField")
        return;
    if (!cropKey) {
        object.label = "Unpopulated Crop Field";
        object.attrs.cropKey = null;
        object.attrs.cropName = "";
        object.attrs.count = 0;
        object.attrs.visual = "generic";
        object.attrs.growth = 0.2;
        object.attrs.status = "Needs crop details";
    }
    else {
        applyCatalogEntry(object, "crop", cropKey);
    }
    markPanelDirty();
    emitContentChange();
}
function setLivestockSpecies(speciesKey) {
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (object?.type !== "livestock")
        return;
    applyCatalogEntry(object, "livestock", speciesKey);
    markPanelDirty();
    emitContentChange();
}
function setLivestockBreed(breed) {
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (object?.type !== "livestock")
        return;
    object.attrs.breed = breed;
    markPanelDirty();
    emitContentChange();
}
function setStructureType(structureKey) {
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (object?.type !== "structure")
        return;
    applyCatalogEntry(object, "structure", structureKey);
    markPanelDirty();
    emitContentChange();
}
function updateTimeline() {
    emitContentChange();
}
function openCommitModal() {
    commitModalOpen = true;
    emitContentChange();
}
function closeCommitModal() {
    commitModalOpen = false;
    emitContentChange();
}
async function saveCommit(name) {
    DemoState.createCommit(name);
    updateTimeline();
    markPanelDirty();
    savingCommit = true;
    emitContentChange();
    const saved = await persistToBackend();
    savingCommit = false;
    if (saved)
        closeCommitModal();
    else
        emitContentChange();
    return saved;
}
function togglePlayback() {
    state.playing = !state.playing;
    if (state.playing) {
        state.playTimer = window.setInterval(() => {
            loadCommit((state.commitIndex + 1) % state.commits.length);
        }, 1200);
    }
    else {
        window.clearInterval(state.playTimer);
        state.playTimer = null;
    }
    emitContentChange();
}
function isInsideFarm(point) {
    return G.pointInPolygon(point, DemoState.activeBoundary());
}
function labelForType(type) {
    return {
        cropArea: "Crop Area",
        cropField: "Crop Field",
        livestock: "Livestock",
        structure: "Structure",
        path: "Path"
    }[type] || type;
}
function parentLabel(parentId) {
    return state.objects.find((object) => object.id === parentId)?.label || "None";
}
function formatArea(areaFt) {
    if (state.units === "m")
        return `${Math.round(areaFt * 0.092903)} m2`;
    return `${Math.round(areaFt).toLocaleString()} ft2`;
}
function formatLength(lengthFt) {
    if (state.units === "m")
        return `${(lengthFt * 0.3048).toFixed(1)} m`;
    return `${lengthFt.toFixed(1)} ft`;
}
function formatDimensions(poly) {
    const bbox = G.getBBox(poly);
    return `${formatLength(bbox.maxX - bbox.minX)} x ${formatLength(bbox.maxY - bbox.minY)}`;
}
function formatDate(dateText) {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    }).format(new Date(dateText));
}
function pathLength(points) {
    let total = 0;
    for (let i = 0; i < points.length - 1; i += 1)
        total += G.distance(points[i], points[i + 1]);
    return total;
}
function markPanelDirty() {
    state.dirtyPanelKey = "";
}
function readErrorMessage(error) {
    return error instanceof Error && error.message ? error.message : "Unable to load farm manager state";
}
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[char] || char);
}
//# sourceMappingURL=app.js.map