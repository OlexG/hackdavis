"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { PixelGlyph, type PixelGlyphName } from "../_components/icons";
import { MagicGenerateOverlay } from "../intelligence/magic-generate-overlay";
import styles from "./farm-manager-shell.module.css";

type FarmManagerChromeState = {
  mode: "select" | "move" | "edit" | "draw";
  drawType: "cropArea" | "cropField" | "livestock" | "structure" | "path";
  view: "grid" | "satellite";
  units: "ft" | "m";
  rotation: number;
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

type FarmAiDraftPreferences = {
  budgetCents: number;
  goal: "food-security" | "profit" | "low-maintenance" | "balanced" | "family-kitchen" | "market-garden";
  householdSize: number;
  weeklyHours: number;
  experience: "beginner" | "intermediate" | "advanced";
  includeLivestock: boolean;
  includeStructures: boolean;
  irrigation: "none" | "hose" | "drip" | "sprinkler";
  waterPriority: "low-water" | "balanced" | "high-production";
  season: "spring" | "summer" | "fall" | "winter" | "year-round";
  dietaryPreferences: string[];
  excludedCropKeys: string[];
  preferredCropKeys: string[];
  notes: string;
};

type FarmCatalog = {
  crops: Array<{
    key: string;
    name: string;
    scientificName?: string;
    description?: string;
    cropCategory?: string;
    lifeSpan?: string;
    idealSpaceSqft?: number;
    harvestCycles?: number;
    soilPhMin?: number;
    soilPhMax?: number;
    lightRequirement?: string;
    soilTexture?: string;
    waterConsumptionMl?: number;
    rainfallMaxMl?: number;
    howToGrow?: string;
    insectControl?: string;
    tips?: string;
  }>;
  livestock: Array<{
    key: string;
    name: string;
    breeds: string[];
    description?: string;
    idealSpaceSqft?: number;
    feed?: string;
    careInstructions?: string;
    meatYield?: number;
    yieldTypes?: string[];
    yieldFrequency?: string;
  }>;
  structures: Array<{ key: string; name: string }>;
};

type CatalogSearchItem = {
  key: string;
  name: string;
  subtitle?: string;
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
  rotateBy?: (degrees: number) => void;
  resetView: () => void;
  openBoundarySettings: () => void;
  useDemoBoundary: () => void;
  clearBoundary: () => void;
  saveBoundary: () => void;
  startManualSetup: () => void;
  startAiSetup: (preferences: FarmAiDraftPreferences) => Promise<boolean>;
  loadCommit: (index: number) => void;
  togglePlayback: () => void;
  openCommitModal: () => void;
  closeCommitModal: () => void;
  saveCommit: (name: string) => Promise<boolean>;
  renameSelectedObject: (name: string) => void;
  deleteSelectedObject: () => void;
  setCropCount: (count: number) => void;
  setCropType: (cropKey: string) => void;
  setCustomCropName: (name: string) => void;
  setLivestockSpecies: (speciesKey: string) => void;
  setCustomLivestockName: (name: string) => void;
  setLivestockBreed: (breed: string) => void;
  setLivestockCount: (count: number) => void;
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

const defaultAiDraftPreferences: FarmAiDraftPreferences = {
  budgetCents: 75000,
  goal: "balanced",
  householdSize: 4,
  weeklyHours: 8,
  experience: "beginner",
  includeLivestock: false,
  includeStructures: true,
  irrigation: "hose",
  waterPriority: "balanced",
  season: currentSeason(),
  dietaryPreferences: [],
  excludedCropKeys: [],
  preferredCropKeys: [],
  notes: "",
};

function currentSeason(): FarmAiDraftPreferences["season"] {
  const month = new Date().getMonth();
  if (month <= 1 || month === 11) return "winter";
  if (month <= 4) return "spring";
  if (month <= 7) return "summer";
  return "fall";
}

export function FarmManagerShell() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<FarmManagerMount | null>(null);
  const rotationDragRef = useRef<{ pointerId: number; x: number; moved: boolean } | null>(null);
  const suppressCubeClickRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [commitName, setCommitName] = useState("");
  const [aiDraftOpen, setAiDraftOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiDraftPreferences, setAiDraftPreferences] = useState<FarmAiDraftPreferences>(defaultAiDraftPreferences);
  const [actions, setActions] = useState<FarmManagerActions | undefined>(undefined);
  const [chrome, setChrome] = useState<FarmManagerChromeState>({
    mode: "select",
    drawType: "cropArea",
    view: "satellite",
    units: "ft",
    rotation: 0,
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
        const runtime = await loadRuntime(`/farm-manager/dist/app.js?v=${Date.now()}`);

        if (cancelled || !rootRef.current) return;
        const mount = runtime.mountFarmManager(rootRef.current, {
          onChromeChange: setChrome,
          onContentChange: setContent,
        });
        mountRef.current = mount;
        setActions(mount.actions);
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
      setActions(undefined);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      mountRef.current?.actions.handleKeyDown(event);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleSaveCommit(name: string) {
    const saved = await actions?.saveCommit(name);
    if (saved) setCommitName("");
  }

  async function handleGenerateAiDraft() {
    setAiGenerating(true);
    setAiDraftOpen(false);
    const generated = await actions?.startAiSetup(aiDraftPreferences);
    setAiGenerating(false);
    if (!generated) setAiDraftOpen(true);
  }

  function handleCubePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    suppressCubeClickRef.current = false;
    rotationDragRef.current = { pointerId: event.pointerId, x: event.clientX, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCubePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = rotationDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    if (Math.abs(dx) < 1) return;
    drag.x = event.clientX;
    drag.moved = true;
    rotateFarmBy(dx * 0.55);
  }

  function handleCubePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = rotationDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    rotationDragRef.current = null;
    suppressCubeClickRef.current = drag.moved;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function rotateFarmBy(degrees: number) {
    if (actions?.rotateBy) {
      actions.rotateBy(degrees);
      return;
    }
    if (Math.abs(degrees) >= 30) actions?.rotateView();
  }

  return (
    <div ref={rootRef} className={`farm-manager-root ${styles.host}`}>
      <div className="app-shell">
        <header className="topbar pixel-gradient-sky">
          <div className="brand">
            <div>
              <span className="eyebrow">Farm Space Studio</span>
              <strong>Homestead Map</strong>
            </div>
          </div>

          <div className="toolbar-group">
            <div className="segmented" aria-label="Interaction mode">
              <button id="selectMode" className={chrome.mode === "select" ? "active" : ""} type="button" onClick={() => actions?.setMode("select")}>Select</button>
              <button id="editMode" className={chrome.mode === "edit" || chrome.mode === "move" ? "active" : ""} type="button" onClick={() => actions?.setMode("move")}>Edit</button>
              <button id="drawMode" className={chrome.mode === "draw" ? "active" : ""} type="button" onClick={() => actions?.setMode("draw")}>Draw</button>
            </div>

            <div className="segmented" aria-label="Object type">
              <button data-draw-type="cropArea" className={chrome.drawType === "cropArea" ? "active" : ""} type="button" onClick={() => actions?.setDrawType("cropArea")}>Crop Area</button>
              <button data-draw-type="cropField" className={chrome.drawType === "cropField" ? "active" : ""} type="button" onClick={() => actions?.setDrawType("cropField")}>Crop Field</button>
              <button data-draw-type="livestock" className={chrome.drawType === "livestock" ? "active" : ""} type="button" onClick={() => actions?.setDrawType("livestock")}>Livestock</button>
              <button data-draw-type="structure" className={chrome.drawType === "structure" ? "active" : ""} type="button" onClick={() => actions?.setDrawType("structure")}>Structure</button>
              <button data-draw-type="path" className={chrome.drawType === "path" ? "active" : ""} type="button" onClick={() => actions?.setDrawType("path")}>Path</button>
            </div>

          </div>

          <div className="toolbar-group right">
            <div className="segmented" aria-label="Measurement units">
              <button data-units="ft" className={chrome.units === "ft" ? "active" : ""} type="button" onClick={() => actions?.setUnits("ft")}>ft</button>
              <button data-units="m" className={chrome.units === "m" ? "active" : ""} type="button" onClick={() => actions?.setUnits("m")}>m</button>
            </div>

            <div className="zoom-split" aria-label="Zoom controls">
              <button id="zoomOut" className="zoom-split-button zoom-out" type="button" aria-label="Zoom out" onClick={() => actions?.zoomOut()}>
                <span aria-hidden="true">-</span>
              </button>
              <button id="zoomIn" className="zoom-split-button zoom-in" type="button" aria-label="Zoom in" onClick={() => actions?.zoomIn()}>
                <span aria-hidden="true">+</span>
              </button>
            </div>
            <button id="rotateView" className="icon-button" type="button" aria-label="Rotate view" title="Rotate" onClick={() => actions?.rotateView()}>
              <RotateIcon />
            </button>
            <button id="settingsButton" type="button" onClick={() => actions?.openBoundarySettings()}>Reset Farm</button>
          </div>
        </header>

        <main className="stage pixel-dots">
          <canvas
            id="farmCanvas"
            aria-label="Interactive low-poly farm map"
            onPointerDown={(event) => actions?.handleCanvasPointerDown(event.nativeEvent)}
            onPointerMove={(event) => actions?.handleCanvasPointerMove(event.nativeEvent)}
            onPointerUp={(event) => actions?.handleCanvasPointerUp(event.nativeEvent)}
            onPointerCancel={(event) => actions?.handleCanvasPointerUp(event.nativeEvent)}
            onPointerLeave={() => actions?.handleCanvasPointerLeave()}
            onClick={(event) => actions?.handleCanvasClick(event.nativeEvent)}
            onContextMenu={(event) => event.preventDefault()}
            onWheel={(event) => actions?.handleCanvasWheel(event.nativeEvent)}
          />

          <aside className="object-panel pixel-frame" aria-live="polite">
            <FarmObjectPanel content={content} actions={actions} />
          </aside>

          <button
            className="rotation-cube-control"
            type="button"
            aria-label="Rotate farm plan"
            title="Drag to rotate"
            onClick={() => {
              if (suppressCubeClickRef.current) {
                suppressCubeClickRef.current = false;
                return;
              }
              rotateFarmBy(35);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                rotateFarmBy(-15);
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                rotateFarmBy(15);
              }
            }}
            onPointerDown={handleCubePointerDown}
            onPointerMove={handleCubePointerMove}
            onPointerUp={handleCubePointerUp}
            onPointerCancel={handleCubePointerUp}
          >
            <span className="rotation-cube-scene" aria-hidden="true">
              <span className="rotation-cube" style={{ transform: `rotateX(-32deg) rotateY(${45 + (chrome.rotation ?? 0)}deg)` }}>
                <span className="rotation-cube-face rotation-cube-front" />
                <span className="rotation-cube-face rotation-cube-back" />
                <span className="rotation-cube-face rotation-cube-right" />
                <span className="rotation-cube-face rotation-cube-left" />
                <span className="rotation-cube-face rotation-cube-top" />
                <span className="rotation-cube-face rotation-cube-bottom" />
              </span>
            </span>
          </button>
        </main>

        <section id="onboarding" className={`onboarding ${chrome.onboardingVisible ? "" : "hidden"}`}>
          <div
            style={{ ["--pixel-frame-bg" as string]: "#fbf6e8" }}
            className="pixel-frame onboarding-card-pixel relative grid w-[min(1180px,100%)] grid-cols-1 overflow-hidden border-2 border-[#3b2a14] bg-[#fffdf5] shadow-[0_6px_0_#3b2a14,0_24px_60px_rgba(39,27,16,0.28)] lg:grid-cols-[minmax(280px,360px)_minmax(420px,1fr)]"
          >
            <div className="pixel-gradient-meadow flex flex-col gap-3 border-b-2 border-[#3b2a14] p-6 lg:border-b-0 lg:border-r-2">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
                <PixelGlyph name="scroll" className="size-3.5" />
                Step 1
              </span>
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#ffe89a] text-[#a8761c] shadow-[inset_0_2px_0_rgba(255,255,255,0.55),inset_0_-3px_0_rgba(168,118,28,0.32),0_2px_0_#3b2a14]">
                  <PixelGlyph name="sun" className="size-7" />
                </span>
                <h1 className="font-mono text-xl font-black uppercase leading-[1.1] tracking-[0.08em] text-[#27351f] drop-shadow-[1px_1px_0_rgba(255,253,245,0.55)] sm:text-2xl">
                  Draw Homestead Boundary
                </h1>
              </div>
              <p className="text-sm font-semibold leading-6 text-[#5e4a26]">
                Click points on the real map to define the farm boundary. The saved boundary becomes the local low-poly
                planning board.
              </p>
              <ul className="mt-1 grid gap-1.5 text-xs font-bold leading-5 text-[#5e4a26]">
                <li className="flex items-center gap-2">
                  <PixelGlyph name="leaf" className="size-3.5 shrink-0 text-[#2f6f4e]" />
                  Click 3 or more points to outline the patch.
                </li>
                <li className="flex items-center gap-2">
                  <PixelGlyph name="wheat" className="size-3.5 shrink-0 text-[#a8761c]" />
                  No live tiles? Use the demo boundary to keep going.
                </li>
                <li className="flex items-center gap-2">
                  <PixelGlyph name="sparkle" className="size-3.5 shrink-0 text-[#7a461f]" />
                  Save when the shape feels right — you can redraw later.
                </li>
              </ul>
            </div>

            <div className="relative min-h-[420px] border-2 border-[#3b2a14] bg-[#203029] lg:min-h-[560px] lg:border-0">
              <div id="boundaryMap" className="absolute inset-0" />
              <div
                id="mapFallback"
                className="map-fallback hidden absolute inset-0 z-[1] grid place-items-center content-center gap-1.5 px-6 text-center"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(73,107,71,0.84), rgba(32,48,41,0.92)), repeating-linear-gradient(45deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 18px)",
                }}
              >
                <span className="grid size-10 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
                  <PixelGlyph name="scroll" className="size-5" />
                </span>
                <strong className="font-mono text-sm font-black uppercase tracking-[0.14em] text-[#fffdf5] drop-shadow-[1px_1px_0_#3b2a14]">
                  Map tiles unavailable
                </strong>
                <span className="text-xs font-semibold text-[#e9f4df]">
                  Use the demo boundary to continue without live map tiles.
                </span>
              </div>
              <div className="absolute inset-x-3 bottom-3 z-[2] flex flex-wrap justify-end gap-2">
                <button
                  id="useDemoBoundary"
                  type="button"
                  onClick={() => actions?.useDemoBoundary()}
                  className="inline-flex items-center gap-1.5"
                >
                  <PixelGlyph name="wagon" className="size-3.5" />
                  Demo Boundary
                </button>
                <button
                  id="clearBoundary"
                  type="button"
                  onClick={() => actions?.clearBoundary()}
                  className="inline-flex items-center gap-1.5"
                >
                  <PixelGlyph name="sparkle" className="size-3.5" />
                  Clear
                </button>
                <button
                  id="saveBoundary"
                  type="button"
                  className="active inline-flex items-center gap-1.5"
                  onClick={() => actions?.saveBoundary()}
                >
                  <PixelGlyph name="leaf" className="size-3.5" />
                  Save Boundary
                </button>
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
                <button id="aiSetup" className="choice-button" type="button" onClick={() => setAiDraftOpen(true)}>
                  <strong>AI Draft</strong>
                  <span>Generate an optimized Gemini plan from your boundary, budget, water, labor, and goals.</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <div id="aiDraftModal" className={`modal ${aiDraftOpen ? "" : "hidden"}`} role="dialog" aria-modal="true">
          <div className="modal-card ai-draft-card">
            <span className="eyebrow">AI Draft</span>
            <h2>Generate Homestead Plan</h2>
            <p>Gemini will choose from the full crop catalog and optimize the layout for these constraints.</p>
            <div className="ai-draft-grid">
              <label>
                Budget
                <input
                  type="number"
                  min="50"
                  step="50"
                  value={Math.round(aiDraftPreferences.budgetCents / 100)}
                  onChange={(event) => setAiDraftPreferences((current) => ({
                    ...current,
                    budgetCents: Math.max(5000, Math.round(Number(event.target.value) * 100) || current.budgetCents),
                  }))}
                />
              </label>
              <label>
                Goal
                <select
                  value={aiDraftPreferences.goal}
                  onChange={(event) => setAiDraftPreferences((current) => ({
                    ...current,
                    goal: event.target.value as FarmAiDraftPreferences["goal"],
                  }))}
                >
                  <option value="balanced">Balanced</option>
                  <option value="food-security">Food security</option>
                  <option value="family-kitchen">Family kitchen</option>
                  <option value="market-garden">Market garden</option>
                  <option value="profit">Profit</option>
                  <option value="low-maintenance">Low maintenance</option>
                </select>
              </label>
              <label>
                Household
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={aiDraftPreferences.householdSize}
                  onChange={(event) => setAiDraftPreferences((current) => ({
                    ...current,
                    householdSize: Math.max(1, Math.round(Number(event.target.value)) || current.householdSize),
                  }))}
                />
              </label>
              <label>
                Weekly hours
                <input
                  type="number"
                  min="1"
                  max="80"
                  value={aiDraftPreferences.weeklyHours}
                  onChange={(event) => setAiDraftPreferences((current) => ({
                    ...current,
                    weeklyHours: Math.max(1, Math.round(Number(event.target.value)) || current.weeklyHours),
                  }))}
                />
              </label>
              <label>
                Experience
                <select
                  value={aiDraftPreferences.experience}
                  onChange={(event) => setAiDraftPreferences((current) => ({
                    ...current,
                    experience: event.target.value as FarmAiDraftPreferences["experience"],
                  }))}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
              <label>
                Water
                <select
                  value={aiDraftPreferences.waterPriority}
                  onChange={(event) => setAiDraftPreferences((current) => ({
                    ...current,
                    waterPriority: event.target.value as FarmAiDraftPreferences["waterPriority"],
                  }))}
                >
                  <option value="balanced">Balanced</option>
                  <option value="low-water">Low water</option>
                  <option value="high-production">High production</option>
                </select>
              </label>
              <label>
                Irrigation
                <select
                  value={aiDraftPreferences.irrigation}
                  onChange={(event) => setAiDraftPreferences((current) => ({
                    ...current,
                    irrigation: event.target.value as FarmAiDraftPreferences["irrigation"],
                  }))}
                >
                  <option value="hose">Hose</option>
                  <option value="drip">Drip</option>
                  <option value="sprinkler">Sprinkler</option>
                  <option value="none">None</option>
                </select>
              </label>
              <label>
                Season
                <select
                  value={aiDraftPreferences.season}
                  onChange={(event) => setAiDraftPreferences((current) => ({
                    ...current,
                    season: event.target.value as FarmAiDraftPreferences["season"],
                  }))}
                >
                  <option value="spring">Spring</option>
                  <option value="summer">Summer</option>
                  <option value="fall">Fall</option>
                  <option value="winter">Winter</option>
                  <option value="year-round">Year-round</option>
                </select>
              </label>
            </div>
            <label className="ai-draft-notes">
              Notes
              <textarea
                value={aiDraftPreferences.notes}
                placeholder="Favorite crops, dietary needs, market goals, things to avoid..."
                onChange={(event) => setAiDraftPreferences((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
            <div className="ai-draft-checks">
              <label><input type="checkbox" checked={aiDraftPreferences.includeStructures} onChange={(event) => setAiDraftPreferences((current) => ({ ...current, includeStructures: event.target.checked }))} />Structures</label>
              <label><input type="checkbox" checked={aiDraftPreferences.includeLivestock} onChange={(event) => setAiDraftPreferences((current) => ({ ...current, includeLivestock: event.target.checked }))} />Livestock</label>
            </div>
            <div className="modal-actions">
              <button type="button" disabled={aiGenerating} onClick={() => setAiDraftOpen(false)}>Cancel</button>
              <button className="active" type="button" disabled={aiGenerating} onClick={() => void handleGenerateAiDraft()}>
                {aiGenerating ? "Generating" : "Generate"}
              </button>
            </div>
          </div>
        </div>

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

      <MagicGenerateOverlay
        visible={aiGenerating}
        title="Growing Farm Draft"
        ariaLabel="Generating AI farm draft"
        targetId="app-main"
      />
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
          <span className="panel-token" aria-hidden="true">
            <PixelGlyph name="leaf" className="panel-token-icon" />
          </span>
          <div>
            <span id="panelKicker">Selection</span>
            <strong id="panelTitle">No object selected</strong>
          </div>
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
        <span className="panel-token" aria-hidden="true">
          <PixelGlyph name={glyphForType(object.type)} className="panel-token-icon" />
        </span>
        <div>
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
    const crop = content.catalog.crops.find((item) => item.key === stringAttr(object, "cropKey"));
    const area = polygonArea(object.polygon ?? []);
    const capacity = getCapacityStatus({
      area,
      count: numberAttr(object, "count"),
      idealSpace: crop?.idealSpaceSqft ?? numberAttr(object, "idealSpaceSqft"),
    });
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
          <DetailItem label="Ideal capacity" value={capacity.capacityLabel} />
          <DetailItem label="Harvest cycles" value={formatNumber(crop?.harvestCycles ?? numberAttr(object, "harvestCycles"), "Unknown")} />
        </div>
        {capacity.isOver ? <CapacityWarning message={`Over recommended density by ${capacity.overBy} ${capacity.overBy === 1 ? "plant" : "plants"}.`} /> : null}
        <CatalogSearchPicker
          label="Crop type"
          placeholder="Search crops..."
          selectedName={crop ? crop.name : stringAttr(object, "cropName")}
          items={content.catalog.crops.map((item) => ({
            key: item.key,
            name: item.name,
            subtitle: [item.cropCategory, item.scientificName].filter(Boolean).join(" - "),
          }))}
          customLabel="Custom crop"
          onClear={() => actions?.setCropType("")}
          onCustom={(name) => actions?.setCustomCropName(name)}
          onSelect={(key) => actions?.setCropType(key)}
        />
        <CatalogGuidance
          title={crop ? crop.name : stringAttr(object, "cropName") || "Custom crop"}
          subtitle={crop?.scientificName || crop?.cropCategory || "No catalog match"}
          items={[
            ["Category", crop?.cropCategory],
            ["Life span", crop?.lifeSpan],
            ["Ideal spacing", crop?.idealSpaceSqft ? `${crop.idealSpaceSqft} ft2 each` : undefined],
            ["Soil pH", formatRange(crop?.soilPhMin, crop?.soilPhMax)],
            ["Soil", crop?.soilTexture],
            ["Light", crop?.lightRequirement],
            ["Water", crop?.waterConsumptionMl ? `${crop.waterConsumptionMl} ml` : undefined],
            ["Rain max", crop?.rainfallMaxMl ? `${crop.rainfallMaxMl} ml` : undefined],
          ]}
          notes={[crop?.description, crop?.howToGrow, crop?.insectControl, crop?.tips]}
        />
        <DeleteControl object={object} actions={actions} />
      </>
    );
  }

  if (object.type === "livestock") {
    const species = content.catalog.livestock.find((item) =>
      item.key === stringAttr(object, "speciesKey") || item.name === stringAttr(object, "species")
    );
    const breeds = species?.breeds ?? [stringAttr(object, "breed")].filter(Boolean);
    const area = polygonArea(object.polygon ?? []);
    const capacity = getCapacityStatus({
      area,
      count: numberAttr(object, "count"),
      idealSpace: species?.idealSpaceSqft ?? numberAttr(object, "idealSpaceSqft"),
    });
    return (
      <>
        {common}
        <div className="detail-grid">
          <DetailItem label="Species" value={stringAttr(object, "species")} />
          <DetailItem label="Breed" value={stringAttr(object, "breed")} />
          <label className="detail-item">
            <span>Headcount</span>
            <input type="number" min="0" step="1" value={numberAttr(object, "count")} onChange={(event) => actions?.setLivestockCount(Number(event.target.value))} />
          </label>
          <DetailItem label="Enclosure" value="Fenced" />
          <DetailItem label="Ideal capacity" value={capacity.capacityLabel} />
          <DetailItem label="Yield types" value={species?.yieldTypes?.join(", ") || "Unknown"} />
        </div>
        {capacity.isOver ? <CapacityWarning message={`Over recommended density by ${capacity.overBy} ${capacity.overBy === 1 ? "animal" : "animals"}.`} /> : null}
        <CatalogSearchPicker
          label="Livestock type"
          placeholder="Search livestock..."
          selectedName={species ? species.name : stringAttr(object, "species")}
          items={content.catalog.livestock.map((item) => ({
            key: item.key,
            name: item.name,
            subtitle: item.description,
          }))}
          customLabel="Custom livestock"
          onClear={() => actions?.setLivestockSpecies("")}
          onCustom={(name) => actions?.setCustomLivestockName(name)}
          onSelect={(key) => actions?.setLivestockSpecies(key)}
        />
        <div className="detail-list">
          <span>Breed</span>
          <label className="select-shell">
            <select value={stringAttr(object, "breed")} onChange={(event) => actions?.setLivestockBreed(event.target.value)}>
              {breeds.map((breed) => <option key={breed} value={breed}>{breed}</option>)}
            </select>
          </label>
        </div>
        <CatalogGuidance
          title={species ? species.name : stringAttr(object, "species") || "Custom livestock"}
          subtitle={species?.description || "No catalog match"}
          items={[
            ["Ideal spacing", species?.idealSpaceSqft ? `${species.idealSpaceSqft} ft2 each` : undefined],
            ["Meat yield", species?.meatYield ? `${species.meatYield}` : undefined],
            ["Yield frequency", species?.yieldFrequency],
            ["Feed", species?.feed],
          ]}
          notes={[species?.careInstructions]}
        />
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

function CatalogSearchPicker({
  label,
  placeholder,
  selectedName,
  items,
  customLabel,
  onSelect,
  onCustom,
  onClear,
}: {
  label: string;
  placeholder: string;
  selectedName: string;
  items: CatalogSearchItem[];
  customLabel: string;
  onSelect: (key: string) => void;
  onCustom: (name: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();
  const matches = items
    .filter((item) => {
      if (!normalizedQuery) return true;
      return `${item.name} ${item.subtitle ?? ""}`.toLowerCase().includes(normalizedQuery);
    })
    .slice(0, 10);
  const exactMatch = items.some((item) => item.name.toLowerCase() === normalizedQuery);
  const inputValue = open ? query : selectedName;

  function selectItem(key: string) {
    onSelect(key);
    setQuery("");
    setOpen(false);
  }

  function useCustomName(name: string) {
    const nextName = name.trim();
    if (!nextName) return;
    onCustom(nextName);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="detail-list catalog-search">
      <span>{label}</span>
      <div className="catalog-search-box">
        <input
          type="search"
          value={inputValue}
          placeholder={placeholder}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setQuery("");
              setOpen(false);
            }
            if (event.key === "Enter") {
              event.preventDefault();
              if (matches[0]) selectItem(matches[0].key);
              else useCustomName(trimmedQuery);
            }
          }}
        />
        {open ? (
          <div className="catalog-search-menu">
            <button
              type="button"
              className="catalog-search-option muted"
              onMouseDown={(event) => {
                event.preventDefault();
                onClear();
                setQuery("");
                setOpen(false);
              }}
            >
              <strong>Unassigned</strong>
              <em>clear selection</em>
            </button>
            {matches.map((item) => (
              <button
                key={item.key}
                type="button"
                className="catalog-search-option"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectItem(item.key);
                }}
              >
                <strong>{item.name}</strong>
                {item.subtitle ? <em>{truncateText(item.subtitle, 78)}</em> : null}
              </button>
            ))}
            {trimmedQuery && !exactMatch ? (
              <button
                type="button"
                className="catalog-search-option custom"
                onMouseDown={(event) => {
                  event.preventDefault();
                  useCustomName(trimmedQuery);
                }}
              >
                <strong>{customLabel}</strong>
                <em>{trimmedQuery}</em>
              </button>
            ) : null}
            {!matches.length && !trimmedQuery ? (
              <div className="catalog-search-empty">Start typing to filter results</div>
            ) : null}
            {!matches.length && trimmedQuery && exactMatch ? (
              <div className="catalog-search-empty">No additional matches</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CapacityWarning({ message }: { message: string }) {
  return (
    <div className="detail-list capacity-warning">
      <span>Spacing warning</span>
      <ul>
        <li><strong>{message}</strong><em>yellow map outline</em></li>
      </ul>
    </div>
  );
}

function CatalogGuidance({
  title,
  subtitle,
  items,
  notes,
}: {
  title: string;
  subtitle: string;
  items: Array<[string, string | undefined]>;
  notes: Array<string | undefined>;
}) {
  const visibleItems = items.filter((item): item is [string, string] => Boolean(item[1]));
  const visibleNotes = notes.filter((note): note is string => Boolean(note)).slice(0, 4);

  if (!visibleItems.length && !visibleNotes.length) {
    return (
      <div className="detail-list catalog-guidance">
        <span>Catalog data</span>
        <ul><li><strong>{title}</strong><em>{subtitle}</em></li></ul>
      </div>
    );
  }

  return (
    <div className="detail-list catalog-guidance">
      <span>Catalog data</span>
      <ul>
        <li><strong>{title}</strong><em>{truncateText(subtitle, 88)}</em></li>
        {visibleItems.map(([label, value]) => (
          <li key={label}><strong>{label}</strong><em>{truncateText(value, 72)}</em></li>
        ))}
        {visibleNotes.map((note, index) => (
          <li key={`note-${index}`} className="catalog-note"><strong>Note</strong><em>{truncateText(note, 150)}</em></li>
        ))}
      </ul>
    </div>
  );
}

function DeleteControl({ object, actions }: { object: FarmObject; actions?: FarmManagerActions }) {
  const warning = object.type === "cropArea" ? "Deletes child crop fields too" : "Removes this object";
  return (
    <div className="slot-actions">
      <button className="danger-button" type="button" onClick={() => actions?.deleteSelectedObject()}>
        <PixelGlyph name="trash" className="button-icon" />
        Delete
      </button>
      <div className="detail-list"><span>Delete behavior</span><ul><li><strong>{warning}</strong><em>snapshot with + if needed</em></li></ul></div>
    </div>
  );
}

function RotateIcon() {
  return (
    <svg className="rotate-icon" aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path
        d="M15.5 7.5A6 6 0 1 0 16 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M15.5 3.5V7.5H11.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function glyphForType(type: FarmObjectType): PixelGlyphName {
  const glyphs: Record<FarmObjectType, PixelGlyphName> = {
    cropArea: "leaf",
    cropField: "seed",
    livestock: "basket",
    structure: "ledger",
    path: "scroll",
  };

  return glyphs[type];
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

function getCapacityStatus({ area, count, idealSpace }: { area: number; count: number; idealSpace: number }) {
  if (!Number.isFinite(area) || area <= 0 || !Number.isFinite(idealSpace) || idealSpace <= 0) {
    return { capacityLabel: "Unknown", isOver: false, overBy: 0 };
  }

  const capacity = Math.max(0, Math.floor(area / idealSpace));
  const overBy = Math.max(0, Math.ceil(count - capacity));
  return {
    capacityLabel: `${capacity.toLocaleString()} ${capacity === 1 ? "unit" : "units"}`,
    isOver: overBy > 0,
    overBy,
  };
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

function formatNumber(value: number | undefined, fallback: string) {
  return Number.isFinite(value) ? Number(value).toLocaleString() : fallback;
}

function formatRange(min: number | undefined, max: number | undefined) {
  if (Number.isFinite(min) && Number.isFinite(max)) return `${min}-${max}`;
  if (Number.isFinite(min)) return `${min}+`;
  if (Number.isFinite(max)) return `up to ${max}`;
  return undefined;
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1).trim()}...` : value;
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
