import * as BoundaryMap from "./boundaryMap.js";
import * as DemoState from "./demoState.js";
import * as FarmRenderer from "./renderer.js";
import * as G from "./geometry.js";
import * as ApiClient from "./apiClient.js";
import { CATALOG } from "./catalog.js";
import { hasSavedFarmState } from "./stateContract.js";
import type {
  DrawType,
  FarmManagerContentState,
  FarmManagerChromeState,
  FarmManagerMount,
  FarmManagerMountOptions,
  FarmObject,
  Catalog,
  Point,
  PointerDownState,
  ScreenPoint,
  Units,
  FarmAiDraftPreferences,
  ViewMode
} from "./types.js";

const { state } = DemoState;

const byId = <T extends HTMLElement>(root: ParentNode, id: string): T => {
  const element = root.querySelector<T>(`#${id}`);
  if (!element) throw new Error(`Missing farmManager element: #${id}`);
  return element;
};

const createUi = (root: ParentNode) => ({
  canvas: byId<HTMLCanvasElement>(root, "farmCanvas"),
  boundaryMap: byId<HTMLElement>(root, "boundaryMap"),
  mapFallback: byId<HTMLElement>(root, "mapFallback")
});

let ui: ReturnType<typeof createUi>;
let mountOptions: FarmManagerMountOptions = {};
let commitModalOpen = false;
let savingCommit = false;
let backendMessage: string | null = null;
let backendError = false;
let onboardingVisible = true;
let setupChoiceVisible = false;
let activeCatalog: Catalog = CATALOG;
let autosaveTimer: number | null = null;
let autosaveInFlight = false;
let autosaveQueued = false;

export function mountFarmManager(root: ParentNode = document, options: FarmManagerMountOptions = {}): FarmManagerMount {
    mountOptions = options;
    ui = createUi(root);
    commitModalOpen = false;
    savingCommit = false;
    onboardingVisible = true;
    setupChoiceVisible = false;
    const controller = new AbortController();
    let rendererCleanup: (() => void) | null = null;
    let boundaryCleanup: (() => void) | null = null;
    let hudTimer: number | null = null;

    setBackendGate("Loading saved farm state...");
    void bootFarmManager(controller.signal).then((cleanup) => {
      if (!cleanup) return;
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
      if (autosaveTimer) {
        window.clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
      if (hudTimer) window.clearInterval(hudTimer);
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

  async function bootFarmManager(signal: AbortSignal): Promise<{
    rendererCleanup: () => void;
    boundaryCleanup: () => void;
    hudTimer: number;
  } | null> {
    try {
      const [catalogResult, loadResult] = await Promise.all([
        ApiClient.loadFarmCatalog(),
        ApiClient.loadFarmState()
      ]);
      if (signal.aborted) return null;

      if (catalogResult.ok === false) throw new Error(catalogResult.error);
      if (loadResult.ok === false) throw new Error(loadResult.error);
      activeCatalog = catalogResult.catalog;

      if (loadResult.hasSavedFarm && hasSavedFarmState(loadResult.state)) {
        DemoState.importSnapshot(loadResult.state);
        hideOnboarding();
      } else {
        showOnboarding();
      }
      hydrateCatalogAttrs();
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
    } catch (error) {
      setBackendGate(readErrorMessage(error), true);
      return null;
    }
  }

  function onBoundarySaved(points: Point[]): void {
    DemoState.setBoundaryFromGeo(points);
    setupChoiceVisible = true;
    emitChromeChange();
  }

  function showOnboarding(): void {
    onboardingVisible = true;
    setupChoiceVisible = false;
    emitChromeChange();
  }

  function hideOnboarding(): void {
    onboardingVisible = false;
    setupChoiceVisible = false;
    emitChromeChange();
  }

  async function persistToBackend(): Promise<boolean> {
    if (autosaveTimer) {
      window.clearTimeout(autosaveTimer);
      autosaveTimer = null;
    }
    const result = await ApiClient.saveFarmState(DemoState.exportSnapshot());
    if (result.ok === false) {
      setBackendGate(result.error, true);
      return false;
    }
    clearBackendGate();
    return true;
  }

  function schedulePersistToBackend(delay = 700): void {
    if (!state.boundaryConfirmed || !state.commits.length) return;
    if (autosaveTimer) window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      autosaveTimer = null;
      void runAutosave();
    }, delay);
  }

  async function runAutosave(): Promise<void> {
    if (autosaveInFlight) {
      autosaveQueued = true;
      return;
    }
    autosaveInFlight = true;
    await persistToBackend();
    autosaveInFlight = false;
    if (autosaveQueued) {
      autosaveQueued = false;
      schedulePersistToBackend(250);
    }
  }

  function setBackendGate(message: string, isError = false): void {
    backendMessage = message;
    backendError = isError;
    emitChromeChange();
  }

  function clearBackendGate(): void {
    backendMessage = null;
    backendError = false;
    emitChromeChange();
  }

  function syncControlState(): void {
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
      rotateBy,
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
      setCustomCropName,
      setLivestockSpecies,
      setCustomLivestockName,
      setLivestockBreed,
      setLivestockCount,
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

  function getChromeState(): FarmManagerChromeState {
    return {
      mode: state.mode,
      drawType: state.drawType,
      view: state.view,
      units: state.units,
      rotation: state.rotation,
      onboardingVisible,
      setupChoiceVisible,
      ready: backendMessage === null,
      backendMessage,
      backendError
    };
  }

  function getContentState(): FarmManagerContentState {
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
      catalog: activeCatalog,
      commitModalOpen,
      savingCommit
    };
  }

  function emitChromeChange(): void {
    syncControlState();
    mountOptions.onChromeChange?.(getChromeState());
  }

  function emitContentChange(): void {
    mountOptions.onContentChange?.(getContentState());
  }

  function setMode(mode) {
    state.mode = mode;
    ui.canvas.style.cursor = cursorForMode();
    updateDrawControls();
    emitChromeChange();
  }

  function setDrawType(drawType: DrawType): void {
    state.drawType = drawType;
    state.mode = "draw";
    ui.canvas.style.cursor = "crosshair";
    clearDraft();
    updateDrawControls();
    emitChromeChange();
  }

  function setView(view: ViewMode): void {
    state.view = view;
    syncControlState();
    schedulePersistToBackend();
    emitChromeChange();
  }

  function setUnits(units: Units): void {
    state.units = units;
    markPanelDirty();
    syncControlState();
    schedulePersistToBackend();
    emitChromeChange();
  }

  function rotateView(): void {
    state.rotation = (state.rotation + 90) % 360;
    state.zoom = G.clamp(state.zoom, FarmRenderer.getZoomLimits().min, FarmRenderer.getZoomLimits().max);
    schedulePersistToBackend();
    emitChromeChange();
  }

  function rotateBy(degrees: number): void {
    state.rotation = normalizeRotation(state.rotation + degrees);
    schedulePersistToBackend();
    emitChromeChange();
  }

  function resetView(): void {
    state.rotation = 0;
    fitFarmToView();
    schedulePersistToBackend();
  }

  function openBoundarySettings(): void {
    BoundaryMap.redraw();
    showOnboarding();
  }

  function startManualSetup(): void {
    DemoState.resetForManualPlan();
    hideOnboarding();
    fitFarmToView();
    updateTimeline();
    markPanelDirty();
    setMode("draw");
    schedulePersistToBackend(0);
  }

  async function startAiSetup(preferences: FarmAiDraftPreferences): Promise<boolean> {
    const result = await ApiClient.generateAiDraft(DemoState.exportSnapshot(), preferences);
    if (result.ok === false) {
      setBackendGate(result.error, true);
      return false;
    }
    DemoState.importSnapshot(result.state);
    hydrateCatalogAttrs();
    hideOnboarding();
    fitFarmToView();
    updateTimeline();
    markPanelDirty();
    clearBackendGate();
    emitChromeChange();
    emitContentChange();
    return true;
  }

  function updateDrawControls() {
  }

  function onPointerDown(event) {
    const rotating = event.button === 2 || event.shiftKey;
    if (rotating) event.preventDefault();
    const world = screenToWorld(event);
    const primaryPointer = event.button === 0 || (event.buttons & 1) === 1 || event.pointerType === "touch";
    const editing = isEditMode();
    const editingVertex = !rotating && editing && primaryPointer ? editableVertexAt(event, world) : null;
    const movingObjectId = !rotating && editing && primaryPointer && !editingVertex ? movableObjectIdAt(world) : null;
    state.pointerDown = {
      x: event.clientX,
      y: event.clientY,
      world,
      panX: state.panX,
      panY: state.panY,
      rotation: state.rotation,
      rotating,
      editingVertex,
      movingObjectId,
      moveTargets: movingObjectId ? getMoveTargets(movingObjectId) : []
    };
    state.isPanning = false;
    ui.canvas.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    if (state.pointerDown && event.buttons !== 0) {
      const dx = event.clientX - state.pointerDown.x;
      const dy = event.clientY - state.pointerDown.y;
      if (Math.hypot(dx, dy) > 4) state.isPanning = true;
      if (state.isPanning) {
        if (state.pointerDown.rotating) {
          state.rotation = normalizeRotation(state.pointerDown.rotation + dx * 0.35);
        } else if (state.pointerDown.editingVertex) {
          editVertexForPointer(event);
        } else if (state.pointerDown.movingObjectId) {
          moveObjectsForPointer(event);
        } else if (!isEditMode()) {
          state.panX = state.pointerDown.panX + dx;
          state.panY = state.pointerDown.panY + dy;
        }
        ui.canvas.style.cursor = "grabbing";
        return;
      }
    }
    ui.canvas.style.cursor = cursorForMode();
    const world = screenToWorld(event);
    if (isInsideFarm(world)) state.mouse = G.snapPoint(world);
    else state.mouse = null;
  }

  function onPointerUp() {
    if (state.pointerDown?.rotating && state.isPanning) schedulePersistToBackend();
    if (state.pointerDown?.editingVertex && state.isPanning) {
      updateMovedObjectRelationships(state.pointerDown.editingVertex.id);
      markPanelDirty();
      schedulePersistToBackend();
      emitContentChange();
    }
    if (state.pointerDown?.movingObjectId && state.isPanning) {
      updateMovedObjectRelationships(state.pointerDown.movingObjectId);
      markPanelDirty();
      schedulePersistToBackend();
      emitContentChange();
    }
    window.setTimeout(() => {
      state.pointerDown = null;
      state.isPanning = false;
    }, 0);
  }

  function handleCanvasPointerLeave(): void {
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

  function handleCanvasWheel(event: WheelEvent): void {
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

  function normalizeRotation(rotation: number): number {
    return ((rotation % 360) + 360) % 360;
  }

  function cursorForMode(): string {
    if (state.mode === "draw") return "crosshair";
    if (isEditMode()) return "move";
    return "grab";
  }

  function isEditMode(): boolean {
    return state.mode === "edit" || state.mode === "move";
  }

  function editableVertexAt(event: PointerEvent, world: Point): PointerDownState["editingVertex"] {
    const objects = editCandidateObjects(world);
    let best: PointerDownState["editingVertex"] = null;
    let bestDistance = Infinity;
    const rect = ui.canvas.getBoundingClientRect();
    const screen: ScreenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    objects.forEach((object) => {
      const pointKey = "polygon" in object ? "polygon" : "points" in object ? "points" : null;
      if (!pointKey) return;
      const points = object[pointKey];
      points.forEach((point, index) => {
        const handleHeight = pointKey === "points" ? 0.5 : "height" in object ? object.height + 0.8 : 0.8;
        const handle = FarmRenderer.project(point, handleHeight);
        const distance = Math.hypot(screen.x - handle.x, screen.y - handle.y);
        if (distance < bestDistance && distance <= 24) {
          bestDistance = distance;
          best = { id: object.id, pointKey, index, points: DemoState.clone(points) };
        }
      });
    });
    if (best) {
      state.selectedId = best.id;
      state.lastHitCycle = null;
      markPanelDirty();
      emitContentChange();
    }
    return best;
  }

  function editCandidateObjects(world: Point): FarmObject[] {
    const selected = state.selectedId ? state.objects.find((object) => object.id === state.selectedId) : null;
    const hits = isInsideFarm(world) ? FarmRenderer.hitTestAll(world) : [];
    const objects = selected ? [selected] : [];
    hits.forEach((object) => {
      if (!objects.some((item) => item.id === object.id)) objects.push(object);
    });
    return objects;
  }

  function movableObjectIdAt(world: Point): string | null {
    const fallbackId = state.selectedId && state.objects.some((object) => object.id === state.selectedId) ? state.selectedId : null;
    if (!isInsideFarm(world)) return fallbackId;
    const hits = FarmRenderer.hitTestAll(world);
    if (!hits.length) return fallbackId;
    const selectedHit = state.selectedId && hits.find((object) => object.id === state.selectedId);
    const object = selectedHit || hits[0];
    state.selectedId = object.id;
    state.lastHitCycle = null;
    markPanelDirty();
    emitContentChange();
    return object.id;
  }

  function getMoveTargets(objectId: string) {
    const ids = new Set([objectId]);
    const object = state.objects.find((item) => item.id === objectId);
    if (object?.type === "cropArea") {
      state.objects.forEach((item) => {
        if (item.type === "cropField" && item.parentId === object.id) ids.add(item.id);
      });
    }
    return state.objects
      .filter((item) => ids.has(item.id))
      .map((item) => ({
        id: item.id,
        polygon: "polygon" in item ? DemoState.clone(item.polygon) : undefined,
        points: "points" in item ? DemoState.clone(item.points) : undefined
      }));
  }

  function moveObjectsForPointer(event: PointerEvent): void {
    const pointer = state.pointerDown;
    if (!pointer) return;
    const world = screenToWorld(event);
    const delta: Point = [world[0] - pointer.world[0], world[1] - pointer.world[1]];
    const primary = previewMovedObject(pointer.movingObjectId, pointer.moveTargets, delta);
    if (!primary || !isMoveInsideFarm(primary)) return;
    pointer.moveTargets.forEach((target) => {
      const object = state.objects.find((item) => item.id === target.id);
      if (!object) return;
      if ("polygon" in object && target.polygon) object.polygon = translatePoints(target.polygon, delta);
      if ("points" in object && target.points) object.points = translatePoints(target.points, delta);
    });
    state.mouse = null;
    markPanelDirty();
    emitContentChange();
  }

  function editVertexForPointer(event: PointerEvent): void {
    const pointer = state.pointerDown;
    const vertex = pointer?.editingVertex;
    if (!vertex) return;
    const world = screenToWorld(event);
    if (!isInsideFarm(world)) return;
    const object = state.objects.find((item) => item.id === vertex.id);
    if (!object || !(vertex.pointKey in object)) return;
    const points = DemoState.clone(vertex.points);
    points[vertex.index] = world;
    if (vertex.pointKey === "polygon" && points.length >= 3 && "polygon" in object) object.polygon = points;
    if (vertex.pointKey === "points" && points.length >= 2 && "points" in object) object.points = points;
    state.mouse = null;
    markPanelDirty();
    emitContentChange();
  }

  function previewMovedObject(
    objectId: string | null,
    targets: PointerDownState["moveTargets"],
    delta: Point,
  ): { polygon?: Point[]; points?: Point[] } | null {
    const target = targets.find((item) => item.id === objectId);
    if (!target) return null;
    return {
      polygon: target.polygon ? translatePoints(target.polygon, delta) : undefined,
      points: target.points ? translatePoints(target.points, delta) : undefined
    };
  }

  function translatePoints(points: Point[], delta: Point): Point[] {
    return points.map((point) => [point[0] + delta[0], point[1] + delta[1]]);
  }

  function isMoveInsideFarm(object: { polygon?: Point[]; points?: Point[] }): boolean {
    const center = object.polygon?.length
      ? G.polygonCentroid(object.polygon)
      : object.points?.length
        ? averagePoint(object.points)
        : null;
    return Boolean(center && isInsideFarm(center));
  }

  function averagePoint(points: Point[]): Point {
    const total = points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]] as Point, [0, 0]);
    return [total[0] / points.length, total[1] / points.length];
  }

  function updateMovedObjectRelationships(objectId: string): void {
    const object = state.objects.find((item) => item.id === objectId);
    if (object?.type !== "cropField") return;
    const parent = findContainingCropArea(object.polygon);
    object.parentId = parent?.id || null;
  }

  function onCanvasClick(event) {
    if (state.isPanning) return;
    if (event.detail > 1) return;
    const world = G.snapPoint(screenToWorld(event));
    if (!isInsideFarm(world)) return;

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
    if (isTextInput) return;
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
    const nearPriorClick =
      state.lastHitCycle &&
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
      if (state.draft.length < 2) return;
      addObject(DemoState.path(`user-path-${Date.now()}`, "New Path", state.draft.slice()));
      clearDraft();
      setMode("select");
      return;
    }
    if (state.draft.length < 3) return;
    const polygon = state.draft.slice();
    if (state.drawType === "cropArea") {
      addObject(DemoState.cropArea(`user-crop-area-${Date.now()}`, "New Crop Area", polygon, {
        status: "Parent crop area"
      }));
    } else if (state.drawType === "cropField") {
      const parent = findContainingCropArea(polygon);
      addObject(DemoState.cropField(`user-crop-field-${Date.now()}`, "Unpopulated Crop Field", polygon, parent?.id || null, null, {
        status: parent ? "Needs crop details" : "Needs parent crop area",
        count: 0,
        growth: 0.2
      }));
    } else if (state.drawType === "livestock") {
      const animal = activeCatalog.livestock[0];
      addObject(DemoState.livestock(`user-livestock-${Date.now()}`, "New Paddock", polygon, {
        speciesKey: animal?.key ?? null,
        species: animal?.name ?? "Livestock",
        breed: animal?.breed ?? "Mixed",
        count: animal?.defaultCount ?? 1,
        idealSpaceSqft: animal?.idealSpaceSqft,
        yieldTypes: animal?.yieldTypes ?? [],
        catalogKnown: Boolean(animal),
        status: "Planned"
      }));
    } else if (state.drawType === "structure") {
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
    schedulePersistToBackend();
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
      const crop = activeCatalog.crops.find((item) => item.key === key);
      if (!crop) return;
      object.label = `${crop.name} Field`;
      object.attrs.cropKey = crop.key;
      object.attrs.cropName = crop.name;
      object.attrs.visual = crop.visual;
      object.attrs.count = crop.defaultCount;
      object.attrs.growth = crop.growth;
      applyCropCatalogAttrs(object, crop);
      object.attrs.status = "Growing";
    } else if (mode === "livestock") {
      const animal = activeCatalog.livestock.find((item) => item.key === key);
      if (!animal) return;
      object.label = `${animal.name} Paddock`;
      object.attrs.speciesKey = animal.key;
      object.attrs.species = animal.name;
      object.attrs.breed = animal.breed;
      object.attrs.count = animal.defaultCount;
      applyLivestockCatalogAttrs(object, animal);
      object.attrs.status = "Planned";
    } else {
      const structure = activeCatalog.structures.find((item) => item.key === key);
      if (!structure) return;
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
      object.attrs.catalogKnown = false;
      object.attrs.idealSpaceSqft = undefined;
      object.attrs.harvestCycles = undefined;
      object.attrs.status = "Custom crop";
    } else if (mode === "livestock") {
      object.label = `${name} Paddock`;
      object.attrs.speciesKey = "custom";
      object.attrs.species = name;
      object.attrs.breed = "Custom";
      object.attrs.count = object.attrs.count || 1;
      object.attrs.catalogKnown = false;
      object.attrs.idealSpaceSqft = undefined;
      object.attrs.yieldTypes = [];
      object.attrs.status = "Custom livestock";
    } else {
      object.label = name;
      object.attrs.kind = name;
      object.attrs.material = "Custom";
      object.attrs.status = "Custom structure";
    }
  }

  function loadCommit(index: number): void {
    DemoState.loadCommit(index);
    state.selectedId = DemoState.currentObjects()[0]?.id || null;
    updateTimeline();
    markPanelDirty();
    schedulePersistToBackend();
    emitContentChange();
  }

  function renameSelectedObject(name: string): void {
    const object = state.objects.find((item) => item.id === state.selectedId);
    const nextName = name.trim();
    if (!object || !nextName) return;
    object.label = nextName;
    markPanelDirty();
    schedulePersistToBackend();
    emitContentChange();
  }

  function deleteSelectedObject(): void {
    if (!state.selectedId) return;
    DemoState.deleteObject(state.selectedId);
    state.lastHitCycle = null;
    markPanelDirty();
    schedulePersistToBackend();
    emitContentChange();
  }

  function setCropCount(count: number): void {
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (object?.type !== "cropField") return;
    object.attrs.count = Math.max(0, Number(count) || 0);
    markPanelDirty();
    schedulePersistToBackend();
    emitContentChange();
  }

  function setCropType(cropKey: string): void {
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (object?.type !== "cropField") return;
    if (!cropKey) {
      object.label = "Unpopulated Crop Field";
      object.attrs.cropKey = null;
      object.attrs.cropName = "";
      object.attrs.count = 0;
      object.attrs.visual = "generic";
      object.attrs.growth = 0.2;
      object.attrs.catalogKnown = false;
      object.attrs.idealSpaceSqft = undefined;
      object.attrs.harvestCycles = undefined;
      object.attrs.status = "Needs crop details";
    } else {
      applyCatalogEntry(object, "crop", cropKey);
    }
    markPanelDirty();
    schedulePersistToBackend();
    emitContentChange();
  }

  function setCustomCropName(name: string): void {
    const object = state.objects.find((item) => item.id === state.selectedId);
    const nextName = name.trim();
    if (object?.type !== "cropField" || !nextName) return;
    applyCustomEntry(object, "crop", nextName);
    markPanelDirty();
    schedulePersistToBackend();
    emitContentChange();
  }

  function setLivestockSpecies(speciesKey: string): void {
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (object?.type !== "livestock") return;
    if (speciesKey) applyCatalogEntry(object, "livestock", speciesKey);
    else {
      object.label = "New Paddock";
      object.attrs.speciesKey = null;
      object.attrs.species = "";
      object.attrs.breed = "";
      object.attrs.count = 0;
      object.attrs.catalogKnown = false;
      object.attrs.idealSpaceSqft = undefined;
      object.attrs.yieldTypes = [];
      object.attrs.status = "Needs livestock details";
    }
    markPanelDirty();
    schedulePersistToBackend();
    emitContentChange();
  }

  function setCustomLivestockName(name: string): void {
    const object = state.objects.find((item) => item.id === state.selectedId);
    const nextName = name.trim();
    if (object?.type !== "livestock" || !nextName) return;
    applyCustomEntry(object, "livestock", nextName);
    markPanelDirty();
    schedulePersistToBackend();
    emitContentChange();
  }

  function setLivestockBreed(breed: string): void {
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (object?.type !== "livestock") return;
    object.attrs.breed = breed;
    markPanelDirty();
    schedulePersistToBackend();
    emitContentChange();
  }

  function setLivestockCount(count: number): void {
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (object?.type !== "livestock") return;
    object.attrs.count = Math.max(0, Number(count) || 0);
    markPanelDirty();
    schedulePersistToBackend();
    emitContentChange();
  }

  function setStructureType(structureKey: string): void {
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (object?.type !== "structure") return;
    applyCatalogEntry(object, "structure", structureKey);
    markPanelDirty();
    schedulePersistToBackend();
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
    if (saved) closeCommitModal();
    else emitContentChange();
    return saved;
  }

  function togglePlayback() {
    state.playing = !state.playing;
    if (state.playing) {
      state.playTimer = window.setInterval(() => {
        loadCommit((state.commitIndex + 1) % state.commits.length);
      }, 1200);
    } else {
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
    if (state.units === "m") return `${Math.round(areaFt * 0.092903)} m2`;
    return `${Math.round(areaFt).toLocaleString()} ft2`;
  }

  function formatLength(lengthFt) {
    if (state.units === "m") return `${(lengthFt * 0.3048).toFixed(1)} m`;
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
    for (let i = 0; i < points.length - 1; i += 1) total += G.distance(points[i], points[i + 1]);
    return total;
  }

  function markPanelDirty() {
    state.dirtyPanelKey = "";
  }

  function hydrateCatalogAttrs(): void {
    const hydrateObject = (object: FarmObject) => {
      if (object.type === "cropField" && object.attrs.cropKey) {
        const crop = activeCatalog.crops.find((item) => item.key === object.attrs.cropKey || item.name === object.attrs.cropName);
        if (crop) {
          object.attrs.cropKey = crop.key;
          object.attrs.cropName = crop.name;
          object.attrs.visual = crop.visual;
          applyCropCatalogAttrs(object, crop);
        }
      }
      if (object.type === "livestock") {
        const animal = activeCatalog.livestock.find((item) =>
          item.key === object.attrs.speciesKey ||
          item.name === object.attrs.species ||
          item.key === String(object.attrs.species || "").toLowerCase()
        );
        if (animal) {
          object.attrs.speciesKey = animal.key;
          object.attrs.species = animal.name;
          if (!object.attrs.breed || object.attrs.breed === "Custom") object.attrs.breed = animal.breed;
          applyLivestockCatalogAttrs(object, animal);
        }
      }
    };

    state.objects.forEach(hydrateObject);
    state.commits.forEach((commit) => commit.objects.forEach(hydrateObject));
  }

  function applyCropCatalogAttrs(object, crop): void {
    object.attrs.catalogKnown = true;
    object.attrs.idealSpaceSqft = crop.idealSpaceSqft;
    object.attrs.harvestCycles = crop.harvestCycles;
  }

  function applyLivestockCatalogAttrs(object, animal): void {
    object.attrs.catalogKnown = true;
    object.attrs.idealSpaceSqft = animal.idealSpaceSqft;
    object.attrs.yieldTypes = animal.yieldTypes || [];
  }

  function readErrorMessage(error: unknown): string {
    return error instanceof Error && error.message ? error.message : "Unable to load farm manager state";
  }

  function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[char] || char);
  }
