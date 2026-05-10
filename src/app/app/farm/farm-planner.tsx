"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { FarmObjectType, FarmPlanAnalytics, FarmPlanContext, GeometryPoint, PlanObject, PlanTile, PlanTileType } from "@/lib/models";

type SavedPlanObject = Omit<PlanObject, "sourceId"> & {
  sourceId?: string | null;
};
type SavedPlan = {
  _id: string;
  name: string;
  createdAt: string;
  baseGeometry?: {
    locationLabel: string;
    points: GeometryPoint[];
    areaSquareMeters: number;
    areaSquareFeet?: number;
  };
  farmContext?: FarmPlanContext;
  tiles?: PlanTile[];
  objects?: SavedPlanObject[];
  analytics?: FarmPlanAnalytics;
  summary?: {
    description: string;
    highlights: string[];
    maintenanceLevel: "low" | "medium" | "high";
  };
  generation?: {
    score: number;
    strategy: string;
  };
};

const davisCenter = { lat: 38.5449, lng: -121.7405 };
const tileSize = 256;
const imageryUrl = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

const tileTypeColors: Record<PlanTileType, string> = {
  tomato: "#6e9f45",
  lettuce: "#7ec65b",
  corn: "#d5b84b",
  potato: "#9b7a4b",
  strawberry: "#5f9d58",
  pea: "#66ad63",
  mushroom: "#b99067",
  herb: "#3f8b58",
  pollinator: "#9bb75d",
  chicken: "#d8ae48",
  goat: "#b99a65",
  storage: "#92704d",
  greenhouse: "#74b8be",
  compost: "#7a5a34",
  path: "#c7ad72",
};

const defaultTileIcons: Record<PlanTileType, string> = {
  tomato: "/inventory-icons/tomato.png",
  lettuce: "/inventory-icons/lettuce.png",
  corn: "/inventory-icons/corn.png",
  potato: "/inventory-icons/potato.png",
  strawberry: "/inventory-icons/strawberry.png",
  pea: "/inventory-icons/pea-pod.png",
  mushroom: "/inventory-icons/mushroom.png",
  herb: "/inventory-icons/lettuce.png",
  pollinator: "/inventory-icons/strawberry.png",
  chicken: "/inventory-icons/egg.png",
  goat: "/inventory-icons/hammer.png",
  storage: "/inventory-icons/hammer.png",
  greenhouse: "/inventory-icons/hammer.png",
  compost: "/inventory-icons/hammer.png",
  path: "/inventory-icons/hammer.png",
};

type TileSummary = {
  tileType: PlanTileType;
  assignmentName: string;
  count: number;
  color: string;
  iconPath: string;
  sunExposure: PlanTile["sunExposure"];
  waterNeed: PlanTile["waterNeed"];
  center: {
    x: number;
    z: number;
  };
};

export function FarmPlanner() {
  const [points, setPoints] = useState<GeometryPoint[]>([]);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [activePlan, setActivePlan] = useState<SavedPlan | null>(null);
  const [view, setView] = useState<"select" | "plans">("select");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeLivestock, setIncludeLivestock] = useState(true);
  const [includeStructures, setIncludeStructures] = useState(true);

  useEffect(() => {
    let ignore = false;

    fetch("/api/farm/plans", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as { plans?: SavedPlan[]; error?: string };

        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load farm plans");
        }

        return data.plans ?? [];
      })
      .then((nextPlans) => {
        if (ignore) {
          return;
        }

        setPlans(nextPlans);
        setActivePlan(nextPlans[0] ?? null);

        if (nextPlans[0]?.baseGeometry?.points?.length) {
          setPoints(nextPlans[0].baseGeometry.points);
        }
      })
      .catch((loadError: unknown) => {
        if (!ignore) {
          setError(formatUiError(loadError));
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  async function generatePlan() {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/farm/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: normalizePlotPoints(points),
          locationLabel: locationFromPoints(points),
          weatherProfile: weatherFromPoints(points),
          strategy: "balanced",
          includeLivestock,
          includeStructures,
        }),
      });
      const data = (await response.json()) as { plan?: SavedPlan; error?: string };

      if (!response.ok || !data.plan) {
        throw new Error(data.error ?? "Unable to generate plan");
      }

      setPlans((current) => [data.plan as SavedPlan, ...current].slice(0, 8));
      setActivePlan(data.plan);
      setView("plans");
    } catch (generateError) {
      setError(formatUiError(generateError));
    } finally {
      setIsGenerating(false);
    }
  }

  async function savePlanObjects(planId: string, objects: SavedPlanObject[]) {
    setError(null);

    const response = await fetch("/api/farm/plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, objects }),
    });
    const data = (await response.json()) as { plan?: SavedPlan; error?: string };

    if (!response.ok || !data.plan) {
      throw new Error(data.error ?? "Unable to save plan edits");
    }

    setPlans((current) => current.map((plan) => (plan._id === planId ? data.plan as SavedPlan : plan)));
    setActivePlan(data.plan);
  }

  return (
    <section className="flex min-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-lg border border-[#eadfca] bg-[#fffdf5]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eadfca] bg-[#fffaf0] px-4 py-3">
        <div className="grid grid-cols-2 gap-1 rounded-md border border-[#eadfca] bg-white p-1">
          <button
            type="button"
            onClick={() => setView("select")}
            className={`rounded px-4 py-2 text-sm font-medium ${
              view === "select" ? "bg-[#2f6f4e] text-white" : "text-[#6b6254] hover:bg-[#f8f1df]"
            }`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => setView("plans")}
            className={`rounded px-4 py-2 text-sm font-medium ${
              view === "plans" ? "bg-[#2f6f4e] text-white" : "text-[#6b6254] hover:bg-[#f8f1df]"
            }`}
          >
            Plans
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {error ? <span className="rounded bg-[#fff1ea] px-3 py-2 text-sm text-[#8b3d22]">{error}</span> : null}
          {view === "select" ? (
            <>
              <span className="rounded-md border border-[#d8ceb9] bg-white px-3 py-2 text-sm text-[#5d5345]">
                {points.length}/12
              </span>
              <label className="flex h-10 items-center gap-2 rounded-md border border-[#d8ceb9] bg-white px-3 text-sm text-[#5d5345]">
                <input
                  type="checkbox"
                  checked={includeLivestock}
                  onChange={(event) => setIncludeLivestock(event.target.checked)}
                />
                Livestock
              </label>
              <label className="flex h-10 items-center gap-2 rounded-md border border-[#d8ceb9] bg-white px-3 text-sm text-[#5d5345]">
                <input
                  type="checkbox"
                  checked={includeStructures}
                  onChange={(event) => setIncludeStructures(event.target.checked)}
                />
                Structures
              </label>
              <button
                type="button"
                onClick={() => setPoints((current) => current.slice(0, -1))}
                disabled={!points.length}
                className="h-10 rounded-md border border-[#d8ceb9] bg-white px-3 text-sm text-[#5d5345] disabled:opacity-45"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => setPoints([])}
                className="h-10 rounded-md border border-[#d8ceb9] bg-white px-3 text-sm text-[#5d5345]"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={generatePlan}
                disabled={points.length < 4 || isGenerating}
                className="h-10 rounded-md bg-[#2f6f4e] px-5 text-sm font-semibold text-white transition hover:bg-[#24583d] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isGenerating ? "Generating..." : "Generate"}
              </button>
            </>
          ) : (
            <span className="rounded-md border border-[#d8ceb9] bg-white px-3 py-2 text-sm text-[#5d5345]">
              {isLoading ? "Loading..." : `${plans.length} plans`}
            </span>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {view === "select" ? (
          <SatellitePlot points={points} setPoints={setPoints} />
        ) : (
          <PlansView
            plans={plans}
            activePlan={activePlan}
            setActivePlan={setActivePlan}
            setPoints={setPoints}
            savePlanObjects={savePlanObjects}
          />
        )}
      </div>
    </section>
  );
}

function SatellitePlot({
  points,
  setPoints,
}: {
  points: GeometryPoint[];
  setPoints: React.Dispatch<React.SetStateAction<GeometryPoint[]>>;
}) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const [center, setCenter] = useState(davisCenter);
  const [zoom, setZoom] = useState(19);
  const [size, setSize] = useState({ width: 900, height: 620 });
  const dragRef = useRef({ x: 0, y: 0, moved: 0, center: davisCenter });

  useEffect(() => {
    const node = mapNodeRef.current;

    if (!node) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(1, Math.round(entry.contentRect.width)),
        height: Math.max(1, Math.round(entry.contentRect.height)),
      });
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const tiles = getVisibleTiles(center, zoom, size);
  const centerPx = latLngToWorldPx(center.lat, center.lng, zoom);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      moved: 0,
      center,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    const drag = dragRef.current;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
    const startPx = latLngToWorldPx(drag.center.lat, drag.center.lng, zoom);
    setCenter(worldPxToLatLng(startPx.x - dx, startPx.y - dy, zoom));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const node = event.currentTarget;

    if (node.hasPointerCapture(event.pointerId)) {
      node.releasePointerCapture(event.pointerId);
    }
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    if (dragRef.current.moved > 6) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const screen = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const world = {
      x: centerPx.x + screen.x - size.width / 2,
      y: centerPx.y + screen.y - size.height / 2,
    };
    const latLng = worldPxToLatLng(world.x, world.y, zoom);

    setPoints((current) => [...current, pointFromLatLng(latLng, current)].slice(0, 12));
  }

  function changeZoom(nextZoom: number) {
    setZoom(clamp(Math.round(nextZoom), 16, 21));
  }

  return (
    <div
      ref={mapNodeRef}
      className="relative min-h-[calc(100vh-10.5rem)] touch-none overflow-hidden bg-[#1e3327]"
      aria-label="Satellite plot map"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
    >
      {tiles.map((tile) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${tile.z}-${tile.x}-${tile.y}`}
          alt=""
          draggable={false}
          src={`${imageryUrl}/${tile.z}/${tile.y}/${tile.x}`}
          className="absolute size-[256px] select-none"
          style={{ transform: `translate(${tile.left}px, ${tile.top}px)` }}
        />
      ))}

      <svg className="pointer-events-none absolute inset-0 size-full">
        {points.length >= 3 ? (
          <polygon
            points={points.map((point) => screenPoint(point, centerPx, zoom, size)).join(" ")}
            fill="rgba(255, 243, 207, 0.23)"
            stroke="#f5d673"
            strokeWidth="3"
          />
        ) : null}
        {points.map((point, index) => {
          const [x, y] = screenPoint(point, centerPx, zoom, size).split(",").map(Number);

          return (
            <g key={`${point.lat}-${point.lng}-${index}`}>
              <circle cx={x} cy={y} r="10" fill="#fff8dc" stroke="#2f6f4e" strokeWidth="3" />
              <text x={x} y={y + 4} textAnchor="middle" fill="#1f3d28" fontSize="12" fontWeight="700">
                {index + 1}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="absolute left-4 top-4 rounded-md bg-[#223923]/80 px-3 py-2 text-xs font-semibold text-white shadow-sm backdrop-blur">
        Select plot
      </div>
      <div className="absolute right-4 top-4 grid overflow-hidden rounded-md border border-white/30 bg-white/85 text-[#2d2313] shadow-sm">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            changeZoom(zoom + 1);
          }}
          className="grid size-9 place-items-center text-lg font-semibold"
        >
          +
        </button>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            changeZoom(zoom - 1);
          }}
          className="grid size-9 place-items-center text-lg font-semibold"
        >
          -
        </button>
      </div>
      <div className="absolute bottom-2 right-3 rounded bg-black/45 px-2 py-1 text-[10px] font-medium text-white">
        Esri
      </div>
    </div>
  );
}

function getVisibleTiles(
  center: { lat: number; lng: number },
  zoom: number,
  size: { width: number; height: number },
) {
  const centerPx = latLngToWorldPx(center.lat, center.lng, zoom);
  const startX = Math.floor((centerPx.x - size.width / 2) / tileSize) - 1;
  const endX = Math.floor((centerPx.x + size.width / 2) / tileSize) + 1;
  const startY = Math.floor((centerPx.y - size.height / 2) / tileSize) - 1;
  const endY = Math.floor((centerPx.y + size.height / 2) / tileSize) + 1;
  const maxTile = 2 ** zoom;
  const tiles = [];

  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      if (y < 0 || y >= maxTile) {
        continue;
      }

      const wrappedX = ((x % maxTile) + maxTile) % maxTile;
      tiles.push({
        x: wrappedX,
        y,
        z: zoom,
        left: x * tileSize - centerPx.x + size.width / 2,
        top: y * tileSize - centerPx.y + size.height / 2,
      });
    }
  }

  return tiles;
}

function latLngToWorldPx(lat: number, lng: number, zoom: number) {
  const sinLat = Math.sin((clamp(lat, -85.05112878, 85.05112878) * Math.PI) / 180);
  const scale = tileSize * 2 ** zoom;

  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function worldPxToLatLng(x: number, y: number, zoom: number) {
  const scale = tileSize * 2 ** zoom;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

  return {
    lat: Number(lat.toFixed(7)),
    lng: Number(lng.toFixed(7)),
  };
}

function screenPoint(
  point: GeometryPoint,
  centerPx: { x: number; y: number },
  zoom: number,
  size: { width: number; height: number },
) {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return `${(point.x / 100) * size.width},${(point.y / 100) * size.height}`;
  }

  const world = latLngToWorldPx(point.lat as number, point.lng as number, zoom);

  return `${world.x - centerPx.x + size.width / 2},${world.y - centerPx.y + size.height / 2}`;
}

function pointFromLatLng(
  latLng: { lat: number; lng: number },
  existingPoints: GeometryPoint[],
): GeometryPoint {
  return normalizePlotPoints([...existingPoints, { ...latLng, x: 50, y: 50 }]).at(-1) ?? {
    ...latLng,
    x: 50,
    y: 50,
  };
}

function normalizePlotPoints(points: GeometryPoint[]) {
  const latLngPoints = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

  if (latLngPoints.length < 2) {
    return points;
  }

  const lats = latLngPoints.map((point) => point.lat as number);
  const lngs = latLngPoints.map((point) => point.lng as number);
  const north = Math.max(...lats);
  const south = Math.min(...lats);
  const east = Math.max(...lngs);
  const west = Math.min(...lngs);
  const latSpan = Math.max(north - south, 0.000001);
  const lngSpan = Math.max(east - west, 0.000001);

  return points.map((point) => {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
      return point;
    }

    return {
      ...point,
      x: Number((((point.lng as number) - west) / lngSpan * 100).toFixed(2)),
      y: Number(((north - (point.lat as number)) / latSpan * 100).toFixed(2)),
    };
  });
}

function locationFromPoints(points: GeometryPoint[]) {
  const latLngPoints = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));

  if (!latLngPoints.length) {
    return "Selected plot";
  }

  const centroid = latLngPoints.reduce(
    (sum, point) => ({
      lat: sum.lat + (point.lat as number),
      lng: sum.lng + (point.lng as number),
    }),
    { lat: 0, lng: 0 },
  );

  return `${(centroid.lat / latLngPoints.length).toFixed(5)}, ${(centroid.lng / latLngPoints.length).toFixed(5)}`;
}

function weatherFromPoints(points: GeometryPoint[]) {
  const lat = points.find((point) => Number.isFinite(point.lat))?.lat ?? davisCenter.lat;

  if (lat > 43) {
    return "cold";
  }

  if (lat > 31 && lat < 42) {
    return "dry";
  }

  return "temperate";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function PlansView({
  plans,
  activePlan,
  setActivePlan,
  setPoints,
  savePlanObjects,
}: {
  plans: SavedPlan[];
  activePlan: SavedPlan | null;
  setActivePlan: React.Dispatch<React.SetStateAction<SavedPlan | null>>;
  setPoints: React.Dispatch<React.SetStateAction<GeometryPoint[]>>;
  savePlanObjects: (planId: string, objects: SavedPlanObject[]) => Promise<void>;
}) {
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const selectedObject = activePlan?.objects?.find((object) => object.instanceId === selectedSectionId) ?? null;

  return (
    <div className={`grid min-h-[calc(100vh-10.5rem)] grid-cols-1 ${selectedObject ? "lg:grid-cols-[280px_minmax(0,1fr)_320px]" : "lg:grid-cols-[300px_minmax(0,1fr)]"}`}>
      <aside className="border-b border-[#eadfca] bg-[#fffaf0] p-3 lg:border-b-0 lg:border-r">
        {plans.length ? (
          <div className="space-y-2">
            {plans.map((plan) => (
              <button
                key={plan._id}
                type="button"
                onClick={() => {
                  setActivePlan(plan);
                  setSelectedSectionId(null);
                  if (plan.baseGeometry?.points?.length) {
                    setPoints(plan.baseGeometry.points);
                  }
                }}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  activePlan?._id === plan._id
                    ? "border-[#2f6f4e] bg-[#eef8e9]"
                    : "border-[#eadfca] bg-white hover:bg-[#fff8dc]"
                }`}
              >
                <span className="block truncate font-medium text-[#2d2313]">{plan.name}</span>
                <span className="block text-xs text-[#7a6b55]">
                  {(plan.tiles?.length ?? 0).toLocaleString("en-US")} blocks
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-[#eadfca] bg-white px-3 py-2 text-sm text-[#7a6b55]">No plans</p>
        )}
      </aside>

      <div className="grid min-h-[620px] grid-rows-[minmax(360px,1fr)_auto]">
        <SolarPunkScene
          plan={activePlan}
          selectedSectionId={selectedSectionId}
          setSelectedSectionId={setSelectedSectionId}
        />
        <PlanDetails
          plan={activePlan}
          savePlanObjects={savePlanObjects}
          selectedSectionId={selectedSectionId}
          setSelectedSectionId={setSelectedSectionId}
        />
      </div>
      {selectedObject ? (
        <SectionSidePanel object={selectedObject} plan={activePlan} onClose={() => setSelectedSectionId(null)} />
      ) : null}
    </div>
  );
}

function SolarPunkScene({
  plan,
  selectedSectionId,
  setSelectedSectionId,
}: {
  plan: SavedPlan | null;
  selectedSectionId: string | null;
  setSelectedSectionId: (sectionId: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneZoomRef = useRef(1);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [sceneZoom, setSceneZoom] = useState(1);
  const hasTiles = Boolean(plan?.tiles?.length);

  function setViewerZoom(nextZoom: number) {
    const zoom = clamp(nextZoom, 0.35, 4);
    sceneZoomRef.current = zoom;
    setSceneZoom(zoom);
  }

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !plan?.tiles?.length) {
      return;
    }

    let disposed = false;
    const setFallback = (value: boolean) => {
      queueMicrotask(() => {
        if (!disposed) {
          setWebglUnavailable(value);
        }
      });
    };

    setWebglUnavailable(false);
    const contextOptions = { antialias: true, preserveDrawingBuffer: true };
    const gl =
      canvas.getContext("webgl2", contextOptions) ??
      canvas.getContext("webgl", contextOptions);

    if (!gl) {
      setFallback(true);
      return;
    }

    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: gl as WebGLRenderingContext,
        antialias: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      setFallback(true);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    const tileBounds = getTileRenderBounds(plan.tiles);
    const maxDimension = Math.max(tileBounds.width, tileBounds.depth);
    scene.background = new THREE.Color("#bfe5ed");
    scene.fog = new THREE.Fog("#bfe5ed", maxDimension * 1.1, maxDimension * 3.6);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, Math.max(120, maxDimension * 5));
    camera.position.set(0, 18, 24);
    camera.lookAt(0, 0, 0);

    const root = new THREE.Group();
    root.rotation.y = -0.35;
    scene.add(root);

    const ambient = new THREE.HemisphereLight("#fff7dd", "#34543f", 2.6);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight("#fff3b0", 3.2);
    sun.position.set(8, 18, 6);
    sun.castShadow = true;
    scene.add(sun);

    const groundRadius = maxDimension * 0.72 + 4;
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(groundRadius, 64),
      new THREE.MeshLambertMaterial({ color: "#476943" }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    root.add(ground);

    const pickTargets = addVoxelTiles(root, plan.tiles, selectedSectionId);
    addHomesteadDetails(root, plan.tiles);
    addClusterLabels(root, summarizeTiles(plan.tiles), maxDimension);

    let width = 0;
    let height = 0;
    let animation = 0;
    let dragging = false;
    let pointerTravel = 0;
    let lastX = 0;
    let lastY = 0;
    let targetRotation = root.rotation.y;
    let targetPitch = 0.62;
    let currentPitch = targetPitch;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      pointerTravel = 0;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }

      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      pointerTravel += Math.abs(dx) + Math.abs(dy);
      targetRotation += dx * 0.008;
      targetPitch = clamp(targetPitch + dy * 0.003, 0.24, 0.92);
      lastX = event.clientX;
      lastY = event.clientY;
    };

    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      if (pointerTravel <= 5) {
        const sectionId = pickSectionFromCanvas(event, canvas, camera, pickTargets);
        if (sectionId) {
          setSelectedSectionId(sectionId);
        }
      }
    };
    const onWheel: EventListener = (event) => {
      event.preventDefault();
      const wheelEvent = event as WheelEvent;
      setViewerZoom(sceneZoomRef.current * (wheelEvent.deltaY > 0 ? 0.9 : 1.1));
    };
    const wheelOptions: AddEventListenerOptions = { passive: false };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("wheel", onWheel, wheelOptions);
    window.addEventListener("resize", resize);
    resize();

    const render = () => {
      animation = requestAnimationFrame(render);
      root.rotation.y += (targetRotation - root.rotation.y) * 0.08;
      currentPitch += (targetPitch - currentPitch) * 0.08;
      const zoom = sceneZoomRef.current;
      const cameraDistance = Math.max(24, maxDimension * 1.45);
      camera.position.set(
        0,
        (8 + currentPitch * Math.max(18, maxDimension * 0.55)) / Math.sqrt(zoom),
        (cameraDistance - currentPitch * 8) / zoom,
      );
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };

    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("wheel", onWheel, wheelOptions);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => {
              const mapped = material as THREE.Material & { map?: THREE.Texture };
              mapped.map?.dispose();
              material.dispose();
            });
          } else {
            const mapped = object.material as THREE.Material & { map?: THREE.Texture };
            mapped.map?.dispose();
            object.material.dispose();
          }
        } else if (object instanceof THREE.Sprite) {
          const mapped = object.material as THREE.SpriteMaterial & { map?: THREE.Texture };
          mapped.map?.dispose();
          object.material.dispose();
        }
      });
    };
  }, [plan, selectedSectionId, setSelectedSectionId]);

  return (
    <div className="relative min-h-[360px]">
      {hasTiles ? (
        <>
          {webglUnavailable ? (
            plan ? (
              <IsometricPlanGrid
                plan={plan}
                selectedSectionId={selectedSectionId}
                setSelectedSectionId={setSelectedSectionId}
              />
            ) : null
          ) : (
            <canvas ref={canvasRef} className="block size-full min-h-[360px]" aria-label="3D voxel farm plan" />
          )}
        </>
      ) : (
        <div className="grid min-h-[360px] place-items-center px-6 text-center text-[#5d5345]">
          Generate a voxel farm plan from the satellite selector.
        </div>
      )}
      {hasTiles && !webglUnavailable ? (
        <div className="absolute left-4 top-4 rounded-md border border-white/50 bg-white/80 px-3 py-2 text-xs font-semibold text-[#2d2313] shadow-sm backdrop-blur">
          Drag voxel farm
        </div>
      ) : null}
      {hasTiles && !webglUnavailable ? (
        <div className="absolute bottom-4 right-4 flex overflow-hidden rounded-md border border-white/40 bg-white/85 text-[#2d2313] shadow-sm">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setViewerZoom(sceneZoomRef.current * 1.2)}
            className="grid size-9 place-items-center text-lg font-semibold"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setViewerZoom(sceneZoomRef.current / 1.2)}
            className="grid size-9 place-items-center text-lg font-semibold"
            aria-label="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => setViewerZoom(1)}
            className="h-9 min-w-16 px-3 text-sm font-semibold"
          >
            {Math.round(sceneZoom * 100)}%
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function IsometricPlanGrid({
  plan,
  selectedSectionId,
  setSelectedSectionId,
}: {
  plan: SavedPlan;
  selectedSectionId: string | null;
  setSelectedSectionId: (sectionId: string | null) => void;
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [viewAngle, setViewAngle] = useState({ yaw: -42, pitch: 0.58 });
  const dragRef = useRef({
    x: 0,
    y: 0,
    pan: { x: 0, y: 0 },
    viewAngle: { yaw: -42, pitch: 0.58 },
    panMode: false,
  });
  const project = (point: { x: number; y: number }) => projectGridPoint(point, viewAngle);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      pan,
      viewAngle,
      panMode: event.shiftKey || event.button === 1 || event.button === 2,
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    const drag = dragRef.current;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;

    if (drag.panMode) {
      setPan({
        x: drag.pan.x + dx,
        y: drag.pan.y + dy,
      });
      return;
    }

    setViewAngle({
      yaw: drag.viewAngle.yaw + dx * 0.45,
      pitch: clamp(drag.viewAngle.pitch + dy * 0.004, 0.18, 0.92),
    });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setZoom((current) => clamp(current + (event.deltaY > 0 ? -0.18 : 0.18), 0.18, 6));
  }

  const tileGroups = plan.tiles?.length ? summarizeTiles(plan.tiles) : [];

  return (
    <div
      className="relative min-h-[360px] touch-none overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      aria-label="Isometric farm grid"
    >
      <svg className="absolute inset-0 size-full" viewBox="-180 -140 360 280" preserveAspectRatio="xMidYMid meet">
        <g transform={`translate(${pan.x * 0.22} ${pan.y * 0.22}) scale(${zoom})`}>
          <IsoGrid project={project} />
          {plan.tiles?.length
            ? plan.tiles.map((tile) => (
                <IsoTile
                  key={tile.tileId}
                  tile={tile}
                  project={project}
                  selected={tile.objectInstanceId === selectedSectionId}
                  onSelect={() => setSelectedSectionId(tile.objectInstanceId ?? null)}
                />
              ))
            : null}
          {tileGroups.map((group) => (
            <IsoLabel key={group.tileType} group={group} project={project} />
          ))}
        </g>
      </svg>
      <div className="absolute bottom-4 right-4 flex overflow-hidden rounded-md border border-white/40 bg-white/85 text-[#2d2313] shadow-sm">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setZoom((current) => clamp(current + 0.35, 0.18, 6))}
          className="grid size-9 place-items-center text-lg font-semibold"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setZoom((current) => clamp(current - 0.35, 0.18, 6))}
          className="grid size-9 place-items-center text-lg font-semibold"
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => {
            setPan({ x: 0, y: 0 });
            setZoom(1);
            setViewAngle({ yaw: -42, pitch: 0.58 });
          }}
          className="h-9 px-3 text-sm font-semibold"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function IsoTile({
  tile,
  project,
  selected,
  onSelect,
}: {
  tile: PlanTile;
  project: (point: { x: number; y: number }) => { x: number; y: number };
  selected: boolean;
  onSelect: () => void;
}) {
  const size = 1;
  const height = isoHeightForTile(tile);
  const color = tile.color || tileTypeColors[tile.tileType];
  const corners = [
    { x: tile.position.x - size / 2, y: tile.position.z - size / 2 },
    { x: tile.position.x + size / 2, y: tile.position.z - size / 2 },
    { x: tile.position.x + size / 2, y: tile.position.z + size / 2 },
    { x: tile.position.x - size / 2, y: tile.position.z + size / 2 },
  ].map(project);
  const top = corners.map((point) => ({ x: point.x, y: point.y - height }));
  const center = project({ x: tile.position.x, y: tile.position.z });

  return (
    <g onClick={(event) => {
      event.stopPropagation();
      onSelect();
    }}>
      <polygon
        points={`${corners[1].x},${corners[1].y} ${corners[2].x},${corners[2].y} ${top[2].x},${top[2].y} ${top[1].x},${top[1].y}`}
        fill={shadeColor(color, -28)}
      />
      <polygon
        points={`${corners[2].x},${corners[2].y} ${corners[3].x},${corners[3].y} ${top[3].x},${top[3].y} ${top[2].x},${top[2].y}`}
        fill={shadeColor(color, -18)}
      />
      <polygon
        points={top.map((point) => `${point.x},${point.y}`).join(" ")}
        fill={color}
        stroke={selected ? "#2d2313" : "#fff6cf"}
        strokeOpacity={selected ? "1" : "0.35"}
        strokeWidth={selected ? "0.8" : "0.35"}
      />
      {tile.tileType !== "path" ? (
        <circle cx={center.x} cy={center.y - height - 0.2} r="0.75" fill="#fffdf5" opacity="0.88" />
      ) : null}
    </g>
  );
}

function IsoLabel({
  group,
  project,
}: {
  group: TileSummary;
  project: (point: { x: number; y: number }) => { x: number; y: number };
}) {
  const center = project({ x: group.center.x, y: group.center.z });
  const label = compactLabelText(group);
  const size = labelSizeForGroup(group);
  const width = size.width * 7.2;
  const height = size.height * 15;
  const fontSize = size.fontSize * 7;
  const swatch = Math.max(4.8, height * 0.42);

  return (
    <g transform={`translate(${center.x} ${center.y - (height * 0.48 + 3)})`}>
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill="#fffaf0"
        fillOpacity="0.9"
        stroke="#2d2313"
        strokeWidth={Math.max(0.7, size.fontSize)}
      />
      <rect
        x={-width / 2 + height * 0.22}
        y={-swatch / 2}
        width={swatch}
        height={swatch}
        fill={group.color}
        stroke="#2d2313"
        strokeWidth="0.55"
      />
      <text x={-width / 2 + height * 0.22 + swatch + 3} y={fontSize * 0.34} fill="#2d2313" fontSize={fontSize} fontWeight="700">
        {label}
      </text>
    </g>
  );
}

function IsoGrid({ project }: { project: (point: { x: number; y: number }) => { x: number; y: number } }) {
  const lines = [];

  for (let value = -60; value <= 60; value += 10) {
    lines.push(
      <line
        key={`x-${value}`}
        x1={project({ x: value, y: -60 }).x}
        y1={project({ x: value, y: -60 }).y}
        x2={project({ x: value, y: 60 }).x}
        y2={project({ x: value, y: 60 }).y}
        stroke="#ffffff"
        strokeOpacity="0.28"
        strokeWidth="0.8"
      />,
    );
    lines.push(
      <line
        key={`y-${value}`}
        x1={project({ x: -60, y: value }).x}
        y1={project({ x: -60, y: value }).y}
        x2={project({ x: 60, y: value }).x}
        y2={project({ x: 60, y: value }).y}
        stroke="#ffffff"
        strokeOpacity="0.24"
        strokeWidth="0.8"
      />,
    );
  }

  return (
    <g>
      <polygon
        points={[
          projectPoint(project, { x: -60, y: -60 }),
          projectPoint(project, { x: 60, y: -60 }),
          projectPoint(project, { x: 60, y: 60 }),
          projectPoint(project, { x: -60, y: 60 }),
        ].join(" ")}
        fill="#476943"
        opacity="0.24"
      />
      {lines}
    </g>
  );
}

function projectPoint(
  project: (point: { x: number; y: number }) => { x: number; y: number },
  point: { x: number; y: number },
) {
  const projected = project(point);
  return `${projected.x},${projected.y}`;
}

function projectGridPoint(point: { x: number; y: number }, viewAngle: { yaw: number; pitch: number }) {
  const radians = (viewAngle.yaw * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotatedX = point.x * cos - point.y * sin;
  const rotatedY = point.x * sin + point.y * cos;

  return {
    x: rotatedX * 1.42,
    y: rotatedY * viewAngle.pitch,
  };
}

function shadeColor(hex: string, amount: number) {
  const value = hex.replace("#", "");
  const num = Number.parseInt(value, 16);
  const red = clamp((num >> 16) + amount, 0, 255);
  const green = clamp(((num >> 8) & 0x00ff) + amount, 0, 255);
  const blue = clamp((num & 0x0000ff) + amount, 0, 255);

  return `#${((red << 16) | (green << 8) | blue).toString(16).padStart(6, "0")}`;
}

function getTileRenderBounds(tiles: PlanTile[]) {
  const minX = Math.min(...tiles.map((tile) => tile.position.x));
  const maxX = Math.max(...tiles.map((tile) => tile.position.x));
  const minZ = Math.min(...tiles.map((tile) => tile.position.z));
  const maxZ = Math.max(...tiles.map((tile) => tile.position.z));

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX + 1,
    depth: maxZ - minZ + 1,
  };
}

function addVoxelTiles(root: THREE.Group, tiles: PlanTile[], selectedSectionId: string | null) {
  const textureLoader = new THREE.TextureLoader();
  const pickTargets: Array<{ mesh: THREE.InstancedMesh; tiles: PlanTile[] }> = [];
  const tilesBySection = new Map<string, PlanTile[]>();

  tiles.forEach((tile) => {
    const sectionId = tile.objectInstanceId ?? tile.tileType;
    tilesBySection.set(sectionId, [...(tilesBySection.get(sectionId) ?? []), tile]);
  });

  tilesBySection.forEach((tileGroup, sectionId) => {
    const tileType = tileGroup[0].tileType;
    const first = tileGroup[0];
    const color = first.color || tileTypeColors[tileType];
    const visual = visualForTile(tileType);
    const blockGeometry = new THREE.BoxGeometry(0.94, visual.height, 0.94);
    const spriteGeometry = new THREE.PlaneGeometry(0.66, 0.66);
    const blockMaterial = new THREE.MeshLambertMaterial({
      color: selectedSectionId === sectionId ? shadeColor(color, 18) : color,
      transparent: visual.opacity < 1,
      opacity: visual.opacity,
    });
    const blocks = new THREE.InstancedMesh(blockGeometry, blockMaterial, tileGroup.length);
    const blockMatrix = new THREE.Matrix4();

    tileGroup.forEach((tile, index) => {
      blockMatrix.makeTranslation(tile.position.x, visual.height / 2, tile.position.z);
      blocks.setMatrixAt(index, blockMatrix);
    });

    blocks.castShadow = true;
    blocks.receiveShadow = true;
    blocks.userData.sectionId = sectionId;
    root.add(blocks);
    pickTargets.push({ mesh: blocks, tiles: tileGroup });

    if (!visual.showSprite) {
      return;
    }

    const spriteMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      alphaTest: 0.1,
      side: THREE.DoubleSide,
    });
    const texture = textureLoader.load(first.iconPath || defaultTileIcons[tileType], (loadedTexture) => {
      loadedTexture.magFilter = THREE.NearestFilter;
      loadedTexture.minFilter = THREE.NearestFilter;
      loadedTexture.colorSpace = THREE.SRGBColorSpace;
      spriteMaterial.map = loadedTexture;
      spriteMaterial.needsUpdate = true;
    });
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    spriteMaterial.map = texture;

    const sprites = new THREE.InstancedMesh(spriteGeometry, spriteMaterial, tileGroup.length);
    const spriteObject = new THREE.Object3D();

    tileGroup.forEach((tile, index) => {
      spriteObject.position.set(tile.position.x, visual.height + 0.012, tile.position.z);
      spriteObject.rotation.set(-Math.PI / 2, 0, 0);
      spriteObject.scale.setScalar(visual.spriteScale);
      spriteObject.updateMatrix();
      sprites.setMatrixAt(index, spriteObject.matrix);
    });

    root.add(sprites);
  });

  return pickTargets;
}

function addHomesteadDetails(root: THREE.Group, tiles: PlanTile[]) {
  const sections = groupTilesBySection(tiles);

  sections.forEach((tileGroup) => {
    const tileType = tileGroup[0]?.tileType;

    if (!tileType) {
      return;
    }

    const bounds = tileBounds(tileGroup);

    if (tileType === "storage") {
      addShed(root, bounds);
    } else if (tileType === "greenhouse") {
      addGreenhouseStructure(root, bounds);
    } else if (tileType === "compost") {
      addCompostBays(root, bounds);
    } else if (tileType === "chicken" || tileType === "goat") {
      addPen(root, bounds, tileType);
    }
  });
}

function visualForTile(tileType: PlanTileType) {
  if (tileType === "path") {
    return { height: 0.12, opacity: 1, showSprite: false, spriteScale: 0.6 };
  }

  if (tileType === "storage") {
    return { height: 0.34, opacity: 1, showSprite: false, spriteScale: 0.8 };
  }

  if (tileType === "greenhouse") {
    return { height: 0.22, opacity: 0.9, showSprite: false, spriteScale: 0.8 };
  }

  if (tileType === "compost") {
    return { height: 0.42, opacity: 1, showSprite: false, spriteScale: 0.8 };
  }

  if (tileType === "chicken" || tileType === "goat") {
    return { height: 0.3, opacity: 1, showSprite: false, spriteScale: 0.75 };
  }

  return { height: 0.58, opacity: 1, showSprite: true, spriteScale: 1 };
}

function isoHeightForTile(tile: PlanTile) {
  return visualForTile(tile.tileType).height * 4.1;
}

function addShed(root: THREE.Group, bounds: TileBounds) {
  const width = Math.max(1.8, Math.min(bounds.width * 0.75, 5));
  const depth = Math.max(1.8, Math.min(bounds.depth * 0.75, 4));
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, 1.65, depth),
    new THREE.MeshLambertMaterial({ color: "#8f6a43" }),
  );
  body.position.set(bounds.centerX, 1.0, bounds.centerZ);
  body.castShadow = true;
  root.add(body);

  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(Math.max(width, depth) * 0.72, 0.75, 4),
    new THREE.MeshLambertMaterial({ color: "#4f3a26" }),
  );
  roof.position.set(bounds.centerX, 2.22, bounds.centerZ);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  root.add(roof);
}

function addGreenhouseStructure(root: THREE.Group, bounds: TileBounds) {
  const width = Math.max(2.2, Math.min(bounds.width * 0.82, 7));
  const depth = Math.max(2.2, Math.min(bounds.depth * 0.82, 5));
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(width, 1.35, depth),
    new THREE.MeshLambertMaterial({ color: "#bdebf0", transparent: true, opacity: 0.48 }),
  );
  frame.position.set(bounds.centerX, 0.88, bounds.centerZ);
  root.add(frame);

  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.92, 0.12, 0.16),
    new THREE.MeshLambertMaterial({ color: "#2f6f6e" }),
  );
  ridge.position.set(bounds.centerX, 1.62, bounds.centerZ);
  root.add(ridge);
}

function addCompostBays(root: THREE.Group, bounds: TileBounds) {
  const bayCount = 3;
  const bayWidth = Math.max(0.8, Math.min(bounds.width / bayCount, 1.3));

  for (let index = 0; index < bayCount; index += 1) {
    const bay = new THREE.Mesh(
      new THREE.BoxGeometry(bayWidth, 0.45, Math.max(1, Math.min(bounds.depth * 0.65, 1.6))),
      new THREE.MeshLambertMaterial({ color: index === 1 ? "#5b3d24" : "#7a5a34" }),
    );
    bay.position.set(bounds.centerX + (index - 1) * bayWidth, 0.72, bounds.centerZ);
    root.add(bay);
  }
}

function addPen(root: THREE.Group, bounds: TileBounds, tileType: PlanTileType) {
  const fenceMaterial = new THREE.MeshLambertMaterial({ color: "#6a4b2d" });
  const railHeight = tileType === "goat" ? 0.92 : 0.58;
  const railThickness = 0.08;
  const width = Math.max(1, bounds.width);
  const depth = Math.max(1, bounds.depth);
  const rails = [
    { x: bounds.centerX, z: bounds.minZ - 0.48, w: width, d: railThickness },
    { x: bounds.centerX, z: bounds.maxZ + 0.48, w: width, d: railThickness },
    { x: bounds.minX - 0.48, z: bounds.centerZ, w: railThickness, d: depth },
    { x: bounds.maxX + 0.48, z: bounds.centerZ, w: railThickness, d: depth },
  ];

  rails.forEach((rail) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(rail.w, railHeight, rail.d), fenceMaterial);
    mesh.position.set(rail.x, railHeight / 2 + 0.32, rail.z);
    mesh.castShadow = true;
    root.add(mesh);
  });

  const animalCount = Math.min(tileType === "goat" ? 5 : 12, Math.max(2, Math.floor((width * depth) / (tileType === "goat" ? 22 : 10))));

  for (let index = 0; index < animalCount; index += 1) {
    const x = bounds.minX + 0.6 + ((index * 1.7) % Math.max(1, width - 1.2));
    const z = bounds.minZ + 0.6 + (Math.floor(index / 3) * 1.25) % Math.max(1, depth - 1.2);
    addAnimal(root, x, z, tileType);
  }
}

function addAnimal(root: THREE.Group, x: number, z: number, tileType: PlanTileType) {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(tileType === "goat" ? 0.55 : 0.26, tileType === "goat" ? 0.34 : 0.22, tileType === "goat" ? 0.32 : 0.2),
    new THREE.MeshLambertMaterial({ color: tileType === "goat" ? "#eee4d0" : "#fff7dc" }),
  );
  body.position.set(x, tileType === "goat" ? 0.74 : 0.54, z);
  body.castShadow = true;
  root.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(tileType === "goat" ? 0.22 : 0.12, tileType === "goat" ? 0.22 : 0.12, tileType === "goat" ? 0.2 : 0.12),
    new THREE.MeshLambertMaterial({ color: tileType === "goat" ? "#d7c8ac" : "#eac95f" }),
  );
  head.position.set(x + (tileType === "goat" ? 0.38 : 0.19), tileType === "goat" ? 0.83 : 0.6, z);
  root.add(head);
}

type TileBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  width: number;
  depth: number;
  centerX: number;
  centerZ: number;
};

function groupTilesBySection(tiles: PlanTile[]) {
  const groups = new Map<string, PlanTile[]>();

  tiles.forEach((tile) => {
    const sectionId = tile.objectInstanceId ?? tile.tileType;
    groups.set(sectionId, [...(groups.get(sectionId) ?? []), tile]);
  });

  return [...groups.values()];
}

function tileBounds(tiles: PlanTile[]): TileBounds {
  const minX = Math.min(...tiles.map((tile) => tile.position.x));
  const maxX = Math.max(...tiles.map((tile) => tile.position.x));
  const minZ = Math.min(...tiles.map((tile) => tile.position.z));
  const maxZ = Math.max(...tiles.map((tile) => tile.position.z));

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX + 1,
    depth: maxZ - minZ + 1,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
}

function pickSectionFromCanvas(
  event: PointerEvent,
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  pickTargets: Array<{ mesh: THREE.InstancedMesh; tiles: PlanTile[] }>,
) {
  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -(((event.clientY - rect.top) / rect.height) * 2 - 1),
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  const intersections = raycaster.intersectObjects(pickTargets.map((target) => target.mesh), false);
  const hit = intersections[0];

  if (!hit?.object) {
    return null;
  }

  return typeof hit.object.userData.sectionId === "string" ? hit.object.userData.sectionId : null;
}

function addClusterLabels(root: THREE.Group, groups: TileSummary[], maxDimension: number) {
  const labelHeight = Math.max(2.2, Math.min(7, maxDimension * 0.08));

  groups.forEach((group) => {
    if (group.count < 1) {
      return;
    }

    const labelSize = labelSizeForGroup(group);
    const texture = createLabelTexture(compactLabelText(group), group.color, labelSize);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    const maxSceneScale = Math.max(2.2, Math.min(7.5, maxDimension * 0.1));
    const widthScale = Math.min(labelSize.width, maxSceneScale);
    const heightScale = Math.min(labelSize.height, maxSceneScale * 0.28);

    sprite.position.set(group.center.x, labelHeight, group.center.z);
    sprite.scale.set(widthScale, heightScale, 1);
    sprite.renderOrder = 10;
    root.add(sprite);
  });
}

function createLabelTexture(text: string, color: string, labelSize: { fontSize: number }) {
  const canvas = document.createElement("canvas");
  const width = 512;
  const height = 128;
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;

  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(255, 250, 240, 0.94)";
  context.fillRect(12, 20, width - 24, height - 40);
  context.strokeStyle = "#2d2313";
  context.lineWidth = 8;
  context.strokeRect(12, 20, width - 24, height - 40);
  context.fillStyle = color;
  context.fillRect(28, 36, 36, 36);
  context.strokeStyle = "#2d2313";
  context.lineWidth = 4;
  context.strokeRect(28, 36, 36, 36);
  context.font = `700 ${Math.round(28 + labelSize.fontSize * 9)}px sans-serif`;
  context.textBaseline = "middle";
  context.fillStyle = "#2d2313";
  context.fillText(text.slice(0, 22), 78, 56);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function compactLabelText(group: TileSummary) {
  const count = group.count.toLocaleString("en-US");
  const name = group.assignmentName.length > 18 ? `${group.assignmentName.slice(0, 16)}.` : group.assignmentName;

  return `${name} (${count})`;
}

function labelSizeForGroup(group: TileSummary) {
  const footprint = Math.sqrt(group.count);
  const width = clamp(2.6 + footprint * 0.12, 3.2, 8.2);
  const height = clamp(0.62 + footprint * 0.018, 0.72, 1.35);
  const fontSize = clamp(0.72 + footprint * 0.006, 0.78, 1.15);

  return { width, height, fontSize };
}

function PlanDetails({
  plan,
  savePlanObjects,
  selectedSectionId,
  setSelectedSectionId,
}: {
  plan: SavedPlan | null;
  savePlanObjects: (planId: string, objects: SavedPlanObject[]) => Promise<void>;
  selectedSectionId: string | null;
  setSelectedSectionId: (sectionId: string | null) => void;
}) {
  const tileGroups = plan?.tiles?.length ? summarizeTiles(plan.tiles) : [];
  const objectGroups = plan?.objects?.length ? summarizeObjects(plan.objects) : [];

  return (
    <div className="border-t border-[#eadfca] bg-[#fffdf5] p-4">
      {plan ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold text-[#2d2313]">{plan.name}</h2>
              <span className="rounded bg-[#eef8e9] px-2 py-1 text-xs font-semibold text-[#2f6f4e]">
                {Math.round((plan.generation?.score ?? 0) * 100)} fit score
              </span>
              <span className="rounded bg-[#fff3cf] px-2 py-1 text-xs font-semibold text-[#6c5b20]">
                {plan.baseGeometry?.areaSquareFeet?.toLocaleString("en-US") ??
                  Math.round((plan.baseGeometry?.areaSquareMeters ?? 0) * 10.7639).toLocaleString("en-US")} sq ft
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6b6254]">{plan.summary?.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <Metric label="Blocks" value={(plan.tiles?.length ?? 0).toLocaleString("en-US")} />
            <Metric label="Maintenance" value={plan.summary?.maintenanceLevel ?? "medium"} />
            <Metric label="Monthly Earn" value={`$${Math.round(plan.analytics?.potentialMonthlyEarnings ?? 0).toLocaleString("en-US")}`} />
            <Metric label="Water/wk" value={`${Math.round(plan.analytics?.waterGallonsPerWeek ?? 0).toLocaleString("en-US")} gal`} />
          </div>

          <section className="grid gap-3 lg:col-span-2 md:grid-cols-4">
            {objectGroups.map((group) => (
              <article key={group.type} className="rounded-md border border-[#eadfca] bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#928775]">{group.type}</p>
                <p className="mt-1 text-lg font-semibold text-[#2d2313]">{group.count}</p>
                <p className="text-xs text-[#7a6b55]">{group.area.toLocaleString("en-US")} sq ft modeled</p>
              </article>
            ))}
            <article className="rounded-md border border-[#eadfca] bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#928775]">Profit/mo</p>
              <p className="mt-1 text-lg font-semibold text-[#2d2313]">${Math.round(plan.analytics?.profit.monthly ?? 0).toLocaleString("en-US")}</p>
              <p className="text-xs text-[#7a6b55]">after recurring modeled costs</p>
            </article>
          </section>

          <ObjectFootprintEditor
            plan={plan}
            savePlanObjects={savePlanObjects}
            selectedSectionId={selectedSectionId}
            setSelectedSectionId={setSelectedSectionId}
          />

          {tileGroups.length ? (
            <div className="grid gap-3 lg:col-span-2 md:grid-cols-2 xl:grid-cols-5">
              {tileGroups.map((group) => (
                <article key={group.tileType} className="rounded-md border border-[#eadfca] bg-white p-3">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-[#2d2313]">{group.assignmentName}</h3>
                      <p className="text-xs text-[#7a6b55]">
                        {group.count.toLocaleString("en-US")} one-foot tiles
                      </p>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={group.iconPath}
                      alt=""
                      className="size-7 shrink-0 [image-rendering:pixelated]"
                      style={{ backgroundColor: group.color }}
                    />
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs text-[#6b6254]">
                    <Metric label="Area" value={`${group.count.toLocaleString("en-US")} sq ft`} compact />
                    <Metric label="Sun" value={group.sunExposure} compact />
                    <Metric label="Water" value={group.waterNeed} compact />
                    <Metric label="Type" value={group.tileType} compact />
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-[#eadfca] bg-white p-3 text-sm text-[#7a6b55] lg:col-span-2">
              No voxel blocks saved for this plan.
            </div>
          )}
        </div>
      ) : (
        <div className="h-5" />
      )}
    </div>
  );
}

function SectionSidePanel({
  object,
  plan,
  onClose,
}: {
  object: SavedPlanObject;
  plan: SavedPlan | null;
  onClose: () => void;
}) {
  const area = Math.round(object.areaSquareFeet ?? object.geometry?.areaSquareFeet ?? 0);
  const monthlyRevenue = Math.round(object.revenue?.monthly ?? 0);
  const monthlyCost = Math.round(object.recurringCost?.monthly ?? 0);
  const water = Math.round(object.waterGallonsPerWeek ?? 0);

  return (
    <aside className="border-t border-[#eadfca] bg-[#fffaf0] p-4 lg:border-l lg:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#928775]">{object.type}</p>
          <h2 className="mt-1 text-lg font-semibold text-[#2d2313]">{object.displayName}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-[#d8ceb9] bg-white px-2 py-1 text-sm text-[#5d5345]"
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <Metric label="Area" value={`${area.toLocaleString("en-US")} sq ft`} compact />
        <Metric label="Water/wk" value={`${water.toLocaleString("en-US")} gal`} compact />
        <Metric label="Revenue/mo" value={`$${monthlyRevenue.toLocaleString("en-US")}`} compact />
        <Metric label="Cost/mo" value={`$${monthlyCost.toLocaleString("en-US")}`} compact />
      </div>

      <div className="mt-4 space-y-3 text-sm text-[#5d5345]">
        {object.crop ? (
          <SectionBlock
            title="Crop"
            rows={[
              ["Type", object.crop.cropType],
              ["Seed lot", object.crop.seedLot],
              ["Planted", object.crop.seedOrTransplantDate],
              ["Soil", object.crop.soilType],
              ["Harvest", object.crop.producedMetrics.expectedHarvestWindow.join(" to ")],
              ["Yield/sq ft", `${object.crop.producedMetrics.yieldPerSquareFoot}`],
            ]}
          />
        ) : null}
        {object.livestock ? (
          <SectionBlock
            title="Livestock"
            rows={[
              ["Species", object.livestock.species],
              ["Breed", object.livestock.breed],
              ["Head count", object.livestock.headCount.toLocaleString("en-US")],
              ["Feed", object.livestock.feedType],
              ["Feed cost/wk", `$${Math.round(object.livestock.producedMetrics.feedCost.weekly).toLocaleString("en-US")}`],
            ]}
          />
        ) : null}
        {object.structure ? (
          <SectionBlock
            title="Structure"
            rows={[
              ["Type", object.structure.structureType],
              ["Storage", object.structure.invisibleExternalStorage ? "external allowed" : "onsite"],
              ["Items", `${object.structure.storedItems?.length ?? 0}`],
            ]}
          />
        ) : null}
        <SectionBlock
          title="Plan context"
          rows={[
            ["Weather", plan?.farmContext?.averageWeather ?? "unknown"],
            ["Rainfall", `${plan?.farmContext?.yearlyRainfallInches ?? 0} in/year`],
            ["Status", object.status],
          ]}
        />
      </div>
    </aside>
  );
}

function SectionBlock({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <section className="rounded-md border border-[#eadfca] bg-white p-3">
      <h3 className="text-sm font-semibold text-[#2d2313]">{title}</h3>
      <dl className="mt-2 space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[92px_minmax(0,1fr)] gap-2 text-xs">
            <dt className="font-semibold text-[#928775]">{label}</dt>
            <dd className="min-w-0 truncate text-[#2d2313]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ObjectFootprintEditor({
  plan,
  savePlanObjects,
  selectedSectionId,
  setSelectedSectionId,
}: {
  plan: SavedPlan;
  savePlanObjects: (planId: string, objects: SavedPlanObject[]) => Promise<void>;
  selectedSectionId: string | null;
  setSelectedSectionId: (sectionId: string | null) => void;
}) {
  const [objectType, setObjectType] = useState<FarmObjectType>("crop");
  const [vertices, setVertices] = useState<Array<{ x: number; y: number }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const tiles = plan.tiles ?? [];
  const bounds = tiles.length ? getTileRenderBounds(tiles) : { minX: -10, maxX: 10, minZ: -10, maxZ: 10, width: 20, depth: 20 };
  const padding = 2;
  const viewBox = `${bounds.minX - padding} ${bounds.minZ - padding} ${bounds.width + padding * 2} ${bounds.depth + padding * 2}`;

  async function closeFootprint() {
    if (vertices.length < 3) {
      setEditorError("Pick at least 3 voxel coordinates");
      return;
    }

    const selectedTiles = tiles.filter((tile) => pointInPlanPolygon({ x: tile.position.x, y: tile.position.z }, vertices));
    const area = Math.max(1, selectedTiles.length || Math.round(Math.abs(planPolygonArea(vertices))));
    const rect = selectedTiles.length
      ? rectForPlanTiles(selectedTiles)
      : rectForPoints(vertices);
    const object = createManualObject(objectType, vertices, rect, area);
    const nextObjects = [...(plan.objects ?? []), object];

    setIsSaving(true);
    setEditorError(null);

    try {
      await savePlanObjects(plan._id, nextObjects);
      setVertices([]);
    } catch (error) {
      setEditorError(formatUiError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function removeObject(instanceId: string) {
    setIsSaving(true);
    setEditorError(null);

    try {
      await savePlanObjects(plan._id, (plan.objects ?? []).filter((object) => object.instanceId !== instanceId));
    } catch (error) {
      setEditorError(formatUiError(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-md border border-[#eadfca] bg-white p-3 lg:col-span-2 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-h-[280px] overflow-hidden rounded-md border border-[#eadfca] bg-[#f7f0dc]">
        <svg className="size-full min-h-[280px]" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
          {(plan.objects ?? []).map((object) => (
            <ObjectFootprint
              key={object.instanceId}
              object={object}
              selected={object.instanceId === selectedSectionId}
              onSelect={() => setSelectedSectionId(object.instanceId)}
            />
          ))}
          {tiles.map((tile) => (
            <rect
              key={tile.tileId}
              x={tile.position.x - 0.47}
              y={tile.position.z - 0.47}
              width="0.94"
              height="0.94"
              fill={tile.color || tileTypeColors[tile.tileType]}
              opacity="0.72"
              stroke="#fffdf5"
              strokeWidth="0.04"
              onClick={() => setVertices((current) => [...current, { x: tile.position.x, y: tile.position.z }].slice(-16))}
            />
          ))}
          {vertices.length ? (
            <polyline
              points={vertices.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              stroke="#1f3d28"
              strokeWidth="0.28"
            />
          ) : null}
          {vertices.map((point, index) => (
            <g key={`${point.x}-${point.y}-${index}`}>
              <circle cx={point.x} cy={point.y} r="0.55" fill="#fffaf0" stroke="#1f3d28" strokeWidth="0.16" />
              <text x={point.x} y={point.y + 0.16} textAnchor="middle" fontSize="0.55" fontWeight="700" fill="#1f3d28">
                {index + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-[#2d2313]">Voxel object editor</p>
          <p className="mt-1 text-xs leading-5 text-[#7a6b55]">
            Click voxel coordinates to draw a footprint, then close it into a crop, livestock, or structure object.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-md border border-[#eadfca] bg-[#fffaf0] p-1">
          {(["crop", "livestock", "structure"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setObjectType(type)}
              className={`rounded px-2 py-2 text-xs font-semibold capitalize ${
                objectType === type ? "bg-[#2f6f4e] text-white" : "text-[#6b6254] hover:bg-white"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setVertices((current) => current.slice(0, -1))}
            disabled={!vertices.length || isSaving}
            className="h-9 rounded-md border border-[#d8ceb9] text-sm text-[#5d5345] disabled:opacity-45"
          >
            Undo point
          </button>
          <button
            type="button"
            onClick={() => setVertices([])}
            disabled={!vertices.length || isSaving}
            className="h-9 rounded-md border border-[#d8ceb9] text-sm text-[#5d5345] disabled:opacity-45"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={closeFootprint}
            disabled={vertices.length < 3 || isSaving}
            className="col-span-2 h-9 rounded-md bg-[#2f6f4e] text-sm font-semibold text-white disabled:opacity-45"
          >
            {isSaving ? "Saving..." : `Close ${objectType} footprint`}
          </button>
        </div>
        {editorError ? <p className="rounded bg-[#fff1ea] px-2 py-1 text-xs text-[#8b3d22]">{editorError}</p> : null}
        <div className="max-h-40 space-y-1 overflow-auto">
          {(plan.objects ?? []).map((object) => (
            <div key={object.instanceId} className="flex items-center justify-between gap-2 rounded border border-[#eadfca] px-2 py-1 text-xs">
              <span className="truncate text-[#2d2313]">{object.displayName}</span>
              <button
                type="button"
                onClick={() => removeObject(object.instanceId)}
                disabled={isSaving}
                className="shrink-0 text-[#8b3d22]"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ObjectFootprint({
  object,
  selected,
  onSelect,
}: {
  object: SavedPlanObject;
  selected: boolean;
  onSelect: () => void;
}) {
  const points = object.geometry?.points ?? [];

  if (points.length < 3) {
    return null;
  }

  return (
    <polygon
      points={points.map((point) => `${point.x},${point.y}`).join(" ")}
      fill={objectColor(object.type)}
      fillOpacity={selected ? "0.34" : "0.2"}
      stroke={objectColor(object.type)}
      strokeWidth={selected ? "0.62" : "0.32"}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    />
  );
}

function createManualObject(
  objectType: FarmObjectType,
  vertices: Array<{ x: number; y: number }>,
  rect: { minX: number; maxX: number; minY: number; maxY: number },
  areaSquareFeet: number,
): SavedPlanObject {
  const displayName = `Manual ${objectType} ${new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  const color = objectColor(objectType);
  const base = {
    instanceId: `manual_${objectType}_${Date.now()}`,
    type: objectType,
    slug: `manual-${objectType}`,
    sourceId: null,
    displayName,
    status: "planned" as const,
    addedAtDay: 0,
    position: {
      x: Number(((rect.minX + rect.maxX) / 2).toFixed(2)),
      y: 0,
      z: Number(((rect.minY + rect.maxY) / 2).toFixed(2)),
    },
    rotation: { x: 0, y: 0, z: 0 },
    size: {
      width: Number(Math.max(1, rect.maxX - rect.minX + 1).toFixed(1)),
      depth: Number(Math.max(1, rect.maxY - rect.minY + 1).toFixed(1)),
      height: objectType === "structure" ? 1.8 : 1,
    },
    geometry: {
      points: vertices,
      areaSquareFeet,
    },
    areaSquareFeet,
    renderOverrides: { model: objectType, color, label: displayName },
    notes: `Manual ${objectType} footprint drawn on the voxel grid.`,
  };

  if (objectType === "crop") {
    return {
      ...base,
      plantedAtDay: 0,
      crop: {
        cropType: "manual-crop",
        seedLot: "manual",
        seedSource: "manual",
        seedOrTransplantDate: new Date().toISOString().slice(0, 10),
        soilType: "manual soil",
        sunExposure: "full",
        fertilizer: { type: "fertilizer", status: "planned" },
        manure: { type: "manure", status: "planned" },
        compost: { type: "compost", status: "planned" },
        pesticides: [],
        priorCrops: [],
        harvestEvents: [],
        deathEvents: [],
        producedMetrics: {
          expectedGerminationDays: [5, 10],
          daysToMaturity: [60, 90],
          expectedHarvestWindow: [new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)],
          averageSpacingInches: 12,
          yieldPerSquareFoot: 1,
          yieldPerPlant: 1,
          daysFromPlantingToFirstHarvest: 60,
          daysInProduction: 30,
          cropFailureRate: 0.1,
        },
      },
    };
  }

  if (objectType === "livestock") {
    return {
      ...base,
      livestock: {
        animalId: "manual-group",
        species: "Manual livestock",
        breed: "Mixed",
        birthOrHatchDate: new Date().toISOString().slice(0, 10),
        source: "manual",
        weight: { amount: 0, unit: "lb" },
        vaccinations: [],
        feedType: "manual feed",
        headCount: 1,
        harvestEvents: [],
        deathEvents: [],
        producedMetrics: {
          feedCost: { weekly: 0, monthly: 0, yearly: 0 },
          revenue: { weekly: 0, monthly: 0, yearly: 0 },
        },
      },
    };
  }

  return {
    ...base,
    structure: {
      structureType: "other",
      storedItems: [],
    },
  };
}

function summarizeObjects(objects: SavedPlanObject[]) {
  const groups = new Map<FarmObjectType, { type: FarmObjectType; count: number; area: number }>();

  objects.forEach((object) => {
    const current = groups.get(object.type) ?? { type: object.type, count: 0, area: 0 };
    current.count += 1;
    current.area += Math.round(object.areaSquareFeet ?? object.geometry?.areaSquareFeet ?? 0);
    groups.set(object.type, current);
  });

  return [...groups.values()].sort((left, right) => left.type.localeCompare(right.type));
}

function objectColor(type: FarmObjectType) {
  if (type === "crop") {
    return "#2f6f4e";
  }

  if (type === "livestock") {
    return "#a46d22";
  }

  return "#496f91";
}

function rectForPlanTiles(tiles: PlanTile[]) {
  return {
    minX: Math.min(...tiles.map((tile) => tile.position.x)),
    maxX: Math.max(...tiles.map((tile) => tile.position.x)),
    minY: Math.min(...tiles.map((tile) => tile.position.z)),
    maxY: Math.max(...tiles.map((tile) => tile.position.z)),
  };
}

function rectForPoints(points: Array<{ x: number; y: number }>) {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

function pointInPlanPolygon(point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) {
  let inside = false;

  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y || 0.000001) + current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function planPolygonArea(points: Array<{ x: number; y: number }>) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
}

function formatUiError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Database connection failed")) {
    return "DB blocked";
  }

  return message || "Request failed";
}

function summarizeTiles(tiles: PlanTile[]) {
  const groups = new Map<PlanTileType, TileSummary & { totalX: number; totalZ: number }>();

  tiles.forEach((tile) => {
    const current = groups.get(tile.tileType);

    if (current) {
      current.count += 1;
      current.totalX += tile.position.x;
      current.totalZ += tile.position.z;
      current.center = {
        x: Number((current.totalX / current.count).toFixed(2)),
        z: Number((current.totalZ / current.count).toFixed(2)),
      };
      return;
    }

    groups.set(tile.tileType, {
      tileType: tile.tileType,
      assignmentName: tile.assignmentName,
      count: 1,
      color: tile.color || tileTypeColors[tile.tileType],
      iconPath: tile.iconPath || defaultTileIcons[tile.tileType],
      sunExposure: tile.sunExposure,
      waterNeed: tile.waterNeed,
      center: {
        x: tile.position.x,
        z: tile.position.z,
      },
      totalX: tile.position.x,
      totalZ: tile.position.z,
    });
  });

  return [...groups.values()].sort((left, right) => right.count - left.count);
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? "" : "rounded-md border border-[#eadfca] bg-white p-3"}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#928775]">{label}</p>
      <p className="mt-1 truncate font-medium capitalize text-[#2d2313]">{value}</p>
    </div>
  );
}
