"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { GeometryPoint, PlanPartition, PlanTile, PlanTileType } from "@/lib/models";

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
  partitions?: PlanPartition[];
  tiles?: PlanTile[];
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

const partitionColors: Record<PlanPartition["type"], string> = {
  annual_beds: "#67a85b",
  perennial_guild: "#3f8b58",
  livestock: "#8fa866",
  greenhouse: "#8ad4dc",
  water: "#4ea9c7",
  habitat: "#a6bd63",
};

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
};

export function FarmPlanner() {
  const [points, setPoints] = useState<GeometryPoint[]>([]);
  const [plans, setPlans] = useState<SavedPlan[]>([]);
  const [activePlan, setActivePlan] = useState<SavedPlan | null>(null);
  const [view, setView] = useState<"select" | "plans">("select");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
}: {
  plans: SavedPlan[];
  activePlan: SavedPlan | null;
  setActivePlan: React.Dispatch<React.SetStateAction<SavedPlan | null>>;
  setPoints: React.Dispatch<React.SetStateAction<GeometryPoint[]>>;
}) {
  return (
    <div className="grid min-h-[calc(100vh-10.5rem)] grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="border-b border-[#eadfca] bg-[#fffaf0] p-3 lg:border-b-0 lg:border-r">
        {plans.length ? (
          <div className="space-y-2">
            {plans.map((plan) => (
              <button
                key={plan._id}
                type="button"
                onClick={() => {
                  setActivePlan(plan);
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
                  {plan.tiles?.length ? `${plan.tiles.length.toLocaleString("en-US")} tiles` : `${plan.partitions?.length ?? 0} legacy partitions`}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-[#eadfca] bg-white px-3 py-2 text-sm text-[#7a6b55]">No plans</p>
        )}
      </aside>

      <div className="grid min-h-[620px] grid-rows-[minmax(360px,1fr)_auto]">
        <SolarPunkScene plan={activePlan} />
        <PlanDetails plan={activePlan} />
      </div>
    </div>
  );
}

function SolarPunkScene({ plan }: { plan: SavedPlan | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const hasTiles = Boolean(plan?.tiles?.length);
  const hasLegacyPartitions = Boolean(plan?.partitions?.length);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || (!plan?.tiles?.length && !plan?.partitions?.length)) {
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

    setFallback(false);
    const gl =
      canvas.getContext("webgl2", { antialias: true, preserveDrawingBuffer: true }) ??
      canvas.getContext("webgl", { antialias: true, preserveDrawingBuffer: true });

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
    scene.background = new THREE.Color("#bfe5ed");
    scene.fog = new THREE.Fog("#bfe5ed", 22, 44);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
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

    const tileBounds = plan.tiles?.length ? getTileRenderBounds(plan.tiles) : null;
    const groundRadius = tileBounds ? Math.max(tileBounds.width, tileBounds.depth) * 0.62 + 2 : 18;
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(groundRadius, 64),
      new THREE.MeshLambertMaterial({ color: "#476943" }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    root.add(ground);

    if (plan.tiles?.length) {
      addVoxelTiles(root, plan.tiles);
    } else {
      plan.partitions?.forEach((partition, index) => {
        addPartition(root, partition, index);
      });
    }

    let width = 0;
    let height = 0;
    let animation = 0;
    let dragging = false;
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
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }

      targetRotation += (event.clientX - lastX) * 0.008;
      targetPitch = clamp(targetPitch + (event.clientY - lastY) * 0.003, 0.24, 0.92);
      lastX = event.clientX;
      lastY = event.clientY;
    };

    const onPointerUp = (event: PointerEvent) => {
      dragging = false;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    window.addEventListener("resize", resize);
    resize();

    const render = () => {
      animation = requestAnimationFrame(render);
      root.rotation.y += (targetRotation - root.rotation.y) * 0.08;
      currentPitch += (targetPitch - currentPitch) * 0.08;
      const cameraDistance = tileBounds ? Math.max(24, Math.min(56, Math.max(tileBounds.width, tileBounds.depth) * 1.15)) : 29;
      camera.position.set(0, 7 + currentPitch * 18, cameraDistance - currentPitch * 10);
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
        }
      });
    };
  }, [plan]);

  return (
    <div className="relative min-h-[360px]">
      {(hasTiles || hasLegacyPartitions) && webglUnavailable && plan ? (
        <IsometricPlanGrid plan={plan} />
      ) : hasTiles || hasLegacyPartitions ? (
        <canvas ref={canvasRef} className="block size-full min-h-[360px]" aria-label="3D voxel farm plan" />
      ) : (
        <div className="grid min-h-[360px] place-items-center px-6 text-center text-[#5d5345]">
          No plan
        </div>
      )}
      {hasTiles || hasLegacyPartitions ? (
        <div className="absolute left-4 top-4 rounded-md border border-white/50 bg-white/80 px-3 py-2 text-xs font-semibold text-[#2d2313] shadow-sm backdrop-blur">
          {webglUnavailable ? "Pan" : "Drag voxel farm"}
        </div>
      ) : null}
    </div>
  );
}

function IsometricPlanGrid({ plan }: { plan: SavedPlan }) {
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
            ? plan.tiles.slice(0, 3000).map((tile) => (
                <IsoTile key={tile.tileId} tile={tile} project={project} />
              ))
            : (plan.partitions ?? []).map((partition) => (
                <IsoPartition key={partition.partitionId} partition={partition} project={project} />
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
}: {
  tile: PlanTile;
  project: (point: { x: number; y: number }) => { x: number; y: number };
}) {
  const size = 1;
  const height = 2.4;
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
    <g>
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
        stroke="#fff6cf"
        strokeOpacity="0.35"
        strokeWidth="0.35"
      />
      <circle cx={center.x} cy={center.y - height - 0.2} r="0.75" fill="#fffdf5" opacity="0.88" />
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

function IsoPartition({
  partition,
  project,
}: {
  partition: PlanPartition;
  project: (point: { x: number; y: number }) => { x: number; y: number };
}) {
  const height = partitionHeight(partition.type);
  const base = partition.geometry.corners.map((point) => project(toIsoWorld(point)));
  const top = base.map((point) => ({ x: point.x, y: point.y - height }));
  const color = partitionColors[partition.type];
  const baseCenter = project(toIsoWorld(partition.geometry.center));
  const center = { x: baseCenter.x, y: baseCenter.y - height };

  return (
    <g>
      {base.map((point, index) => {
        const next = base[(index + 1) % base.length];
        const topPoint = top[index];
        const nextTop = top[(index + 1) % top.length];

        return (
          <polygon
            key={`${partition.partitionId}-side-${index}`}
            points={`${point.x},${point.y} ${next.x},${next.y} ${nextTop.x},${nextTop.y} ${topPoint.x},${topPoint.y}`}
            fill={shadeColor(color, -22)}
            opacity="0.48"
          />
        );
      })}
      <polygon
        points={top.map((point) => `${point.x},${point.y}`).join(" ")}
        fill={color}
        opacity={partition.type === "greenhouse" ? "0.72" : "0.92"}
        stroke="#fff6cf"
        strokeWidth="1.1"
      />
      {partition.type === "perennial_guild" ? (
        <circle cx={center.x} cy={center.y - 4} r="5" fill="#2f7d58" />
      ) : partition.type === "livestock" ? (
        <rect x={center.x - 6} y={center.y - 5} width="12" height="8" rx="1.5" fill="#6f7d4a" />
      ) : partition.type === "greenhouse" ? (
        <polygon
          points={`${center.x - 9},${center.y + 4} ${center.x},${center.y - 9} ${center.x + 9},${center.y + 4}`}
          fill="#d7f4ec"
          opacity="0.75"
        />
      ) : partition.type === "water" ? (
        <ellipse cx={center.x} cy={center.y} rx="7" ry="3.5" fill="#e6fbff" opacity="0.85" />
      ) : (
        <circle cx={center.x} cy={center.y} r="3.5" fill="#f4fff0" opacity="0.92" />
      )}
    </g>
  );
}

function toIsoWorld(point: GeometryPoint) {
  return {
    x: point.x - 50,
    y: point.y - 50,
  };
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

function partitionHeight(type: PlanPartition["type"]) {
  switch (type) {
    case "greenhouse":
      return 9;
    case "perennial_guild":
      return 7;
    case "livestock":
      return 5;
    case "water":
      return 1;
    case "habitat":
      return 4;
    default:
      return 3;
  }
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

function addVoxelTiles(root: THREE.Group, tiles: PlanTile[]) {
  const blockGeometry = new THREE.BoxGeometry(0.92, 0.42, 0.92);
  const spriteGeometry = new THREE.PlaneGeometry(0.68, 0.68);
  const textureLoader = new THREE.TextureLoader();
  const tilesByType = new Map<PlanTileType, PlanTile[]>();

  tiles.forEach((tile) => {
    tilesByType.set(tile.tileType, [...(tilesByType.get(tile.tileType) ?? []), tile]);
  });

  tilesByType.forEach((tileGroup, tileType) => {
    const first = tileGroup[0];
    const color = first.color || tileTypeColors[tileType];
    const blockMaterial = new THREE.MeshLambertMaterial({ color });
    const blocks = new THREE.InstancedMesh(blockGeometry, blockMaterial, tileGroup.length);
    const blockMatrix = new THREE.Matrix4();

    tileGroup.forEach((tile, index) => {
      blockMatrix.makeTranslation(tile.position.x, 0.21, tile.position.z);
      blocks.setMatrixAt(index, blockMatrix);
    });

    blocks.castShadow = true;
    blocks.receiveShadow = true;
    root.add(blocks);

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
      spriteObject.position.set(tile.position.x, 0.435, tile.position.z);
      spriteObject.rotation.set(-Math.PI / 2, 0, 0);
      spriteObject.updateMatrix();
      sprites.setMatrixAt(index, spriteObject.matrix);
    });

    root.add(sprites);
  });
}

function addPartition(root: THREE.Group, partition: PlanPartition, index: number) {
  const shape = new THREE.Shape();
  const corners = partition.geometry.corners.map(toWorld);
  shape.moveTo(corners[0].x, corners[0].z);
  corners.slice(1).forEach((corner) => shape.lineTo(corner.x, corner.z));
  shape.closePath();

  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshLambertMaterial({
    color: partitionColors[partition.type],
    transparent: true,
    opacity: partition.type === "greenhouse" ? 0.72 : 0.94,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.02 + index * 0.01;
  mesh.receiveShadow = true;
  root.add(mesh);

  const edgePoints = [...corners, corners[0]].map((corner) => new THREE.Vector3(corner.x, 0.08, corner.z));
  const edge = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(edgePoints),
    new THREE.LineBasicMaterial({ color: "#fff6cf", linewidth: 2 }),
  );
  root.add(edge);

  const center = toWorld(partition.geometry.center);

  if (partition.type === "greenhouse") {
    addGreenhouse(root, center);
  } else if (partition.type === "livestock") {
    addLivestock(root, center);
  } else if (partition.type === "water") {
    addWater(root, center);
  } else if (partition.type === "perennial_guild") {
    addTrees(root, center);
  } else {
    addBeds(root, center, partition.type === "habitat");
  }
}

function addBeds(root: THREE.Group, center: { x: number; z: number }, habitat: boolean) {
  const count = habitat ? 8 : 12;

  for (let index = 0; index < count; index += 1) {
    const x = center.x + ((index % 4) - 1.5) * 0.9;
    const z = center.z + (Math.floor(index / 4) - 1) * 0.75;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, habitat ? 0.6 : 0.38, 8),
      new THREE.MeshLambertMaterial({ color: "#2f6f4e" }),
    );
    stem.position.set(x, habitat ? 0.35 : 0.25, z);
    root.add(stem);

    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(habitat ? 0.24 : 0.18, 12, 12),
      new THREE.MeshLambertMaterial({ color: habitat ? "#d7d65b" : "#77bf5a" }),
    );
    leaf.position.set(x, habitat ? 0.72 : 0.48, z);
    leaf.castShadow = true;
    root.add(leaf);
  }
}

function addTrees(root: THREE.Group, center: { x: number; z: number }) {
  for (let index = 0; index < 5; index += 1) {
    const x = center.x + (index - 2) * 1.1;
    const z = center.z + (index % 2 === 0 ? -0.55 : 0.55);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.12, 0.95, 8),
      new THREE.MeshLambertMaterial({ color: "#7b5630" }),
    );
    trunk.position.set(x, 0.48, z);
    root.add(trunk);

    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 16),
      new THREE.MeshLambertMaterial({ color: "#3f8b58" }),
    );
    canopy.position.set(x, 1.15, z);
    canopy.castShadow = true;
    root.add(canopy);
  }
}

function addGreenhouse(root: THREE.Group, center: { x: number; z: number }) {
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.7, 2.2),
    new THREE.MeshLambertMaterial({ color: "#bdebf0", transparent: true, opacity: 0.58 }),
  );
  frame.position.set(center.x, 0.9, center.z);
  root.add(frame);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.06, 1.05),
    new THREE.MeshLambertMaterial({ color: "#1f5d6e" }),
  );
  panel.position.set(center.x, 1.82, center.z - 0.2);
  panel.rotation.x = 0.35;
  root.add(panel);
}

function addLivestock(root: THREE.Group, center: { x: number; z: number }) {
  const coop = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.1, 1.3),
    new THREE.MeshLambertMaterial({ color: "#c77f45" }),
  );
  coop.position.set(center.x - 0.9, 0.55, center.z);
  coop.castShadow = true;
  root.add(coop);

  for (let index = 0; index < 8; index += 1) {
    const animal = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshLambertMaterial({ color: "#fff3cf" }),
    );
    animal.position.set(center.x + (index % 4) * 0.45 - 0.1, 0.22, center.z + Math.floor(index / 4) * 0.48 - 0.25);
    root.add(animal);
  }
}

function addWater(root: THREE.Group, center: { x: number; z: number }) {
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(1.45, 28),
    new THREE.MeshLambertMaterial({ color: "#4ea9c7", transparent: true, opacity: 0.88 }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(center.x, 0.12, center.z);
  root.add(pond);
}

function PlanDetails({ plan }: { plan: SavedPlan | null }) {
  const tileGroups = plan?.tiles?.length ? summarizeTiles(plan.tiles) : [];

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
            <Metric label="Tiles" value={(plan.tiles?.length ?? plan.partitions?.length ?? 0).toLocaleString("en-US")} />
            <Metric label="Maintenance" value={plan.summary?.maintenanceLevel ?? "medium"} />
          </div>

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
            <div className="grid gap-3 lg:col-span-2 md:grid-cols-2 xl:grid-cols-5">
              {(plan.partitions ?? []).map((partition) => (
              <article key={partition.partitionId} className="rounded-md border border-[#eadfca] bg-white p-3">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#2d2313]">{partition.label}</h3>
                    <p className="text-xs text-[#7a6b55]">{partition.assignmentName}</p>
                  </div>
                  <span
                    className="mt-0.5 size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: partitionColors[partition.type] }}
                  />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs text-[#6b6254]">
                  <Metric label="Area" value={`${partition.areaSquareMeters} sq m`} compact />
                  <Metric label="Sun" value={partition.sunExposure} compact />
                  <Metric label="Water" value={partition.waterNeed} compact />
                  <Metric label="Type" value={partition.type.replace("_", " ")} compact />
                </dl>
              </article>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="h-5" />
      )}
    </div>
  );
}

function formatUiError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Database connection failed")) {
    return "DB blocked";
  }

  return message || "Request failed";
}

function summarizeTiles(tiles: PlanTile[]) {
  const groups = new Map<PlanTileType, {
    tileType: PlanTileType;
    assignmentName: string;
    count: number;
    color: string;
    iconPath: string;
    sunExposure: PlanTile["sunExposure"];
    waterNeed: PlanTile["waterNeed"];
  }>();

  tiles.forEach((tile) => {
    const current = groups.get(tile.tileType);

    if (current) {
      current.count += 1;
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

function toWorld(point: GeometryPoint) {
  return {
    x: (point.x - 50) * 0.28,
    z: (point.y - 50) * 0.22,
  };
}
