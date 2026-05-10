"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useEffect, useRef, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import type { FarmV2Object, FarmV2Plan, GeoPoint, LocalPoint } from "@/lib/models";
import {
  clamp,
  cloneFarmV2Objects,
  createFarmV2Commit,
  defaultFarmV2Boundary,
  demoFarmV2GeoBoundary,
  distance,
  farmV2Catalog,
  getBBox,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  rotatePoint,
  snapPoint,
} from "@/lib/farm-v2";

type SavedFarmV2Plan = Omit<FarmV2Plan, "_id" | "farmId" | "userId" | "createdAt" | "updatedAt" | "commits"> & {
  _id: string;
  farmId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  commits: Array<Omit<FarmV2Plan["commits"][number], "timestamp"> & { timestamp: string }>;
};

type DrawType = "cropArea" | "cropField" | "livestock" | "structure" | "path";

type InteractionMode = "select" | "draw";

type FarmV2Renderer = {
  project: (point: LocalPoint, height?: number) => { x: number; y: number };
  unproject: (x: number, y: number) => LocalPoint;
  hitTestAll: (point: LocalPoint) => { id: string; distance: number }[];
  getZoomLimits: () => { min: number; max: number };
  destroy: () => void;
};

const tileX = 6.1;
const tileY = 3.05;
const heightScale = 5.2;
const boardWidth = 108;
const boardHeight = 82;
const boardCenter: LocalPoint = [boardWidth / 2, boardHeight / 2];

const typeLabels: Record<DrawType, string> = {
  cropArea: "Crop Area",
  cropField: "Crop Field",
  livestock: "Livestock",
  structure: "Structure",
  path: "Path",
};

export function FarmPlanner() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<FarmV2Renderer | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const idCounterRef = useRef(0);
  const activePlanRef = useRef<SavedFarmV2Plan | null>(null);
  const modeRef = useRef<InteractionMode>("select");
  const drawTypeRef = useRef<DrawType>("cropArea");
  const draftRef = useRef<LocalPoint[]>([]);
  const finishCurrentDraftRef = useRef<() => void>(() => {});
  const finishDraftFromPointsRef = useRef<(points: LocalPoint[]) => void>(() => {});
  const pointerRef = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const [plans, setPlans] = useState<SavedFarmV2Plan[]>([]);
  const [activePlan, setActivePlan] = useState<SavedFarmV2Plan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [boundaryGeo, setBoundaryGeo] = useState<GeoPoint[]>([]);
  const [setupReady, setSetupReady] = useState(false);
  const [mode, setMode] = useState<InteractionMode>("select");
  const [drawType, setDrawType] = useState<DrawType>("cropArea");
  const [draft, setDraft] = useState<LocalPoint[]>([]);
  const [mouse, setMouse] = useState<LocalPoint | null>(null);
  const [playing, setPlaying] = useState(false);
  const [commitName, setCommitName] = useState("");

  useEffect(() => {
    activePlanRef.current = activePlan;
    modeRef.current = mode;
    drawTypeRef.current = drawType;
    draftRef.current = draft;
  });

  useEffect(() => {
    let ignore = false;
    fetch("/api/farm/plans", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { plans?: SavedFarmV2Plan[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to load Farmv2 plans");
        return data.plans ?? [];
      })
      .then((nextPlans) => {
        if (ignore) return;
        setPlans(nextPlans);
        setActivePlan(nextPlans[0] ?? null);
        setOnboardingOpen(!nextPlans.length);
      })
      .catch((loadError: unknown) => {
        if (!ignore) setError(formatError(loadError));
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activePlan) return;
    const renderer = createFarmV2Renderer(canvas, () => activePlan, () => ({ draft, mouse, drawType: drawTypeRef.current }));
    rendererRef.current = renderer;
    return () => {
      renderer.destroy();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [activePlan, draft, mouse]);

  useEffect(() => {
    if (!playing || !activePlan?.commits.length) return;
    const timer = window.setInterval(() => {
      setActivePlan((current) => {
        if (!current) return current;
        const nextIndex = (current.commitIndex + 1) % current.commits.length;
        void loadCommit(current, nextIndex);
        return {
          ...current,
          commitIndex: nextIndex,
          objects: cloneFarmV2Objects(current.commits[nextIndex].objects),
          selectedId: current.commits[nextIndex].objects[0]?.id ?? null,
        };
      });
    }, 1200);
    return () => window.clearInterval(timer);
  }, [playing, activePlan]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";

      if (isTyping) return;

      if (event.key === "Enter" && modeRef.current === "draw") {
        event.preventDefault();
        finishCurrentDraftRef.current();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        draftRef.current = [];
        setDraft([]);
        setMouse(null);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  function updatePlan(updater: (plan: SavedFarmV2Plan) => SavedFarmV2Plan, save = true) {
    setActivePlan((current) => {
      if (!current) return current;
      const next = updater(current);
      setPlans((items) => items.map((item) => (item._id === next._id ? next : item)));
      if (save) scheduleSave(next);
      return next;
    });
  }

  function scheduleSave(plan: SavedFarmV2Plan) {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void saveObjects(plan);
    }, 550);
  }

  async function createPlan(setupMode: "manual" | "deterministic-draft") {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/farm/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setupMode,
          boundaryGeo: boundaryGeo.length >= 3 ? boundaryGeo : demoFarmV2GeoBoundary,
          boundaryLocal: boundaryGeo.length >= 3 ? undefined : defaultFarmV2Boundary,
        }),
      });
      const data = (await response.json()) as { plan?: SavedFarmV2Plan; error?: string };
      if (!response.ok || !data.plan) throw new Error(data.error ?? "Unable to create Farmv2 plan");
      setPlans((current) => [data.plan as SavedFarmV2Plan, ...current.filter((plan) => plan._id !== data.plan?._id)]);
      setActivePlan(data.plan);
      setOnboardingOpen(false);
      setSetupReady(false);
      setMode(setupMode === "manual" ? "draw" : "select");
    } catch (createError) {
      setError(formatError(createError));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveObjects(plan: SavedFarmV2Plan) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/farm/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan._id,
          action: "saveObjects",
          objects: plan.objects,
          selectedId: plan.selectedId,
          units: plan.units,
          view: plan.view,
          camera: plan.camera,
        }),
      });
      const data = (await response.json()) as { plan?: SavedFarmV2Plan; error?: string };
      if (!response.ok || !data.plan) throw new Error(data.error ?? "Unable to save Farmv2 plan");
      setPlans((current) => current.map((item) => (item._id === data.plan?._id ? data.plan as SavedFarmV2Plan : item)));
    } catch (saveError) {
      setError(formatError(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function appendCommit(plan: SavedFarmV2Plan, name: string) {
    setIsSaving(true);
    try {
      const optimistic = createFarmV2Commit(name, plan.objects);
      const optimisticPlan = {
        ...plan,
        commits: [...plan.commits, { ...optimistic, timestamp: optimistic.timestamp.toISOString() }],
        commitIndex: plan.commits.length,
      };
      setActivePlan(optimisticPlan);
      const response = await fetch("/api/farm/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan._id,
          action: "appendCommit",
          name,
          objects: plan.objects,
          selectedId: plan.selectedId,
        }),
      });
      const data = (await response.json()) as { plan?: SavedFarmV2Plan; error?: string };
      if (!response.ok || !data.plan) throw new Error(data.error ?? "Unable to save timeline entry");
      setActivePlan(data.plan);
      setPlans((current) => current.map((item) => (item._id === data.plan?._id ? data.plan as SavedFarmV2Plan : item)));
      setCommitName("");
    } catch (commitError) {
      setError(formatError(commitError));
    } finally {
      setIsSaving(false);
    }
  }

  async function loadCommit(plan: SavedFarmV2Plan, commitIndex: number) {
    const response = await fetch("/api/farm/plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan._id, action: "loadCommit", commitIndex }),
    });
    const data = (await response.json()) as { plan?: SavedFarmV2Plan; error?: string };
    if (response.ok && data.plan) {
      setActivePlan(data.plan);
      setPlans((current) => current.map((item) => (item._id === data.plan?._id ? data.plan as SavedFarmV2Plan : item)));
    }
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!activePlan) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: activePlan.camera.panX,
      panY: activePlan.camera.panY,
      moved: false,
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!activePlan) return;
    const renderer = rendererRef.current;
    const pointer = pointerRef.current;
    if (pointer && event.buttons === 1) {
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (Math.hypot(dx, dy) > 4) pointer.moved = true;
      if (pointer.moved) {
        updatePlan((plan) => ({
          ...plan,
          camera: { ...plan.camera, panX: pointer.panX + dx, panY: pointer.panY + dy },
        }));
        return;
      }
    }
    if (!renderer) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const world = snapPoint(renderer.unproject(event.clientX - rect.left, event.clientY - rect.top));
    setMouse(pointInPolygon(world, activePlan.boundary.local) ? world : null);
  }

  function onPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => {
      pointerRef.current = null;
    }, 0);
  }

  function onCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    if (!activePlan || pointerRef.current?.moved) return;
    if (event.detail > 1) return;
    const renderer = rendererRef.current;
    if (!renderer) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const world = snapPoint(renderer.unproject(event.clientX - rect.left, event.clientY - rect.top));
    if (!pointInPolygon(world, activePlan.boundary.local)) return;
    if (mode === "draw") {
      const currentDraft = draftRef.current;
      const firstPoint = currentDraft[0];
      if (drawType !== "path" && currentDraft.length >= 3 && firstPoint && distance(world, firstPoint) <= 7) {
        finishDraftFromPointsRef.current(currentDraft);
        return;
      }
      setDraft((current) => {
        const next = [...current, world];
        draftRef.current = next;
        return next;
      });
      return;
    }
    const hit = renderer.hitTestAll(world)[0];
    updatePlan((plan) => ({ ...plan, selectedId: hit?.id ?? null }), false);
  }

  function addObject(object: FarmV2Object) {
    updatePlan((plan) => ({
      ...plan,
      objects: [...plan.objects, object],
      selectedId: object.id,
    }));
    draftRef.current = [];
    setDraft([]);
    setMode("select");
  }

  function finishDraftFromPoints(points: LocalPoint[]) {
    const plan = activePlanRef.current;
    if (!plan) return;
    const type = drawTypeRef.current;
    const draftPoints = points.slice();
    const nextId = (prefix: string) => {
      idCounterRef.current += 1;
      return `user-${prefix}-${idCounterRef.current}`;
    };
    if (type === "path") {
      if (draftPoints.length < 2) return;
      addObject({ id: nextId("path"), label: "New Path", type: "path", points: draftPoints, attrs: { status: "Open", material: "Packed gravel" } });
      return;
    }
    if (draftPoints.length < 3) return;
    if (type === "cropArea") {
      addObject({ id: nextId("crop-area"), label: "New Crop Area", type: "cropArea", polygon: draftPoints, height: 0.38, attrs: { status: "Parent crop area" } });
    } else if (type === "cropField") {
      const parent = plan.objects.find((object) => object.type === "cropArea" && pointInPolygon(polygonCentroid(draftPoints), object.polygon));
      addObject({ id: nextId("crop-field"), label: "Unpopulated Crop Field", type: "cropField", parentId: parent?.id ?? null, polygon: draftPoints, height: 0.76, attrs: { status: parent ? "Needs crop details" : "Needs parent crop area", cropKey: null, cropName: "", count: 0, visual: "generic", growth: 0.2, rows: 5 } });
    } else if (type === "livestock") {
      addObject({ id: nextId("livestock"), label: "New Paddock", type: "livestock", polygon: draftPoints, height: 0.55, attrs: { species: "Goat", breed: "Mixed", count: 4, status: "Planned" } });
    } else if (type === "structure") {
      addObject({ id: nextId("structure"), label: "New Structure", type: "structure", polygon: draftPoints, height: 5.2, attrs: { kind: "Storage Unit", height: 5.2, material: "Timber", status: "Planned" } });
    }
  }

  function finishCurrentDraft() {
    finishDraftFromPointsRef.current(draftRef.current);
  }

  useEffect(() => {
    finishCurrentDraftRef.current = finishCurrentDraft;
    finishDraftFromPointsRef.current = finishDraftFromPoints;
  });

  function selectedObject() {
    return activePlan?.objects.find((object) => object.id === activePlan.selectedId) ?? null;
  }

  const selected = selectedObject();

  return (
    <section className="farmv2-shell">
      <header className="farmv2-topbar">
        <div className="farmv2-brand">
          <span className="farmv2-brand-mark" aria-hidden="true" />
          <div>
            <span className="farmv2-eyebrow">Orchard Ridge</span>
            <strong>Homestead Map</strong>
          </div>
        </div>
        <div className="farmv2-toolbar">
          <Segmented options={["select", "draw"]} value={mode} labels={{ select: "Select", draw: "Draw" }} onChange={(value) => setMode(value as InteractionMode)} />
          <Segmented options={["cropArea", "cropField", "livestock", "structure", "path"]} value={drawType} labels={typeLabels} onChange={(value) => {
            setDrawType(value as DrawType);
            draftRef.current = [];
            setDraft([]);
          }} />
          <button type="button" onClick={() => finishCurrentDraft()}>{drawType === "path" ? "Enter" : "Close"}</button>
          <button type="button" onClick={() => {
            draftRef.current = [];
            setDraft([]);
            setMouse(null);
          }}>Clear</button>
        </div>
        <div className="farmv2-toolbar farmv2-toolbar-right">
          {error ? <span className="farmv2-error">{error}</span> : null}
          <Segmented options={["grid", "satellite"]} value={activePlan?.view ?? "grid"} labels={{ grid: "Grid", satellite: "Satellite" }} onChange={(value) => updatePlan((plan) => ({ ...plan, view: value as "grid" | "satellite" }))} />
          <Segmented options={["ft", "m"]} value={activePlan?.units ?? "ft"} labels={{ ft: "ft", m: "m" }} onChange={(value) => updatePlan((plan) => ({ ...plan, units: value as "ft" | "m" }))} />
          <button type="button" onClick={() => updatePlan((plan) => ({ ...plan, camera: { ...plan.camera, zoom: clamp(plan.camera.zoom - 0.18, rendererRef.current?.getZoomLimits().min ?? 0.1, rendererRef.current?.getZoomLimits().max ?? 12) } }))}>-</button>
          <button type="button" onClick={() => updatePlan((plan) => ({ ...plan, camera: { ...plan.camera, zoom: clamp(plan.camera.zoom + 0.18, rendererRef.current?.getZoomLimits().min ?? 0.1, rendererRef.current?.getZoomLimits().max ?? 12) } }))}>+</button>
          <button type="button" onClick={() => updatePlan((plan) => ({ ...plan, camera: { ...plan.camera, rotation: (plan.camera.rotation + 90) % 360 } }))}>Rotate</button>
          <button type="button" onClick={() => updatePlan((plan) => ({ ...plan, camera: { zoom: rendererRef.current?.getZoomLimits().min ?? 1, panX: 0, panY: -18, rotation: 0 } }))}>Reset</button>
          <button type="button" onClick={() => setOnboardingOpen(true)}>Settings</button>
        </div>
      </header>

      <main className="farmv2-stage">
        {isLoading ? <div className="farmv2-loading">Loading Farmv2...</div> : null}
        <canvas
          ref={canvasRef}
          aria-label="Interactive low-poly farm map"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => {
            setMouse(null);
            pointerRef.current = null;
          }}
          onClick={onCanvasClick}
          onWheel={(event) => {
            event.preventDefault();
            updatePlan((plan) => ({ ...plan, camera: { ...plan.camera, zoom: clamp(plan.camera.zoom + (event.deltaY < 0 ? 0.18 : -0.18), rendererRef.current?.getZoomLimits().min ?? 0.1, rendererRef.current?.getZoomLimits().max ?? 12) } }));
          }}
        />
        {activePlan ? (
          <div className="farmv2-snapshot">
            <span>{formatDate(activePlan.commits[activePlan.commitIndex]?.timestamp ?? activePlan.updatedAt)}</span>
            <strong>{activePlan.commits[activePlan.commitIndex]?.name ?? activePlan.name}</strong>
          </div>
        ) : null}
        <ObjectPanel plan={activePlan} object={selected} draftCount={draft.length} setPlan={updatePlan} />
      </main>

      <footer className="farmv2-timeline">
        <button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"}</button>
        <input
          type="range"
          min="0"
          max={Math.max(0, (activePlan?.commits.length ?? 1) - 1)}
          value={activePlan?.commitIndex ?? 0}
          onChange={(event) => {
            if (!activePlan) return;
            const index = Number(event.target.value);
            const commit = activePlan.commits[index];
            if (!commit) return;
            setActivePlan({ ...activePlan, commitIndex: index, objects: cloneFarmV2Objects(commit.objects), selectedId: commit.objects[0]?.id ?? null });
            void loadCommit(activePlan, index);
          }}
        />
        <div className="farmv2-marker-row" style={{ "--marker-count": activePlan?.commits.length ?? 1 } as CSSProperties}>
          {activePlan?.commits.map((commit, index) => (
            <button key={commit.id} type="button" className={index === activePlan.commitIndex ? "active" : ""} onClick={() => {
              const next = { ...activePlan, commitIndex: index, objects: cloneFarmV2Objects(commit.objects), selectedId: commit.objects[0]?.id ?? null };
              setActivePlan(next);
              void loadCommit(activePlan, index);
            }}>
              {commit.name}
            </button>
          ))}
        </div>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (activePlan) void appendCommit(activePlan, commitName);
        }} className="farmv2-commit-form">
          <input value={commitName} onChange={(event) => setCommitName(event.target.value)} placeholder="Snapshot name" />
          <button type="submit" disabled={!activePlan || isSaving}>+</button>
        </form>
      </footer>

      {onboardingOpen ? (
        <section className="farmv2-onboarding">
          <div className="farmv2-onboarding-card">
            <div className="farmv2-wizard-copy">
              <span className="farmv2-eyebrow">Step 1</span>
              <h1>Draw Homestead Boundary</h1>
              <p>Click points on the map to define the farm boundary. The saved boundary becomes the local low-poly planning board.</p>
              {plans.length ? <button type="button" onClick={() => setOnboardingOpen(false)}>Back to plan</button> : null}
            </div>
            <div className="farmv2-map-shell">
              <BoundaryMap points={boundaryGeo} setPoints={setBoundaryGeo} />
              <div className="farmv2-map-tools">
                <button type="button" onClick={() => {
                  setBoundaryGeo(demoFarmV2GeoBoundary);
                  setSetupReady(true);
                }}>Demo Boundary</button>
                <button type="button" onClick={() => {
                  setBoundaryGeo([]);
                  setSetupReady(false);
                }}>Clear</button>
                <button type="button" onClick={() => setSetupReady(true)}>Save Boundary</button>
              </div>
            </div>
          </div>
          {setupReady ? (
            <div className="farmv2-setup-choice">
              <div className="farmv2-choice-card">
                <span className="farmv2-eyebrow">Step 2</span>
                <h2>Set Up Farm</h2>
                <div className="farmv2-choice-grid">
                  <button type="button" onClick={() => void createPlan("manual")} disabled={isSaving}>
                    <strong>Manual</strong>
                    <span>Draw slots, then populate crop fields, paddocks, structures, and paths.</span>
                  </button>
                  <button type="button" onClick={() => void createPlan("deterministic-draft")} disabled={isSaving}>
                    <strong>AI Draft</strong>
                    <span>Loads a deterministic server draft scaled to the saved boundary.</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <FarmV2Styles />
    </section>
  );
}

function BoundaryMap({ points, setPoints }: { points: GeoPoint[]; setPoints: Dispatch<SetStateAction<GeoPoint[]>> }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const pointsRef = useRef(points);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    let disposed = false;
    let map: import("maplibre-gl").Map | null = null;
    void import("maplibre-gl").then(({ default: maplibregl }) => {
      if (disposed || !containerRef.current) return;
      map = new maplibregl.Map({
        container: containerRef.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [-121.7405, 38.5449],
        zoom: 13.5,
        pitch: 0,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 160, unit: "imperial" }), "bottom-left");
      map.on("load", () => {
        if (!map) return;
        map.addSource("farm-boundary", emptyBoundarySource());
        map.addLayer({ id: "farm-boundary-fill", type: "fill", source: "farm-boundary", paint: { "fill-color": "#67c5a0", "fill-opacity": 0.24 } });
        map.addLayer({ id: "farm-boundary-line", type: "line", source: "farm-boundary", paint: { "line-color": "#f0c35a", "line-width": 3 } });
        map.addLayer({ id: "farm-boundary-points", type: "circle", source: "farm-boundary", paint: { "circle-radius": 5, "circle-color": "#f0c35a", "circle-stroke-width": 2, "circle-stroke-color": "#151d1a" } });
        updateBoundarySource(map, pointsRef.current);
      });
      map.on("click", (event) => {
        setPoints((current) => [...current, [event.lngLat.lng, event.lngLat.lat]]);
      });
    });

    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
    };
  }, [setPoints]);

  useEffect(() => {
    if (mapRef.current) updateBoundarySource(mapRef.current, points);
  }, [points]);

  return <div ref={containerRef} className="farmv2-boundary-map" />;
}

function ObjectPanel({
  plan,
  object,
  draftCount,
  setPlan,
}: {
  plan: SavedFarmV2Plan | null;
  object: FarmV2Object | null;
  draftCount: number;
  setPlan: (updater: (plan: SavedFarmV2Plan) => SavedFarmV2Plan, save?: boolean) => void;
}) {
  if (!plan) {
    return <aside className="farmv2-panel"><strong>No plan loaded</strong></aside>;
  }

  function updateObject(id: string, updater: (object: FarmV2Object) => FarmV2Object) {
    setPlan((current) => ({
      ...current,
      objects: current.objects.map((item) => (item.id === id ? updater(item) : item)),
    }));
  }

  if (!object) {
    return (
      <aside className="farmv2-panel">
        <div className="farmv2-panel-header"><span>Selection</span><strong>No object selected</strong></div>
        <div className="farmv2-details">
          <Detail label="Timeline" value={`${plan.commits.length} entries`} />
          <Detail label="Draft" value={`${draftCount} points`} />
          <Detail label="Boundary" value={`${plan.boundary.local.length} points`} />
          <Detail label="Source" value={plan.boundary.source === "map" ? "Map" : "Demo"} />
        </div>
      </aside>
    );
  }

  return (
    <aside className="farmv2-panel">
      <div className="farmv2-panel-header">
        <span>{typeLabels[object.type as DrawType] ?? object.type}</span>
        <input value={object.label} onChange={(event) => updateObject(object.id, (current) => ({ ...current, label: event.target.value }))} />
      </div>
      <div className="farmv2-details">
        {"polygon" in object ? <Detail label="Area" value={formatArea(polygonArea(object.polygon), plan.units)} /> : null}
        {"points" in object ? <Detail label="Length" value={formatLength(pathLength(object.points), plan.units)} /> : null}
        <Detail label="Status" value={String(object.attrs.status ?? "Planned")} />
        {object.type === "cropArea" ? <CropAreaDetails plan={plan} object={object} /> : null}
        {object.type === "cropField" ? <CropFieldEditor object={object} updateObject={updateObject} /> : null}
        {object.type === "livestock" ? <LivestockEditor object={object} updateObject={updateObject} /> : null}
        {object.type === "structure" ? <StructureEditor object={object} updateObject={updateObject} /> : null}
        <button type="button" className="farmv2-danger" onClick={() => setPlan((current) => {
          const deleteIds = new Set([object.id]);
          if (object.type === "cropArea") {
            current.objects.forEach((item) => {
              if (item.type === "cropField" && item.parentId === object.id) deleteIds.add(item.id);
            });
          }
          const objects = current.objects.filter((item) => !deleteIds.has(item.id));
          return { ...current, objects, selectedId: objects[0]?.id ?? null };
        })}>Delete</button>
      </div>
    </aside>
  );
}

function CropAreaDetails({ plan, object }: { plan: SavedFarmV2Plan; object: Extract<FarmV2Object, { type: "cropArea" }> }) {
  const children = plan.objects.filter((item) => item.type === "cropField" && item.parentId === object.id);
  return <Detail label="Child crop fields" value={children.length ? children.map((child) => child.label).join(", ") : "No crop fields yet"} />;
}

function CropFieldEditor({ object, updateObject }: { object: Extract<FarmV2Object, { type: "cropField" }>; updateObject: (id: string, updater: (object: FarmV2Object) => FarmV2Object) => void }) {
  return (
    <>
      <label className="farmv2-detail-item"><span>Crop</span><select value={object.attrs.cropKey ?? ""} onChange={(event) => {
        const crop = farmV2Catalog.crops.find((item) => item.key === event.target.value);
        updateObject(object.id, (current) => current.type === "cropField" ? {
          ...current,
          label: crop ? `${crop.name} Field` : "Unpopulated Crop Field",
          attrs: {
            ...current.attrs,
            cropKey: crop?.key ?? null,
            cropName: crop?.name ?? "",
            visual: crop?.visual ?? "generic",
            count: crop?.defaultCount ?? 0,
            growth: crop?.growth ?? 0.2,
            status: crop ? "Growing" : "Needs crop details",
          },
        } : current);
      }}>
        <option value="">Unassigned</option>
        {farmV2Catalog.crops.map((crop) => <option key={crop.key} value={crop.key}>{crop.name}</option>)}
      </select></label>
      <label className="farmv2-detail-item"><span>Count</span><input type="number" min="0" value={object.attrs.count ?? 0} onChange={(event) => updateObject(object.id, (current) => current.type === "cropField" ? { ...current, attrs: { ...current.attrs, count: Math.max(0, Number(event.target.value) || 0) } } : current)} /></label>
      <Detail label="Parent" value={object.parentId ?? "None"} />
    </>
  );
}

function LivestockEditor({ object, updateObject }: { object: Extract<FarmV2Object, { type: "livestock" }>; updateObject: (id: string, updater: (object: FarmV2Object) => FarmV2Object) => void }) {
  return (
    <>
      <label className="farmv2-detail-item"><span>Species</span><select value={object.attrs.species} onChange={(event) => {
        const animal = farmV2Catalog.livestock.find((item) => item.name === event.target.value) ?? farmV2Catalog.livestock[0];
        updateObject(object.id, (current) => current.type === "livestock" ? { ...current, label: `${animal.name} Paddock`, attrs: { ...current.attrs, species: animal.name, breed: animal.breed, count: animal.defaultCount } } : current);
      }}>{farmV2Catalog.livestock.map((animal) => <option key={animal.key} value={animal.name}>{animal.name}</option>)}</select></label>
      <Detail label="Breed" value={object.attrs.breed} />
      <Detail label="Headcount" value={String(object.attrs.count)} />
    </>
  );
}

function StructureEditor({ object, updateObject }: { object: Extract<FarmV2Object, { type: "structure" }>; updateObject: (id: string, updater: (object: FarmV2Object) => FarmV2Object) => void }) {
  return (
    <label className="farmv2-detail-item"><span>Kind</span><select value={object.attrs.kind} onChange={(event) => {
      const structure = farmV2Catalog.structures.find((item) => item.name === event.target.value) ?? farmV2Catalog.structures[0];
      updateObject(object.id, (current) => current.type === "structure" ? { ...current, label: structure.name, height: structure.height, attrs: { ...current.attrs, kind: structure.name, material: structure.material, height: structure.height } } : current);
    }}>{farmV2Catalog.structures.map((structure) => <option key={structure.key} value={structure.name}>{structure.name}</option>)}</select></label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="farmv2-detail-item"><span>{label}</span><strong>{value}</strong></div>;
}

function Segmented({ options, value, labels, onChange }: { options: string[]; value: string; labels: Record<string, string>; onChange: (value: string) => void }) {
  return <div className="farmv2-segmented">{options.map((option) => <button key={option} type="button" className={option === value ? "active" : ""} onClick={() => onChange(option)}>{labels[option]}</button>)}</div>;
}

function createFarmV2Renderer(
  canvas: HTMLCanvasElement,
  getPlan: () => SavedFarmV2Plan,
  getDraft: () => { draft: LocalPoint[]; mouse: LocalPoint | null; drawType: DrawType },
): FarmV2Renderer {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  let logicalWidth = 1;
  let logicalHeight = 1;
  let raf = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    logicalWidth = Math.max(1, rect.width);
    logicalHeight = Math.max(1, rect.height);
  };

  const worldTransform = () => {
    const bbox = getBBox(getPlan().boundary.local);
    const width = Math.max(1, bbox.maxX - bbox.minX);
    const height = Math.max(1, bbox.maxY - bbox.minY);
    const scale = Math.min(104 / width, 78 / height);
    return { bbox, scale, offsetX: (boardWidth - width * scale) / 2, offsetY: (boardHeight - height * scale) / 2 };
  };
  const worldToBoard = (point: LocalPoint): LocalPoint => {
    const transform = worldTransform();
    return [transform.offsetX + (point[0] - transform.bbox.minX) * transform.scale, transform.offsetY + (point[1] - transform.bbox.minY) * transform.scale];
  };
  const boardToWorld = (point: LocalPoint): LocalPoint => {
    const transform = worldTransform();
    return [transform.bbox.minX + (point[0] - transform.offsetX) / transform.scale, transform.bbox.minY + (point[1] - transform.offsetY) / transform.scale];
  };
  const project = (point: LocalPoint, height = 0) => {
    const plan = getPlan();
    const rotated = rotatePoint(worldToBoard(point), boardCenter, plan.camera.rotation);
    return {
      x: logicalWidth * 0.49 + plan.camera.panX + (rotated[0] - rotated[1]) * tileX * plan.camera.zoom,
      y: 92 + plan.camera.panY + (rotated[0] + rotated[1]) * tileY * plan.camera.zoom - height * heightScale * plan.camera.zoom,
    };
  };
  const unproject = (screenX: number, screenY: number): LocalPoint => {
    const plan = getPlan();
    const dx = (screenX - (logicalWidth * 0.49 + plan.camera.panX)) / (tileX * plan.camera.zoom);
    const dy = (screenY - (92 + plan.camera.panY)) / (tileY * plan.camera.zoom);
    return boardToWorld(rotatePoint([(dy + dx) / 2, (dy - dx) / 2], boardCenter, -plan.camera.rotation));
  };
  const getZoomLimits = () => {
    const points = getPlan().boundary.local.map((point) => {
      const plan = getPlan();
      const rotated = rotatePoint(worldToBoard(point), boardCenter, plan.camera.rotation);
      return { x: (rotated[0] - rotated[1]) * tileX, y: (rotated[0] + rotated[1]) * tileY };
    });
    const width = Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
    const height = Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
    const min = Math.min(logicalWidth / Math.max(1, width * 1.25), logicalHeight / Math.max(1, height * 1.25));
    return { min: clamp(min, 0.12, 1.2), max: 12 };
  };
  const tracePolygon = (polygon: LocalPoint[], height: number) => {
    context.beginPath();
    polygon.forEach((point, index) => {
      const projected = project(point, height);
      if (index === 0) context.moveTo(projected.x, projected.y);
      else context.lineTo(projected.x, projected.y);
    });
    context.closePath();
  };
  const drawPolygon = (polygon: LocalPoint[], fill: string, stroke = "rgba(255,255,255,.2)", height = 0) => {
    tracePolygon(polygon, height);
    context.fillStyle = fill;
    context.fill();
    if (stroke && stroke !== "transparent") {
      context.strokeStyle = stroke;
      context.lineWidth = 1.5;
      context.stroke();
    }
  };
  const shadeColor = (hex: string, amount: number) => {
    if (hex.startsWith("rgba") || hex.startsWith("rgb")) return hex;
    const value = hex.replace("#", "");
    const expanded = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
    const r = parseInt(expanded.slice(0, 2), 16);
    const g = parseInt(expanded.slice(2, 4), 16);
    const b = parseInt(expanded.slice(4, 6), 16);
    const adjust = (channel: number) => Math.max(0, Math.min(255, Math.round(channel + amount * 255)));
    return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
  };
  const drawExtruded = (polygon: LocalPoint[], height: number, topFill: string, sideFill: string, stroke: string | null) => {
    if (height <= 0.05) {
      drawPolygon(polygon, topFill, stroke ?? "rgba(0,0,0,.3)", 0);
      return;
    }
    polygon.forEach((point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      const p1 = project(point, 0);
      const p2 = project(next, 0);
      const p3 = project(next, height);
      const p4 = project(point, height);
      const lighting = (next[0] - point[0]) - (next[1] - point[1]) > 0 ? 0.06 : -0.08;
      context.fillStyle = shadeColor(sideFill, lighting);
      context.beginPath();
      context.moveTo(p1.x, p1.y);
      context.lineTo(p2.x, p2.y);
      context.lineTo(p3.x, p3.y);
      context.lineTo(p4.x, p4.y);
      context.closePath();
      context.fill();
      if (stroke) {
        context.strokeStyle = stroke;
        context.lineWidth = 1;
        context.stroke();
      }
    });
    drawPolygon(polygon, topFill, stroke ?? "rgba(0,0,0,.35)", height);
  };
  const drawFence = (polygon: LocalPoint[], color: string, height: number) => {
    polygon.forEach((point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      const baseA = project(point, 0);
      const baseB = project(next, 0);
      const topA = project(point, height);
      const topB = project(next, height);
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(topA.x, topA.y);
      context.lineTo(topB.x, topB.y);
      context.stroke();
      const segments = 6;
      for (let s = 0; s <= segments; s += 1) {
        const t = s / segments;
        const sx = baseA.x + (baseB.x - baseA.x) * t;
        const sy = baseA.y + (baseB.y - baseA.y) * t;
        const tx = topA.x + (topB.x - topA.x) * t;
        const ty = topA.y + (topB.y - topA.y) * t;
        context.beginPath();
        context.moveTo(sx, sy);
        context.lineTo(tx, ty);
        context.stroke();
      }
    });
  };
  const drawRoofRidge = (polygon: LocalPoint[], height: number, isGreenhouse: boolean) => {
    if (polygon.length < 4) return;
    const c = polygonCentroid(polygon);
    const a: LocalPoint = [(polygon[0][0] + polygon[1][0]) / 2, (polygon[0][1] + polygon[1][1]) / 2];
    const b: LocalPoint = [(polygon[2][0] + polygon[3][0]) / 2, (polygon[2][1] + polygon[3][1]) / 2];
    const p1 = project(a, height + 0.55);
    const p2 = project(b, height + 0.55);
    const pc = project(c, height + 1.1);
    context.save();
    context.strokeStyle = isGreenhouse ? "rgba(255,255,255,.5)" : "rgba(28,32,35,.5)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(p1.x, p1.y);
    context.lineTo(pc.x, pc.y);
    context.lineTo(p2.x, p2.y);
    context.stroke();
    context.restore();
  };
  const render = () => {
    const plan = getPlan();
    context.clearRect(0, 0, logicalWidth, logicalHeight);
    const gradient = context.createLinearGradient(0, 0, 0, logicalHeight);
    gradient.addColorStop(0, "#253534");
    gradient.addColorStop(0.55, "#19231f");
    gradient.addColorStop(1, "#101511");
    context.fillStyle = gradient;
    context.fillRect(0, 0, logicalWidth, logicalHeight);
    drawPolygon(plan.boundary.local, plan.view === "satellite" ? "#5c7c4c" : "#496b47", "#203029", 0);
    drawFence(plan.boundary.local, "#d4b16b", 0.3);
    plan.objects.forEach((object) => {
      const isSelected = object.id === plan.selectedId;
      const stroke = isSelected ? "#f8e08a" : "rgba(0,0,0,.35)";
      if (object.type === "path") {
        context.beginPath();
        object.points.forEach((point, index) => {
          const projected = project(point, 0.3);
          if (index === 0) context.moveTo(projected.x, projected.y);
          else context.lineTo(projected.x, projected.y);
        });
        context.strokeStyle = isSelected ? "#f8e08a" : "#c59d5b";
        context.lineWidth = isSelected ? 5 : 4;
        context.stroke();
      } else if (object.type === "cropArea") {
        drawExtruded(object.polygon, object.height, "#8b6a43", "#5f4a2b", stroke);
      } else if (object.type === "cropField") {
        drawExtruded(object.polygon, object.height, "#5f9f55", "#3f6f3a", stroke);
      } else if (object.type === "livestock") {
        drawExtruded(object.polygon, object.height, "#a7b85b", "#7a8744", stroke);
        drawFence(object.polygon, "#c9a865", object.height + 0.25);
      } else if (object.type === "structure") {
        const isGreenhouse = object.attrs.kind === "Greenhouse";
        const topFill = isGreenhouse ? "rgba(137,204,198,.7)" : "#58697a";
        const sideFill = isGreenhouse ? "rgba(90,138,134,.6)" : "#9a6848";
        drawExtruded(object.polygon, object.height, topFill, sideFill, stroke);
        drawRoofRidge(object.polygon, object.height, isGreenhouse);
      }
      const labelPoint = "polygon" in object ? polygonCentroid(object.polygon) : object.points[Math.floor(object.points.length / 2)];
      const p = project(labelPoint, "height" in object ? object.height + 0.2 : 0.8);
      context.fillStyle = "rgba(10,14,12,.78)";
      context.fillRect(p.x - 44, p.y - 18, 88, 18);
      context.fillStyle = "#edf4e7";
      context.font = "11px ui-monospace, monospace";
      context.textAlign = "center";
      context.fillText(object.label.slice(0, 18), p.x, p.y - 5);
    });
    const { draft, mouse, drawType } = getDraft();
    if (draft.length || mouse) {
      const points = mouse ? [...draft, mouse] : draft;
      const isPath = drawType === "path";
      context.save();
      context.beginPath();
      points.forEach((point, index) => {
        const p = project(point, 0.5);
        if (index === 0) context.moveTo(p.x, p.y);
        else context.lineTo(p.x, p.y);
      });
      if (!isPath && draft.length >= 3) {
        context.closePath();
        context.fillStyle = "rgba(240,195,90,.18)";
        context.fill();
      }
      context.strokeStyle = "#f0c35a";
      context.lineWidth = 2.5;
      context.stroke();
      context.restore();
      draft.forEach((point) => {
        const p = project(point, 0.6);
        context.fillStyle = "#f0c35a";
        context.beginPath();
        context.moveTo(p.x, p.y - 5);
        context.lineTo(p.x + 5, p.y);
        context.lineTo(p.x, p.y + 5);
        context.lineTo(p.x - 5, p.y);
        context.closePath();
        context.fill();
      });
      if (mouse) {
        const p = project(mouse, 0.6);
        context.strokeStyle = "rgba(255,245,184,.95)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(p.x, p.y - 7);
        context.lineTo(p.x + 7, p.y);
        context.lineTo(p.x, p.y + 7);
        context.lineTo(p.x - 7, p.y);
        context.closePath();
        context.stroke();
      }
    }
    raf = window.requestAnimationFrame(render);
  };
  const hitTestAll = (point: LocalPoint) => getPlan().objects
    .map((object) => ({ object, center: "polygon" in object ? polygonCentroid(object.polygon) : object.points[Math.floor(object.points.length / 2)] }))
    .filter(({ object }) => object.type === "path" ? minPathDistance(point, object.points) < 2.5 : "polygon" in object && pointInPolygon(point, object.polygon))
    .map(({ object, center }) => ({ id: object.id, distance: distance(point, center) }))
    .sort((left, right) => left.distance - right.distance);

  resize();
  window.addEventListener("resize", resize);
  raf = window.requestAnimationFrame(render);
  return {
    project,
    unproject,
    hitTestAll,
    getZoomLimits,
    destroy: () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    },
  };
}

function emptyBoundarySource() {
  return { type: "geojson" as const, data: { type: "FeatureCollection" as const, features: [] } };
}

function updateBoundarySource(map: import("maplibre-gl").Map, points: GeoPoint[]) {
  const source = map.getSource("farm-boundary") as import("maplibre-gl").GeoJSONSource | undefined;
  if (!source) return;
  const features: GeoJSON.Feature[] = [];
  if (points.length >= 2) {
    features.push({
      type: "Feature",
      geometry: {
        type: points.length >= 3 ? "Polygon" : "LineString",
        coordinates: points.length >= 3 ? [[...points, points[0]]] : points,
      },
      properties: {},
    } as GeoJSON.Feature);
  }
  points.forEach((point) => features.push({ type: "Feature", geometry: { type: "Point", coordinates: point }, properties: {} } as GeoJSON.Feature));
  source.setData({ type: "FeatureCollection", features });
}

function minPathDistance(point: LocalPoint, points: LocalPoint[]) {
  return points.reduce((min, current, index) => {
    const next = points[index + 1];
    if (!next) return min;
    return Math.min(min, distanceToSegment(point, current, next));
  }, Infinity);
}

function distanceToSegment(point: LocalPoint, a: LocalPoint, b: LocalPoint) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = dx * dx + dy * dy;
  const t = length ? clamp(((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / length, 0, 1) : 0;
  return distance(point, [a[0] + dx * t, a[1] + dy * t]);
}

function pathLength(points: LocalPoint[]) {
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) total += distance(points[index], points[index + 1]);
  return total;
}

function formatArea(areaFt: number, units: "ft" | "m") {
  if (units === "m") return `${Math.round(areaFt * 0.092903)} m2`;
  return `${Math.round(areaFt).toLocaleString("en-US")} ft2`;
}

function formatLength(lengthFt: number, units: "ft" | "m") {
  if (units === "m") return `${(lengthFt * 0.3048).toFixed(1)} m`;
  return `${lengthFt.toFixed(1)} ft`;
}

function formatDate(dateText: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(dateText));
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

function FarmV2Styles() {
  return (
    <style jsx global>{`
      .farmv2-shell{--panel:rgba(21,29,26,.9);--border:rgba(218,229,206,.16);--text:#edf4e7;--muted:#9fb09f;--accent:#f0c35a;position:relative;display:grid;grid-template-rows:auto 1fr auto;height:calc(100vh - 7rem);min-height:720px;overflow:hidden;border:1px solid var(--border);border-radius:8px;background:#111714;color:var(--text)}
      .farmv2-shell button,.farmv2-shell input,.farmv2-shell select{font:inherit}
      .farmv2-shell button{height:34px;min-width:38px;border:1px solid var(--border);border-radius:7px;background:rgba(255,255,255,.07);color:var(--text);cursor:pointer}
      .farmv2-shell button:hover{background:rgba(255,255,255,.12)}
      .farmv2-shell button.active{border-color:rgba(240,195,90,.85);background:#dcae49;color:#19150d}
      .farmv2-topbar{z-index:4;display:flex;align-items:center;gap:16px;min-height:66px;padding:12px 16px;border-bottom:1px solid var(--border);background:rgba(13,18,16,.9);backdrop-filter:blur(16px)}
      .farmv2-brand{display:flex;align-items:center;gap:11px;min-width:190px}.farmv2-brand-mark{width:34px;height:34px;border-radius:7px;background:linear-gradient(135deg,#67c5a0 0 49%,transparent 50%),linear-gradient(45deg,transparent 0 42%,#f0c35a 43% 100%),#314438}.farmv2-eyebrow{display:block;color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
      .farmv2-toolbar{display:flex;align-items:center;gap:8px}.farmv2-toolbar-right{margin-left:auto}.farmv2-segmented{display:inline-flex;overflow:hidden;border:1px solid var(--border);border-radius:8px}.farmv2-segmented button{border:0;border-radius:0}
      .farmv2-stage{position:relative;min-height:0;background:radial-gradient(circle at 20% 15%,rgba(103,197,160,.12),transparent 24%),linear-gradient(180deg,#253534 0%,#18211d 52%,#101511 100%)}.farmv2-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:crosshair}
      .farmv2-panel{position:absolute;top:18px;right:18px;z-index:3;width:min(340px,calc(100vw - 36px));max-height:calc(100% - 112px);overflow:auto;border:1px solid var(--border);border-radius:8px;background:var(--panel);box-shadow:0 18px 45px rgba(0,0,0,.28);backdrop-filter:blur(18px)}
      .farmv2-panel-header{padding:15px 16px 12px;border-bottom:1px solid var(--border)}.farmv2-panel-header span,.farmv2-detail-item span{display:block;margin-bottom:5px;color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.farmv2-panel-header input{width:100%;border:1px solid var(--border);border-radius:7px;background:rgba(255,255,255,.07);color:var(--text);font-size:18px;font-weight:800;padding:8px}
      .farmv2-details{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:14px 16px 16px}.farmv2-detail-item{min-height:58px;padding:10px;border:1px solid var(--border);border-radius:7px;background:rgba(255,255,255,.045)}.farmv2-detail-item select,.farmv2-detail-item input{width:100%;height:34px;border:1px solid var(--border);border-radius:7px;background:rgba(255,255,255,.07);color:var(--text);padding:0 8px}.farmv2-danger{grid-column:1/-1;border-color:rgba(223,112,93,.62)!important;background:rgba(223,112,93,.14)!important;color:#ffd7cf!important}
      .farmv2-snapshot{position:absolute;left:18px;top:18px;z-index:3;min-width:210px;padding:11px 13px;border:1px solid var(--border);border-radius:8px;background:rgba(21,29,26,.78);backdrop-filter:blur(14px)}.farmv2-snapshot span{display:block;color:var(--muted);font-size:12px}.farmv2-snapshot strong{display:block;font-size:17px}.farmv2-loading{position:absolute;inset:0;display:grid;place-items:center;z-index:5;background:#111714;color:var(--text)}
      .farmv2-timeline{z-index:4;display:grid;grid-template-columns:auto 1fr minmax(190px,280px);grid-template-rows:auto auto;gap:8px 12px;padding:12px 16px 14px;border-top:1px solid var(--border);background:rgba(13,18,16,.93);backdrop-filter:blur(16px)}.farmv2-timeline input[type=range]{width:100%;accent-color:var(--accent)}.farmv2-marker-row{grid-column:2;display:grid;grid-template-columns:repeat(var(--marker-count),minmax(0,1fr));gap:7px}.farmv2-marker-row button{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)}.farmv2-commit-form{grid-row:1/span 2;grid-column:3;display:grid;grid-template-columns:1fr auto;gap:8px;align-self:center}.farmv2-commit-form input{height:34px;border:1px solid var(--border);border-radius:7px;background:rgba(255,255,255,.07);color:var(--text);padding:0 10px}
      .farmv2-onboarding{position:absolute;inset:0;z-index:10;display:grid;place-items:center;padding:22px;background:radial-gradient(circle at 20% 12%,rgba(103,197,160,.18),transparent 24%),rgba(10,14,12,.92);backdrop-filter:blur(16px)}.farmv2-onboarding-card{display:grid;grid-template-columns:minmax(260px,360px) minmax(420px,760px);width:min(1180px,100%);min-height:min(720px,calc(100vh - 44px));overflow:hidden;border:1px solid var(--border);border-radius:8px;background:rgba(18,25,22,.96);box-shadow:0 28px 90px rgba(0,0,0,.36)}.farmv2-wizard-copy{padding:28px;border-right:1px solid var(--border);background:linear-gradient(180deg,rgba(103,197,160,.08),transparent 38%),#151d1a}.farmv2-wizard-copy h1,.farmv2-choice-card h2{margin:6px 0 10px;font-size:28px;line-height:1.05}.farmv2-wizard-copy p,.farmv2-choice-card span{color:var(--muted);font-size:14px;line-height:1.5}.farmv2-map-shell{position:relative;min-height:520px;background:#203029}.farmv2-boundary-map{position:absolute;inset:0}.farmv2-map-tools{position:absolute;left:14px;right:14px;bottom:14px;z-index:2;display:flex;justify-content:flex-end;gap:8px}.farmv2-setup-choice{position:absolute;inset:0;display:grid;place-items:center;padding:22px;background:rgba(10,14,12,.78)}.farmv2-choice-card{width:min(680px,100%);border:1px solid var(--border);border-radius:8px;padding:22px;background:rgba(21,29,26,.96);box-shadow:0 24px 70px rgba(0,0,0,.34)}.farmv2-choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.farmv2-choice-grid button{height:auto;min-height:126px;padding:16px;text-align:left}.farmv2-choice-grid strong{display:block;margin-bottom:7px;font-size:18px}.farmv2-error{max-width:300px;color:#ffd7cf;font-size:12px}
      .farmv2-topbar,.farmv2-timeline{border-color:#3b2a14;background:#fffaf0;color:#2d2313;box-shadow:0 2px 0 #3b2a14;backdrop-filter:none}
      .farmv2-topbar{border-bottom-width:2px}.farmv2-timeline{border-top-width:2px}
      .farmv2-brand strong{color:#34432b;font-family:var(--font-geist-mono),ui-monospace,monospace;font-size:13px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.farmv2-brand-mark{border:2px solid #8b6f3e;background:linear-gradient(135deg,#67c5a0 0 49%,transparent 50%),linear-gradient(45deg,transparent 0 42%,#ffe89a 43% 100%),#fffdf5;box-shadow:inset 0 2px 0 rgba(255,255,255,.6),inset 0 -3px 0 rgba(168,118,28,.25),0 2px 0 #5e4a26}.farmv2-topbar .farmv2-eyebrow{color:#746850}
      .farmv2-shell button,.farmv2-map-tools button,.farmv2-choice-grid button,.farmv2-commit-form button{min-height:34px;border:2px solid #8b6f3e;border-radius:0;background:#fffdf5;color:#5e4a26;box-shadow:0 2px 0 #5e4a26;font-family:var(--font-geist-mono),ui-monospace,monospace;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;transition:background-color .15s ease,transform .15s ease,box-shadow .15s ease,border-color .15s ease}
      .farmv2-shell button:hover,.farmv2-map-tools button:hover,.farmv2-choice-grid button:hover,.farmv2-commit-form button:hover{border-color:#3b2a14;background:#fff3cf;color:#3b2a14}
      .farmv2-shell button:active,.farmv2-map-tools button:active,.farmv2-choice-grid button:active,.farmv2-commit-form button:active{transform:translateY(2px);box-shadow:0 1px 0 #5e4a26}
      .farmv2-shell button:disabled,.farmv2-commit-form button:disabled{cursor:not-allowed;background:#d8cfaa;color:#746850;box-shadow:none;opacity:.7}
      .farmv2-shell button.active,.farmv2-marker-row button.active{border-color:#3b2a14;background:#ffd667;color:#3b2a14;box-shadow:inset 0 2px 0 rgba(255,255,255,.55),inset 0 -3px 0 rgba(168,118,28,.28),0 2px 0 #3b2a14}
      .farmv2-segmented{display:inline-flex;gap:4px;overflow:visible;border:2px solid #3b2a14;border-radius:0;background:#fffdf5;padding:3px;box-shadow:0 2px 0 #3b2a14}.farmv2-segmented button{height:30px;min-width:0;border-color:transparent;background:transparent;box-shadow:none;color:#837766;font-size:10px}.farmv2-segmented button:hover{border-color:#c9b88a;background:#fff8dc;box-shadow:0 1px 0 #b29c66}.farmv2-segmented button.active{border-color:#8b6f3e;background:#fff3cf;color:#2d2313;box-shadow:inset 0 2px 0 rgba(255,255,255,.55),0 2px 0 #5e4a26}
      .farmv2-panel-header input,.farmv2-detail-item select,.farmv2-detail-item input,.farmv2-commit-form input{border:2px solid #c9b88a;border-radius:0;background:#fffdf5;color:#365833;box-shadow:inset 0 2px 0 rgba(255,255,255,.65);font-weight:800;outline:none}.farmv2-panel-header input:focus,.farmv2-detail-item select:focus,.farmv2-detail-item input:focus,.farmv2-commit-form input:focus{border-color:#8b6f3e;background:#fff8dc}
      .farmv2-timeline input[type=range]{accent-color:#8b6f3e}.farmv2-marker-row button{color:#5e4a26;border-color:#c9b88a;background:#fffdf5;box-shadow:0 2px 0 #b29c66}.farmv2-commit-form input::placeholder{color:#9a8a66}
      .farmv2-map-tools button{background:#fffdf5;color:#5e4a26}.farmv2-choice-grid button{border-color:#3b2a14;background:#fffdf5;color:#2d2313;box-shadow:0 3px 0 #3b2a14}.farmv2-choice-grid button strong{font-family:var(--font-geist-mono),ui-monospace,monospace;font-size:13px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#34432b}.farmv2-choice-grid button span{color:#746850;font-family:var(--font-geist-sans),ui-sans-serif,system-ui,sans-serif;font-size:13px;font-weight:700;letter-spacing:0;text-transform:none}
      .farmv2-danger{border-color:#9b3b2f!important;background:#fff1ea!important;color:#8b3d22!important;box-shadow:0 2px 0 #6f2a22!important}.farmv2-danger:hover{background:#ffd7cf!important;color:#5a1d16!important}
      @media(max-width:940px){.farmv2-topbar{flex-wrap:wrap}.farmv2-brand{width:100%}.farmv2-toolbar-right{margin-left:0}.farmv2-panel{top:auto;right:12px;bottom:12px;max-height:45%}.farmv2-onboarding-card{grid-template-columns:1fr}.farmv2-wizard-copy{border-right:0;border-bottom:1px solid var(--border)}}@media(max-width:660px){.farmv2-toolbar{flex-wrap:wrap}.farmv2-topbar{max-height:45vh;overflow:auto}.farmv2-timeline{grid-template-columns:1fr}.farmv2-marker-row,.farmv2-commit-form{grid-column:1;grid-row:auto}}
    `}</style>
  );
}
