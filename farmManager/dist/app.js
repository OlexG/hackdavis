import * as BoundaryMap from "./boundaryMap.js";
import * as DemoState from "./demoState.js";
import * as FarmRenderer from "./renderer.js";
import * as G from "./geometry.js";
import { CATALOG } from "./catalog.js";
const { state } = DemoState;
const byId = (id) => document.getElementById(id);
const ui = {
    canvas: byId("farmCanvas"),
    selectMode: byId("selectMode"),
    drawMode: byId("drawMode"),
    closeShape: byId("closeShape"),
    clearDraft: byId("clearDraft"),
    zoomOut: byId("zoomOut"),
    zoomIn: byId("zoomIn"),
    rotateView: byId("rotateView"),
    resetView: byId("resetView"),
    settingsButton: byId("settingsButton"),
    timelineInput: byId("timelineInput"),
    timelineMarkers: byId("timelineMarkers"),
    playTimeline: byId("playTimeline"),
    addTimelineEntry: byId("addTimelineEntry"),
    snapshotDate: byId("snapshotDate"),
    snapshotLabel: byId("snapshotLabel"),
    panelKicker: byId("panelKicker"),
    panelTitle: byId("panelTitle"),
    objectDetails: byId("objectDetails"),
    onboarding: byId("onboarding"),
    setupChoice: byId("setupChoice"),
    boundaryMap: byId("boundaryMap"),
    mapFallback: byId("mapFallback"),
    useDemoBoundary: byId("useDemoBoundary"),
    clearBoundary: byId("clearBoundary"),
    saveBoundary: byId("saveBoundary"),
    manualSetup: byId("manualSetup"),
    aiSetup: byId("aiSetup"),
    commitModal: byId("commitModal"),
    commitName: byId("commitName"),
    skipCommitName: byId("skipCommitName"),
    saveCommitName: byId("saveCommitName")
};
function init() {
    FarmRenderer.init(ui.canvas);
    BoundaryMap.init(ui, onBoundarySaved);
    bindUi();
    updateDrawControls();
    updateTimeline();
    updatePanel();
    window.setInterval(updateHud, 150);
}
function bindUi() {
    ui.selectMode.addEventListener("click", () => setMode("select"));
    ui.drawMode.addEventListener("click", () => setMode("draw"));
    ui.closeShape.addEventListener("click", finishDraft);
    ui.clearDraft.addEventListener("click", clearDraft);
    ui.zoomIn.addEventListener("click", () => zoomAtScreenPoint(canvasCenter(), 0.18));
    ui.zoomOut.addEventListener("click", () => zoomAtScreenPoint(canvasCenter(), -0.18));
    ui.rotateView.addEventListener("click", () => {
        state.rotation = (state.rotation + 90) % 360;
        state.zoom = G.clamp(state.zoom, FarmRenderer.getZoomLimits().min, FarmRenderer.getZoomLimits().max);
    });
    ui.resetView.addEventListener("click", () => {
        state.rotation = 0;
        fitFarmToView();
    });
    ui.settingsButton.addEventListener("click", () => {
        BoundaryMap.redraw();
        ui.onboarding.classList.remove("hidden");
        ui.setupChoice.classList.add("hidden");
    });
    document.querySelectorAll("[data-draw-type]").forEach((button) => {
        button.addEventListener("click", () => {
            state.drawType = button.dataset.drawType;
            document.querySelectorAll("[data-draw-type]").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
            clearDraft();
            updateDrawControls();
        });
    });
    document.querySelectorAll("[data-view]").forEach((button) => {
        button.addEventListener("click", () => {
            state.view = button.dataset.view;
            document.querySelectorAll("[data-view]").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
        });
    });
    document.querySelectorAll("[data-units]").forEach((button) => {
        button.addEventListener("click", () => {
            state.units = button.dataset.units;
            document.querySelectorAll("[data-units]").forEach((item) => item.classList.remove("active"));
            button.classList.add("active");
            markPanelDirty();
        });
    });
    ui.manualSetup.addEventListener("click", () => {
        DemoState.resetForManualPlan();
        ui.onboarding.classList.add("hidden");
        fitFarmToView();
        updateTimeline();
        markPanelDirty();
        setMode("draw");
    });
    ui.aiSetup.addEventListener("click", () => {
        DemoState.useAiPreset();
        ui.onboarding.classList.add("hidden");
        state.selectedId = "squash-slot";
        updateTimeline();
        markPanelDirty();
    });
    ui.timelineInput.addEventListener("input", (event) => {
        DemoState.loadCommit(Number(event.target.value));
        state.selectedId = DemoState.currentObjects()[0]?.id || null;
        updateTimeline();
        markPanelDirty();
    });
    ui.playTimeline.addEventListener("click", togglePlayback);
    ui.addTimelineEntry.addEventListener("click", openCommitModal);
    ui.skipCommitName.addEventListener("click", () => saveCommit(""));
    ui.saveCommitName.addEventListener("click", () => saveCommit(ui.commitName.value.trim()));
    ui.canvas.addEventListener("pointerdown", onPointerDown);
    ui.canvas.addEventListener("pointermove", onPointerMove);
    ui.canvas.addEventListener("pointerup", onPointerUp);
    ui.canvas.addEventListener("pointercancel", onPointerUp);
    ui.canvas.addEventListener("pointerleave", () => {
        state.mouse = null;
        onPointerUp();
    });
    ui.canvas.addEventListener("click", onCanvasClick);
    ui.canvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        zoomAtCursor(event);
    }, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    ui.objectDetails.addEventListener("click", onPanelClick);
    ui.objectDetails.addEventListener("input", onPanelInput);
    ui.objectDetails.addEventListener("change", onPanelChange);
    ui.panelTitle.addEventListener("dblclick", beginRenameSelected);
}
function onBoundarySaved(points) {
    DemoState.setBoundaryFromGeo(points);
    ui.setupChoice.classList.remove("hidden");
}
function setMode(mode) {
    state.mode = mode;
    ui.selectMode.classList.toggle("active", mode === "select");
    ui.drawMode.classList.toggle("active", mode === "draw");
    ui.canvas.style.cursor = mode === "draw" ? "crosshair" : "grab";
    updateDrawControls();
}
function updateDrawControls() {
    const pathMode = state.drawType === "path";
    ui.closeShape.textContent = pathMode ? "Enter" : "Close";
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
function zoomAtCursor(event) {
    const rect = ui.canvas.getBoundingClientRect();
    zoomAtScreenPoint({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    }, event.deltaY < 0 ? 0.18 : -0.18);
}
function canvasCenter() {
    const rect = ui.canvas.getBoundingClientRect();
    return { x: rect.width / 2, y: rect.height / 2 };
}
function fitFarmToView() {
    const limits = FarmRenderer.getZoomLimits();
    state.zoom = limits.min;
    state.panX = 0;
    state.panY = -18;
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
        return;
    }
    const hits = FarmRenderer.hitTestAll(world);
    state.selectedId = selectFromHitStack(world, hits);
    markPanelDirty();
}
function onKeyDown(event) {
    const target = event.target;
    const isTextInput = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    if (isTextInput) {
        if (event.key === "Escape" && !ui.commitModal.classList.contains("hidden"))
            ui.commitModal.classList.add("hidden");
        return;
    }
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
    ui.snapshotDate.textContent = formatDate(commit.timestamp);
    ui.snapshotLabel.textContent = commit.name;
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
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (!object) {
        ui.panelKicker.textContent = "Selection";
        ui.panelTitle.textContent = "No object selected";
        ui.objectDetails.innerHTML = `
        <div class="detail-grid">
          <div class="detail-item"><span>Timeline</span><strong>${state.commits.length} entries</strong></div>
          <div class="detail-item"><span>Draft</span><strong>${state.draft.length} points</strong></div>
          <div class="detail-item"><span>Boundary</span><strong>${DemoState.activeBoundary().length} points</strong></div>
          <div class="detail-item"><span>Source</span><strong>${state.boundaryGeo ? "Map" : "Demo"}</strong></div>
        </div>
        <div class="detail-list"><span>Draw flow</span><ul><li><strong>Enter confirms, Escape cancels</strong><em>all drawing modes</em></li></ul></div>
      `;
        return;
    }
    ui.panelKicker.textContent = labelForType(object.type);
    ui.panelTitle.textContent = object.label;
    if (object.type === "path") {
        ui.objectDetails.innerHTML = `
        <div class="detail-grid">
          <div class="detail-item"><span>Length</span><strong>${formatLength(pathLength(object.points))}</strong></div>
          <div class="detail-item"><span>Points</span><strong>${object.points.length}</strong></div>
          <div class="detail-item"><span>Status</span><strong>${object.attrs.status}</strong></div>
          <div class="detail-item"><span>Material</span><strong>${object.attrs.material}</strong></div>
        </div>
        ${deleteControl(object)}
      `;
        return;
    }
    const common = `
      <div class="detail-grid">
        <div class="detail-item"><span>Area</span><strong>${formatArea(G.polygonArea(object.polygon))}</strong></div>
        <div class="detail-item"><span>Dimensions</span><strong>${formatDimensions(object.polygon)}</strong></div>
        <div class="detail-item"><span>Status</span><strong>${object.attrs.status}</strong></div>
        <div class="detail-item"><span>Type</span><strong>${labelForType(object.type)}</strong></div>
      </div>
    `;
    if (object.type === "cropArea") {
        const children = state.objects.filter((item) => item.type === "cropField" && item.parentId === object.id);
        ui.objectDetails.innerHTML = `${common}
        <div class="detail-list">
          <span>Child crop fields</span>
          <ul>${children.length ? children.map((child) => `<li><strong>${child.label}</strong><em>${child.attrs.cropName || "Unassigned"}</em></li>`).join("") : "<li><strong>No crop fields yet</strong><em>draw inside area</em></li>"}</ul>
        </div>
        <div class="detail-list"><span>Design rule</span><ul><li><strong>One crop per child field</strong><em>clean timeline and spacing</em></li></ul></div>
        ${deleteControl(object)}
      `;
    }
    else if (object.type === "cropField") {
        ui.objectDetails.innerHTML = `${common}
        <div class="detail-grid">
          <div class="detail-item"><span>Crop</span><strong>${object.attrs.cropName || "Unassigned"}</strong></div>
          <label class="detail-item"><span>Count</span><input data-role="crop-count" type="number" min="0" step="1" value="${object.attrs.count || 0}" /></label>
          <div class="detail-item"><span>Parent</span><strong>${parentLabel(object.parentId)}</strong></div>
          <div class="detail-item"><span>Planted</span><strong>${object.attrs.planted || "Unassigned"}</strong></div>
        </div>
        ${cropTypeDropdown(object)}
        ${deleteControl(object)}
      `;
    }
    else if (object.type === "livestock") {
        ui.objectDetails.innerHTML = `${common}
        <div class="detail-grid">
          <div class="detail-item"><span>Species</span><strong>${object.attrs.species}</strong></div>
          <div class="detail-item"><span>Breed</span><strong>${object.attrs.breed}</strong></div>
          <div class="detail-item"><span>Headcount</span><strong>${object.attrs.count}</strong></div>
          <div class="detail-item"><span>Enclosure</span><strong>Fenced</strong></div>
        </div>
        ${livestockDropdowns(object)}
        ${deleteControl(object)}
      `;
    }
    else if (object.type === "structure") {
        ui.objectDetails.innerHTML = `${common}
        <div class="detail-grid">
          <div class="detail-item"><span>Kind</span><strong>${object.attrs.kind}</strong></div>
          <div class="detail-item"><span>Material</span><strong>${object.attrs.material}</strong></div>
          <div class="detail-item"><span>Height</span><strong>${formatLength(object.height)}</strong></div>
          <div class="detail-item"><span>Footprint</span><strong>${formatArea(G.polygonArea(object.polygon))}</strong></div>
        </div>
        ${catalogEditor("structure")}
        ${deleteControl(object)}
      `;
    }
}
function beginRenameSelected() {
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (!object)
        return;
    ui.panelTitle.contentEditable = "true";
    ui.panelTitle.classList.add("renaming");
    ui.panelTitle.focus();
    document.getSelection()?.selectAllChildren(ui.panelTitle);
    const finish = () => {
        ui.panelTitle.contentEditable = "false";
        ui.panelTitle.classList.remove("renaming");
        const nextName = ui.panelTitle.textContent.trim();
        if (nextName)
            object.label = nextName;
        ui.panelTitle.removeEventListener("blur", finish);
        ui.panelTitle.removeEventListener("keydown", onRenameKey);
        markPanelDirty();
    };
    const onRenameKey = (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            ui.panelTitle.blur();
        }
        if (event.key === "Escape") {
            event.preventDefault();
            ui.panelTitle.textContent = object.label;
            ui.panelTitle.blur();
        }
    };
    ui.panelTitle.addEventListener("blur", finish);
    ui.panelTitle.addEventListener("keydown", onRenameKey);
}
function deleteControl(object) {
    const warning = object.type === "cropArea" ? "Deletes child crop fields too" : "Removes this object";
    return `
      <div class="slot-actions">
        <button class="danger-button" data-action="delete-object" type="button">Delete</button>
        <div class="detail-list"><span>Delete behavior</span><ul><li><strong>${warning}</strong><em>snapshot with + if needed</em></li></ul></div>
      </div>
    `;
}
function cropTypeDropdown(object) {
    return `
      <div class="detail-list">
        <span>Crop type</span>
        <label class="select-shell">
          <select data-role="crop-type">
            <option value="">Unassigned</option>
            ${CATALOG.crops.map((crop) => `<option value="${crop.key}" ${object.attrs.cropKey === crop.key ? "selected" : ""}>${crop.name}</option>`).join("")}
          </select>
        </label>
      </div>
    `;
}
function livestockDropdowns(object) {
    const species = CATALOG.livestock.find((item) => item.name === object.attrs.species) || CATALOG.livestock[0];
    const breeds = species?.breeds || [object.attrs.breed].filter(Boolean);
    return `
      <div class="detail-list">
        <span>Livestock type</span>
        <label class="select-shell">
          <select data-role="livestock-species">
            ${CATALOG.livestock.map((item) => `<option value="${item.key}" ${item.name === object.attrs.species ? "selected" : ""}>${item.name}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="detail-list">
        <span>Breed</span>
        <label class="select-shell">
          <select data-role="livestock-breed">
            ${breeds.map((breed) => `<option value="${breed}" ${breed === object.attrs.breed ? "selected" : ""}>${breed}</option>`).join("")}
          </select>
        </label>
      </div>
    `;
}
function catalogEditor(mode) {
    if (state.pendingCatalogMode !== mode) {
        return `<div class="slot-actions"><button data-action="open-catalog" data-mode="${mode}" type="button">Add / Change ${mode}</button></div>`;
    }
    const items = mode === "crop" ? CATALOG.crops : mode === "livestock" ? CATALOG.livestock : CATALOG.structures;
    return `
      <div class="detail-list">
        <span>${mode} catalog</span>
        <div class="add-entry-row">
          <input data-role="catalog-search" type="search" placeholder="Search or type custom ${mode}" />
          <button data-action="custom-entry" data-mode="${mode}" type="button">Custom</button>
        </div>
        <div class="catalog-suggestions">
          ${items.slice(0, 6).map((item) => `<button data-action="select-catalog" data-mode="${mode}" data-key="${item.key}" type="button">${item.name}</button>`).join("")}
        </div>
      </div>
    `;
}
function onPanelClick(event) {
    const button = event.target.closest("button");
    if (!button)
        return;
    const action = button.dataset.action;
    const mode = button.dataset.mode;
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (!object)
        return;
    if (action === "open-catalog") {
        state.pendingCatalogMode = mode;
        markPanelDirty();
    }
    if (action === "select-catalog") {
        applyCatalogEntry(object, mode, button.dataset.key);
        state.pendingCatalogMode = null;
        markPanelDirty();
    }
    if (action === "custom-entry") {
        const input = ui.objectDetails.querySelector("[data-role='catalog-search']");
        applyCustomEntry(object, mode, input?.value.trim() || `Custom ${mode}`);
        state.pendingCatalogMode = null;
        markPanelDirty();
    }
    if (action === "delete-object") {
        DemoState.deleteObject(object.id);
        state.lastHitCycle = null;
        markPanelDirty();
    }
}
function onPanelInput(event) {
    const countInput = event.target.closest("[data-role='crop-count']");
    if (countInput) {
        const object = state.objects.find((item) => item.id === state.selectedId);
        if (object && object.type === "cropField") {
            object.attrs.count = Math.max(0, Number(countInput.value) || 0);
        }
        return;
    }
    const input = event.target.closest("[data-role='catalog-search']");
    if (!input)
        return;
    const mode = state.pendingCatalogMode;
    const list = mode === "crop" ? CATALOG.crops : mode === "livestock" ? CATALOG.livestock : CATALOG.structures;
    const query = input.value.trim().toLowerCase();
    const suggestions = ui.objectDetails.querySelector(".catalog-suggestions");
    if (!suggestions)
        return;
    suggestions.innerHTML = list
        .filter((item) => item.name.toLowerCase().includes(query))
        .slice(0, 6)
        .map((item) => `<button data-action="select-catalog" data-mode="${mode}" data-key="${item.key}" type="button">${item.name}</button>`)
        .join("");
}
function onPanelChange(event) {
    const countInput = event.target.closest("[data-role='crop-count']");
    const cropType = event.target.closest("[data-role='crop-type']");
    const livestockSpecies = event.target.closest("[data-role='livestock-species']");
    const livestockBreed = event.target.closest("[data-role='livestock-breed']");
    const object = state.objects.find((item) => item.id === state.selectedId);
    if (!object)
        return;
    if (countInput && object.type === "cropField") {
        object.attrs.count = Math.max(0, Number(countInput.value) || 0);
        markPanelDirty();
        return;
    }
    if (cropType && object.type === "cropField") {
        if (!cropType.value) {
            object.label = "Unpopulated Crop Field";
            object.attrs.cropKey = null;
            object.attrs.cropName = "";
            object.attrs.count = 0;
            object.attrs.visual = "generic";
            object.attrs.growth = 0.2;
            object.attrs.status = "Needs crop details";
        }
        else {
            applyCatalogEntry(object, "crop", cropType.value);
        }
        markPanelDirty();
        return;
    }
    if (livestockSpecies && object.type === "livestock") {
        applyCatalogEntry(object, "livestock", livestockSpecies.value);
        markPanelDirty();
        return;
    }
    if (livestockBreed && object.type === "livestock") {
        object.attrs.breed = livestockBreed.value;
        markPanelDirty();
    }
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
function updateTimeline() {
    ui.timelineInput.max = String(Math.max(0, state.commits.length - 1));
    ui.timelineInput.value = String(state.commitIndex);
    ui.timelineMarkers.style.setProperty("--marker-count", String(state.commits.length));
    ui.timelineMarkers.innerHTML = state.commits
        .map((commit, index) => `<button class="${index === state.commitIndex ? "active" : ""}" data-commit-index="${index}" type="button">${commit.name}</button>`)
        .join("");
    ui.timelineMarkers.querySelectorAll("button").forEach((button) => {
        button.addEventListener("click", () => {
            DemoState.loadCommit(Number(button.dataset.commitIndex));
            updateTimeline();
            markPanelDirty();
        });
    });
}
function openCommitModal() {
    ui.commitName.value = "";
    ui.commitModal.classList.remove("hidden");
    ui.commitName.focus();
}
function saveCommit(name) {
    DemoState.createCommit(name);
    ui.commitModal.classList.add("hidden");
    updateTimeline();
    markPanelDirty();
}
function togglePlayback() {
    state.playing = !state.playing;
    ui.playTimeline.textContent = state.playing ? "Pause" : "Play";
    if (state.playing) {
        state.playTimer = window.setInterval(() => {
            DemoState.loadCommit((state.commitIndex + 1) % state.commits.length);
            updateTimeline();
            markPanelDirty();
        }, 1200);
    }
    else {
        window.clearInterval(state.playTimer);
        state.playTimer = null;
    }
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
init();
//# sourceMappingURL=app.js.map