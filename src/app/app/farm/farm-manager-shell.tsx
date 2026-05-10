"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./farm-manager-shell.module.css";

type FarmManagerChromeState = {
  mode: "select" | "draw";
  drawType: "cropArea" | "cropField" | "livestock" | "structure" | "path";
  view: "grid" | "satellite";
  units: "ft" | "m";
  onboardingVisible: boolean;
  setupChoiceVisible: boolean;
  ready: boolean;
  backendMessage: string | null;
  backendError: boolean;
};

type FarmManagerPoint = [number, number];
type FarmObjectType = "cropArea" | "cropField" | "livestock" | "structure" | "path";

type FarmObject = {
  id: string;
  label: string;
  type: FarmObjectType;
  attrs: Record<string, unknown>;
  polygon?: FarmManagerPoint[];
  points?: FarmManagerPoint[];
  parentId?: string | null;
  height?: number;
};

type FarmCommit = {
  id: string;
  timestamp: string;
  name: string;
  autoName: string;
  objects: FarmObject[];
};

type FarmCatalog = {
  crops: Array<{ key: string; name: string }>;
  livestock: Array<{ key: string; name: string; breeds: string[] }>;
  structures: Array<{ key: string; name: string }>;
};

type FarmManagerContentState = {
  selectedObject: FarmObject | null;
  objects: FarmObject[];
  timeline: {
    commits: FarmCommit[];
    commitIndex: number;
    playing: boolean;
    snapshotDate: string;
    snapshotLabel: string;
  };
  draftCount: number;
  boundaryPointCount: number;
  boundarySource: "Map" | "Demo";
  units: "ft" | "m";
  catalog: FarmCatalog;
  commitModalOpen: boolean;
  savingCommit: boolean;
};

type FarmManagerActions = {
  setMode: (mode: FarmManagerChromeState["mode"]) => void;
  setDrawType: (drawType: FarmManagerChromeState["drawType"]) => void;
  setView: (view: FarmManagerChromeState["view"]) => void;
  setUnits: (units: FarmManagerChromeState["units"]) => void;
  finishDraft: () => void;
  clearDraft: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  rotateView: () => void;
  resetView: () => void;
  openBoundarySettings: () => void;
  useDemoBoundary: () => void;
  clearBoundary: () => void;
  saveBoundary: () => void;
  startManualSetup: () => void;
  startAiSetup: () => void;
  loadCommit: (index: number) => void;
  togglePlayback: () => void;
  openCommitModal: () => void;
  closeCommitModal: () => void;
  saveCommit: (name: string) => Promise<boolean>;
  renameSelectedObject: (name: string) => void;
  deleteSelectedObject: () => void;
  setCropCount: (count: number) => void;
  setCropType: (cropKey: string) => void;
  setLivestockSpecies: (speciesKey: string) => void;
  setLivestockBreed: (breed: string) => void;
  setStructureType: (structureKey: string) => void;
  handleCanvasPointerDown: (event: PointerEvent) => void;
  handleCanvasPointerMove: (event: PointerEvent) => void;
  handleCanvasPointerUp: (event: PointerEvent) => void;
  handleCanvasPointerLeave: () => void;
  handleCanvasClick: (event: MouseEvent) => void;
  handleCanvasWheel: (event: WheelEvent) => void;
  handleKeyDown: (event: KeyboardEvent) => void;
};

type FarmManagerMount = {
  cleanup: () => void;
  actions: FarmManagerActions;
  getChromeState: () => FarmManagerChromeState;
  getContentState: () => FarmManagerContentState;
};

type FarmManagerRuntime = {
  mountFarmManager: (
    root: ParentNode,
    options: {
      onChromeChange?: (state: FarmManagerChromeState) => void;
      onContentChange?: (state: FarmManagerContentState) => void;
    },
  ) => FarmManagerMount;
};

const emptyContent: FarmManagerContentState = {
  selectedObject: null,
  objects: [],
  timeline: {
    commits: [],
    commitIndex: 0,
    playing: false,
    snapshotDate: "",
    snapshotLabel: "",
  },
  draftCount: 0,
  boundaryPointCount: 0,
  boundarySource: "Demo",
  units: "ft",
  catalog: { crops: [], livestock: [], structures: [] },
  commitModalOpen: false,
  savingCommit: false,
};

const mapLibreCssUrl = "https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.css";
const mapLibreScriptUrl = "https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.js";

export function FarmManagerShell() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<FarmManagerMount | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [commitName, setCommitName] = useState("");
  const [chrome, setChrome] = useState<FarmManagerChromeState>({
    mode: "select",
    drawType: "cropArea",
    view: "grid",
    units: "ft",
    onboardingVisible: true,
    setupChoiceVisible: false,
    ready: false,
    backendMessage: "Loading saved farm state...",
    backendError: false,
  });
  const [content, setContent] = useState<FarmManagerContentState>(emptyContent);

  useEffect(() => {
    let cancelled = false;

    async function startFarmManager() {
      try {
        await loadStylesheet("farm-manager-maplibre-css", mapLibreCssUrl);
        await loadScript("farm-manager-maplibre-js", mapLibreScriptUrl).catch(() => undefined);

        const loadRuntime = new Function("path", "return import(path)") as (path: string) => Promise<FarmManagerRuntime>;
        const runtime = await loadRuntime("/farm-manager/dist/app.js");

        if (cancelled || !rootRef.current) return;
        const mount = runtime.mountFarmManager(rootRef.current, {
          onChromeChange: setChrome,
          onContentChange: setContent,
        });
        mountRef.current = mount;
        setChrome(mount.getChromeState());
        setContent(mount.getContentState());
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Unable to load farm manager");
      }
    }

    void startFarmManager();

    return () => {
      cancelled = true;
      mountRef.current?.cleanup();
      mountRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      mountRef.current?.actions.handleKeyDown(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const actions = mountRef.current?.actions;

  async function handleSaveCommit(name: string) {
    const saved = await actions?.saveCommit(name);
    if (saved) setCommitName("");
  }

  return (
    <div ref={rootRef} className={`farm-manager-root ${styles.host}`}>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <span className="eyebrow">Orchard Ridge</span>
              <strong>Homestead Map</strong>
            </div>
          </div>

          <div className="toolbar-group">
            <div className="segmented" aria-label="Interaction mode">
              <button id="selectMode" className={chrome.mode === "select" ? "active" : ""} type="button" onClick={() => actions?.setMode("select")}>Select</button>
              <button id="drawMode" className={chrome.mode === "draw" ? "active" : ""} type="button" onClick={() => actions?.setMode("draw")}>Draw</button>
            </div>

            <div className="segmented" aria-label="Object type">
              <button data-draw-type="cropArea" className={chrome.drawType === "cropArea" ? "active" : ""} type="button" onClick={() => actions?.setDrawType("cropArea")}>Crop Area</button>
              <button data-draw-type="cropField" className={chrome.drawType === "cropField" ? "active" : ""} type="button" onClick={() => actions?.setDrawType("cropField")}>Crop Field</button>
              <button data-draw-type="livestock" className={chrome.drawType === "livestock" ? "active" : ""} type="button" onClick={() => actions?.setDrawType("livestock")}>Livestock</button>
              <button data-draw-type="structure" className={chrome.drawType === "structure" ? "active" : ""} type="button" onClick={() => actions?.setDrawType("structure")}>Structure</button>
              <button data-draw-type="path" className={chrome.drawType === "path" ? "active" : ""} type="button" onClick={() => actions?.setDrawType("path")}>Path</button>
            </div>

            <button id="closeShape" type="button" onClick={() => actions?.finishDraft()}>{chrome.drawType === "path" ? "Enter" : "Close"}</button>
            <button id="clearDraft" type="button" onClick={() => actions?.clearDraft()}>Clear</button>
          </div>

          <div className="toolbar-group right">
            <div className="segmented" aria-label="Map view">
              <button data-view="grid" className={chrome.view === "grid" ? "active" : ""} type="button" onClick={() => actions?.setView("grid")}>Grid</button>
              <button data-view="satellite" className={chrome.view === "satellite" ? "active" : ""} type="button" onClick={() => actions?.setView("satellite")}>Satellite</button>
            </div>

            <div className="segmented" aria-label="Measurement units">
              <button data-units="ft" className={chrome.units === "ft" ? "active" : ""} type="button" onClick={() => actions?.setUnits("ft")}>ft</button>
              <button data-units="m" className={chrome.units === "m" ? "active" : ""} type="button" onClick={() => actions?.setUnits("m")}>m</button>
            </div>

            <button id="zoomOut" type="button" onClick={() => actions?.zoomOut()}>-</button>
            <button id="zoomIn" type="button" onClick={() => actions?.zoomIn()}>+</button>
            <button id="rotateView" type="button" onClick={() => actions?.rotateView()}>Rotate</button>
            <button id="resetView" type="button" onClick={() => actions?.resetView()}>Reset</button>
            <button id="settingsButton" type="button" onClick={() => actions?.openBoundarySettings()}>Settings</button>
          </div>
        </header>

        <main className="stage">
          <canvas
            id="farmCanvas"
            aria-label="Interactive low-poly farm map"
            onPointerDown={(event) => actions?.handleCanvasPointerDown(event.nativeEvent)}
            onPointerMove={(event) => actions?.handleCanvasPointerMove(event.nativeEvent)}
            onPointerUp={(event) => actions?.handleCanvasPointerUp(event.nativeEvent)}
            onPointerCancel={(event) => actions?.handleCanvasPointerUp(event.nativeEvent)}
            onPointerLeave={() => actions?.handleCanvasPointerLeave()}
            onClick={(event) => actions?.handleCanvasClick(event.nativeEvent)}
            onWheel={(event) => actions?.handleCanvasWheel(event.nativeEvent)}
          />

          <aside className="object-panel" aria-live="polite">
            <FarmObjectPanel content={content} actions={actions} />
          </aside>

          <div className="snapshot-chip">
            <span id="snapshotDate">{content.timeline.snapshotDate}</span>
            <strong id="snapshotLabel">{content.timeline.snapshotLabel}</strong>
          </div>
        </main>

        <footer className="timeline">
          <button id="playTimeline" type="button" onClick={() => actions?.togglePlayback()}>
            {content.timeline.playing ? "Pause" : "Play"}
          </button>
          <input
            id="timelineInput"
            type="range"
            min="0"
            max={Math.max(0, content.timeline.commits.length - 1)}
            value={content.timeline.commitIndex}
            step="1"
            onChange={(event) => actions?.loadCommit(Number(event.target.value))}
          />
          <div
            id="timelineMarkers"
            className="timeline-markers"
            style={{ ["--marker-count" as string]: String(Math.max(1, content.timeline.commits.length)) }}
          >
            {content.timeline.commits.map((commit, index) => (
              <button
                key={commit.id}
                className={index === content.timeline.commitIndex ? "active" : ""}
                type="button"
                onClick={() => actions?.loadCommit(index)}
              >
                {commit.name}
              </button>
            ))}
          </div>
          <button id="addTimelineEntry" className="timeline-add" type="button" onClick={() => actions?.openCommitModal()}>
            +
          </button>
        </footer>

        <section id="onboarding" className={`onboarding ${chrome.onboardingVisible ? "" : "hidden"}`}>
          <div className="onboarding-card">
            <div className="wizard-copy">
              <span className="eyebrow">Step 1</span>
              <h1>Draw Homestead Boundary</h1>
              <p>
                Click points on the real map to define the farm boundary. The saved boundary becomes the local low-poly
                planning board.
              </p>
            </div>
            <div className="map-shell">
              <div id="boundaryMap" />
              <div id="mapFallback" className="map-fallback hidden">
                <strong>Map tiles unavailable</strong>
                <span>Use the demo boundary to continue without live map tiles.</span>
              </div>
              <div className="map-tools">
                <button id="useDemoBoundary" type="button" onClick={() => actions?.useDemoBoundary()}>Demo Boundary</button>
                <button id="clearBoundary" type="button" onClick={() => actions?.clearBoundary()}>Clear</button>
                <button id="saveBoundary" type="button" onClick={() => actions?.saveBoundary()}>Save Boundary</button>
              </div>
            </div>
          </div>

          <div id="setupChoice" className={`setup-choice ${chrome.setupChoiceVisible ? "" : "hidden"}`}>
            <div className="choice-card">
              <span className="eyebrow">Step 2</span>
              <h2>Set Up Farm</h2>
              <div className="choice-grid">
                <button id="manualSetup" className="choice-button" type="button" onClick={() => actions?.startManualSetup()}>
                  <strong>Manual</strong>
                  <span>Draw slots, then populate crop fields, paddocks, structures, and paths.</span>
                </button>
                <button id="aiSetup" className="choice-button" type="button" onClick={() => actions?.startAiSetup()}>
                  <strong>AI Draft</strong>
                  <span>Future Gemini partitioning flow. This demo loads a preset recommendation.</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <div id="commitModal" className={`modal ${content.commitModalOpen ? "" : "hidden"}`} role="dialog" aria-modal="true">
          <div className="modal-card">
            <span className="eyebrow">Timeline</span>
            <h2>Create Timeline Entry</h2>
            <p>Name the current farm state, or skip to use an automatic timestamp label.</p>
            <input
              id="commitName"
              type="text"
              placeholder="Optional name"
              value={commitName}
              onChange={(event) => setCommitName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleSaveCommit(commitName.trim());
                if (event.key === "Escape") actions?.closeCommitModal();
              }}
            />
            <div className="modal-actions">
              <button id="skipCommitName" type="button" disabled={content.savingCommit} onClick={() => void handleSaveCommit("")}>
                Skip
              </button>
              <button
                id="saveCommitName"
                className="active"
                type="button"
                disabled={content.savingCommit}
                onClick={() => void handleSaveCommit(commitName.trim())}
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {chrome.backendMessage ? (
          <div className={`backend-gate ${chrome.backendError ? "backend-error" : ""}`} role="status" aria-live="polite">
            <div className="backend-card">
              <span>{chrome.backendError ? "Backend error" : "Backend"}</span>
              <strong>{chrome.backendMessage}</strong>
              {chrome.backendError ? <em>Fix the backend response, then refresh this tab.</em> : null}
            </div>
          </div>
        ) : null}
      </div>

      {loadError ? <div className={styles.loadError}>Farm manager failed to load: {loadError}</div> : null}
    </div>
  );
}

function FarmObjectPanel({ content, actions }: { content: FarmManagerContentState; actions?: FarmManagerActions }) {
  const object = content.selectedObject;
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  function startRename() {
    if (!object) return;
    setDraftName(object.label);
    setRenaming(true);
  }

  function finishRename(save: boolean) {
    if (save && draftName.trim()) actions?.renameSelectedObject(draftName.trim());
    setRenaming(false);
  }

  if (!object) {
    return (
      <>
        <div className="panel-header">
          <span id="panelKicker">Selection</span>
          <strong id="panelTitle">No object selected</strong>
        </div>
        <div id="objectDetails" className="details">
          <div className="detail-grid">
            <DetailItem label="Timeline" value={`${content.timeline.commits.length} entries`} />
            <DetailItem label="Draft" value={`${content.draftCount} points`} />
            <DetailItem label="Boundary" value={`${content.boundaryPointCount} points`} />
            <DetailItem label="Source" value={content.boundarySource} />
          </div>
          <div className="detail-list">
            <span>Draw flow</span>
            <ul><li><strong>Enter confirms, Escape cancels</strong><em>all drawing modes</em></li></ul>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="panel-header">
        <span id="panelKicker">{labelForType(object.type)}</span>
        {renaming ? (
          <input
            id="panelTitle"
            className="renaming"
            value={draftName}
            autoFocus
            onBlur={() => finishRename(true)}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") finishRename(true);
              if (event.key === "Escape") finishRename(false);
            }}
          />
        ) : (
          <strong id="panelTitle" onDoubleClick={startRename}>{object.label}</strong>
        )}
      </div>
      <div id="objectDetails" className="details">
        <ObjectDetails object={object} content={content} actions={actions} />
      </div>
    </>
  );
}

function ObjectDetails({ object, content, actions }: { object: FarmObject; content: FarmManagerContentState; actions?: FarmManagerActions }) {
  if (object.type === "path") {
    return (
      <>
        <div className="detail-grid">
          <DetailItem label="Length" value={formatLength(pathLength(object.points ?? []), content.units)} />
          <DetailItem label="Points" value={String(object.points?.length ?? 0)} />
          <DetailItem label="Status" value={stringAttr(object, "status")} />
          <DetailItem label="Material" value={stringAttr(object, "material")} />
        </div>
        <DeleteControl object={object} actions={actions} />
      </>
    );
  }

  const polygon = object.polygon ?? [];
  const common = (
    <div className="detail-grid">
      <DetailItem label="Area" value={formatArea(polygonArea(polygon), content.units)} />
      <DetailItem label="Dimensions" value={formatDimensions(polygon, content.units)} />
      <DetailItem label="Status" value={stringAttr(object, "status")} />
      <DetailItem label="Type" value={labelForType(object.type)} />
    </div>
  );

  if (object.type === "cropArea") {
    const children = content.objects.filter((item) => item.type === "cropField" && item.parentId === object.id);
    return (
      <>
        {common}
        <div className="detail-list">
          <span>Child crop fields</span>
          <ul>
            {children.length ? children.map((child) => (
              <li key={child.id}><strong>{child.label}</strong><em>{stringAttr(child, "cropName") || "Unassigned"}</em></li>
            )) : <li><strong>No crop fields yet</strong><em>draw inside area</em></li>}
          </ul>
        </div>
        <div className="detail-list"><span>Design rule</span><ul><li><strong>One crop per child field</strong><em>clean timeline and spacing</em></li></ul></div>
        <DeleteControl object={object} actions={actions} />
      </>
    );
  }

  if (object.type === "cropField") {
    return (
      <>
        {common}
        <div className="detail-grid">
          <DetailItem label="Crop" value={stringAttr(object, "cropName") || "Unassigned"} />
          <label className="detail-item">
            <span>Count</span>
            <input type="number" min="0" step="1" value={numberAttr(object, "count")} onChange={(event) => actions?.setCropCount(Number(event.target.value))} />
          </label>
          <DetailItem label="Parent" value={parentLabel(content.objects, object.parentId)} />
          <DetailItem label="Planted" value={stringAttr(object, "planted") || "Unassigned"} />
        </div>
        <div className="detail-list">
          <span>Crop type</span>
          <label className="select-shell">
            <select value={stringAttr(object, "cropKey")} onChange={(event) => actions?.setCropType(event.target.value)}>
              <option value="">Unassigned</option>
              {content.catalog.crops.map((crop) => <option key={crop.key} value={crop.key}>{crop.name}</option>)}
            </select>
          </label>
        </div>
        <DeleteControl object={object} actions={actions} />
      </>
    );
  }

  if (object.type === "livestock") {
    const species = content.catalog.livestock.find((item) => item.name === stringAttr(object, "species")) ?? content.catalog.livestock[0];
    const breeds = species?.breeds ?? [stringAttr(object, "breed")].filter(Boolean);
    return (
      <>
        {common}
        <div className="detail-grid">
          <DetailItem label="Species" value={stringAttr(object, "species")} />
          <DetailItem label="Breed" value={stringAttr(object, "breed")} />
          <DetailItem label="Headcount" value={String(numberAttr(object, "count"))} />
          <DetailItem label="Enclosure" value="Fenced" />
        </div>
        <div className="detail-list">
          <span>Livestock type</span>
          <label className="select-shell">
            <select value={species?.key ?? ""} onChange={(event) => actions?.setLivestockSpecies(event.target.value)}>
              {content.catalog.livestock.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
            </select>
          </label>
        </div>
        <div className="detail-list">
          <span>Breed</span>
          <label className="select-shell">
            <select value={stringAttr(object, "breed")} onChange={(event) => actions?.setLivestockBreed(event.target.value)}>
              {breeds.map((breed) => <option key={breed} value={breed}>{breed}</option>)}
            </select>
          </label>
        </div>
        <DeleteControl object={object} actions={actions} />
      </>
    );
  }

  return (
    <>
      {common}
      <div className="detail-grid">
        <DetailItem label="Kind" value={stringAttr(object, "kind")} />
        <DetailItem label="Material" value={stringAttr(object, "material")} />
        <DetailItem label="Height" value={formatLength(object.height ?? 0, content.units)} />
        <DetailItem label="Footprint" value={formatArea(polygonArea(polygon), content.units)} />
      </div>
      <div className="detail-list">
        <span>Structure type</span>
        <label className="select-shell">
          <select value={structureKeyFor(content.catalog, object)} onChange={(event) => actions?.setStructureType(event.target.value)}>
            {content.catalog.structures.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
          </select>
        </label>
      </div>
      <DeleteControl object={object} actions={actions} />
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div className="detail-item"><span>{label}</span><strong>{value}</strong></div>;
}

function DeleteControl({ object, actions }: { object: FarmObject; actions?: FarmManagerActions }) {
  const warning = object.type === "cropArea" ? "Deletes child crop fields too" : "Removes this object";
  return (
    <div className="slot-actions">
      <button className="danger-button" type="button" onClick={() => actions?.deleteSelectedObject()}>Delete</button>
      <div className="detail-list"><span>Delete behavior</span><ul><li><strong>{warning}</strong><em>snapshot with + if needed</em></li></ul></div>
    </div>
  );
}

function labelForType(type: FarmObjectType) {
  return {
    cropArea: "Crop Area",
    cropField: "Crop Field",
    livestock: "Livestock",
    structure: "Structure",
    path: "Path",
  }[type];
}

function stringAttr(object: FarmObject, key: string) {
  const value = object.attrs[key];
  return typeof value === "string" ? value : "";
}

function numberAttr(object: FarmObject, key: string) {
  const value = Number(object.attrs[key]);
  return Number.isFinite(value) ? value : 0;
}

function parentLabel(objects: FarmObject[], parentId: string | null | undefined) {
  return objects.find((object) => object.id === parentId)?.label || "None";
}

function structureKeyFor(catalog: FarmCatalog, object: FarmObject) {
  const kind = stringAttr(object, "kind");
  return catalog.structures.find((item) => item.name === kind)?.key ?? catalog.structures[0]?.key ?? "";
}

function pathLength(points: FarmManagerPoint[]) {
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    total += distance(points[index], points[index + 1]);
  }
  return total;
}

function polygonArea(points: FarmManagerPoint[]) {
  if (points.length < 3) return 0;
  const area = points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2;
  return Math.abs(area);
}

function formatDimensions(points: FarmManagerPoint[], units: FarmManagerContentState["units"]) {
  if (!points.length) return `0 ${units} x 0 ${units}`;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return `${formatLength(Math.max(...xs) - Math.min(...xs), units)} x ${formatLength(Math.max(...ys) - Math.min(...ys), units)}`;
}

function formatArea(areaFt: number, units: FarmManagerContentState["units"]) {
  if (units === "m") return `${Math.round(areaFt * 0.092903)} m2`;
  return `${Math.round(areaFt).toLocaleString()} ft2`;
}

function formatLength(lengthFt: number, units: FarmManagerContentState["units"]) {
  if (units === "m") return `${(lengthFt * 0.3048).toFixed(1)} m`;
  return `${lengthFt.toFixed(1)} ft`;
}

function distance(left: FarmManagerPoint, right: FarmManagerPoint) {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function loadStylesheet(id: string, href: string): Promise<void> {
  const existing = document.getElementById(id) as HTMLLinkElement | null;
  if (existing) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener("error", () => reject(new Error(`Unable to load ${href}`)), { once: true });
    document.head.appendChild(link);
  });
}

function loadScript(id: string, src: string): Promise<void> {
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error(`Unable to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}
