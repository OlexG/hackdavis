import { CATALOG } from "./catalog.js";
import * as Geometry from "./geometry.js";
import type {
  CropAreaAttrs,
  CropAreaObject,
  CropFieldAttrs,
  CropFieldObject,
  FarmCommit,
  FarmManagerSnapshot,
  FarmObject,
  FarmState,
  LivestockAttrs,
  LivestockObject,
  PathAttrs,
  PathObject,
  Point,
  StructureAttrs,
  StructureObject
} from "./types.js";

export const DEFAULT_FARM_BOUNDS: Point[] = [
    [0, 0],
    [108, 0],
    [108, 82],
    [0, 82]
];

export function cropArea(id: string, label: string, polygon: Point[], attrs: Partial<CropAreaAttrs> = {}): CropAreaObject {
    return {
      id,
      label,
      type: "cropArea",
      polygon,
      height: 0.38,
      attrs: {
        status: "Planned crop area",
        soil: "Unassigned",
        ...attrs
      }
    };
}

export function cropField(
  id: string,
  label: string,
  polygon: Point[],
  parentId: string | null,
  cropKey: string | null,
  attrs: Partial<CropFieldAttrs> = {}
): CropFieldObject {
    const crop = cropKey
      ? CATALOG.crops.find((item) => item.key === cropKey) || {
          key: cropKey || "custom",
          name: attrs.cropName || "Custom Crop",
          visual: "generic",
          defaultCount: 12,
          growth: 0.45
        }
      : null;
    return {
      id,
      label,
      type: "cropField",
      parentId,
      polygon,
      height: 0.76,
      attrs: {
        status: "Growing",
        planted: "2026-04-06",
        soil: "Sandy loam",
        rows: 5,
        cropKey: crop?.key || null,
        cropName: crop?.name || "",
        count: crop?.defaultCount || 0,
        visual: crop?.visual || "generic",
        growth: crop?.growth || 0.2,
        ...attrs
      }
    };
}

export function livestock(id: string, label: string, polygon: Point[], attrs: LivestockAttrs): LivestockObject {
    return {
      id,
      label,
      type: "livestock",
      polygon,
      height: 0.55,
      attrs
    };
}

export function structure(id: string, label: string, polygon: Point[], attrs: StructureAttrs): StructureObject {
    return {
      id,
      label,
      type: "structure",
      polygon,
      height: attrs.height || 5,
      attrs
    };
}

export function path(id: string, label: string, points: Point[], attrs: Partial<PathAttrs> = {}): PathObject {
    return {
      id,
      label,
      type: "path",
      points,
      attrs: {
        status: "Open",
        material: "Packed gravel",
        ...attrs
      }
    };
}

export function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
  }

const initialObjects: FarmObject[] = [
    cropArea("north-field", "North Crop Area", [[13, 8], [63, 7], [67, 36], [15, 39]], {
      status: "Parent crop area",
      soil: "Sandy loam"
    }),
    cropField("tomato-slot", "Tomato Field", [[16, 11], [39, 10], [41, 31], [18, 34]], "north-field", "tomato", {
      status: "Vegetative growth",
      count: 16,
      growth: 0.58
    }),
    cropField("corn-slot", "Corn Field", [[42, 10], [59, 10], [63, 30], [44, 31]], "north-field", "corn", {
      status: "Vegetative growth",
      count: 12,
      growth: 0.52
    }),
    cropArea("east-garden", "East Garden", [[69, 26], [94, 25], [96, 41], [70, 43]], {
      status: "Parent crop area",
      soil: "Compost blend"
    }),
    cropField("basil-slot", "Basil Bed", [[72, 29], [83, 28], [84, 39], [72, 40]], "east-garden", "basil", {
      status: "Established",
      count: 22,
      growth: 0.66
    }),
    cropField("lettuce-slot", "Lettuce Bed", [[85, 28], [93, 28], [94, 38], [85, 39]], "east-garden", "lettuce", {
      status: "Established",
      count: 18,
      growth: 0.74
    }),
    livestock("hen-yard", "Hen Yard", [[60, 49], [86, 45], [92, 62], [66, 68]], {
      species: "Chicken",
      breed: "Rhode Island Red",
      count: 12,
      status: "Pastured"
    }),
    livestock("goat-run", "Goat Run", [[10, 40], [31, 38], [39, 48], [20, 52]], {
      species: "Goat",
      breed: "Nigerian Dwarf",
      count: 4,
      status: "Rotational graze"
    }),
    structure("tool-shed", "Tool Shed", [[71, 13], [84, 12], [85, 23], [72, 24]], {
      kind: "Shed",
      height: 5.8,
      material: "Cedar siding",
      status: "Stocked"
    }),
    structure("main-barn", "Main Barn", [[20, 52], [37, 50], [42, 64], [24, 68]], {
      kind: "Barn",
      height: 8.6,
      material: "Timber frame",
      status: "Ready"
    }),
    structure("greenhouse", "Greenhouse", [[44, 48], [58, 46], [61, 58], [47, 61]], {
      kind: "Greenhouse",
      height: 6.6,
      material: "Polycarbonate",
      status: "In use"
    }),
    path("main-path", "Main Path", [[6, 70], [22, 62], [40, 55], [61, 50], [87, 54], [101, 62]], {
      status: "Primary access"
    })
  ];

export const state: FarmState = {
    mode: "select",
    drawType: "cropArea",
    view: "satellite",
    units: "ft",
    selectedId: "tomato-slot",
    draft: [],
    mouse: null,
    zoom: 1,
    panX: 0,
    panY: -18,
    rotation: 0,
    pointerDown: null,
    isPanning: false,
    lastHitCycle: null,
    playing: false,
    playTimer: null,
    boundaryConfirmed: false,
    boundaryGeo: null,
    boundaryLocal: clone(DEFAULT_FARM_BOUNDS),
    objects: clone(initialObjects),
    commits: [
      {
        id: "commit-1",
        timestamp: "2026-05-10T09:00:00",
        name: "Demo farm loaded",
        autoName: "Demo farm loaded",
        objects: clone(initialObjects)
      }
    ],
    commitIndex: 0,
    dirtyPanelKey: "",
    pendingCatalogMode: null
};

export function currentObjects(): FarmObject[] {
    return state.objects;
}

export function setCurrentObjects(objects: FarmObject[]): void {
    state.objects = clone(objects);
}

export function exportSnapshot(): FarmManagerSnapshot {
    return {
      version: 1,
      boundaryConfirmed: state.boundaryConfirmed,
      boundaryGeo: clone(state.boundaryGeo),
      boundaryLocal: clone(activeBoundary()),
      objects: clone(state.objects),
      commits: clone(state.commits),
      commitIndex: state.commitIndex,
      units: state.units,
      view: state.view,
      selectedId: state.selectedId
    };
}

export function importSnapshot(snapshot: FarmManagerSnapshot): void {
    state.boundaryConfirmed = Boolean(snapshot.boundaryConfirmed);
    state.boundaryGeo = clone(snapshot.boundaryGeo);
    state.boundaryLocal = snapshot.boundaryLocal?.length >= 3 ? clone(snapshot.boundaryLocal) : clone(DEFAULT_FARM_BOUNDS);
    state.objects = clone(snapshot.objects || []);
    state.commits = snapshot.commits?.length
      ? clone(snapshot.commits)
      : [
          {
            id: `commit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            name: "Loaded farm state",
            autoName: "Loaded farm state",
            objects: clone(state.objects)
          }
        ];
    state.commitIndex = Geometry.clamp(Number(snapshot.commitIndex) || 0, 0, state.commits.length - 1);
    state.objects = snapshot.objects?.length ? clone(snapshot.objects) : clone(state.commits[state.commitIndex].objects);
    state.units = snapshot.units || "ft";
    state.view = snapshot.view || "satellite";
    state.selectedId = snapshot.selectedId && state.objects.some((object) => object.id === snapshot.selectedId)
      ? snapshot.selectedId
      : state.objects[0]?.id || null;
    state.draft = [];
    state.mouse = null;
    state.pendingCatalogMode = null;
    state.dirtyPanelKey = "";
}

export function createCommit(name: string): FarmCommit {
    const now = new Date();
    const autoName = `Farm snapshot - ${now.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    })}`;
    const commit = {
      id: `commit-${Date.now()}`,
      timestamp: now.toISOString(),
      name: name || autoName,
      autoName,
      objects: clone(state.objects)
    };
    state.commits = state.commits.slice(0, state.commitIndex + 1);
    state.commits.push(commit);
    state.commitIndex = state.commits.length - 1;
    return commit;
}

export function resetForManualPlan(): void {
    const now = new Date();
    state.objects = [];
    state.selectedId = null;
    state.draft = [];
    state.mouse = null;
    state.pendingCatalogMode = null;
    state.commits = [
      {
        id: `commit-${Date.now()}`,
        timestamp: now.toISOString(),
        name: "Boundary saved",
        autoName: "Boundary saved",
        objects: []
      }
    ];
    state.commitIndex = 0;
}

export function activeBoundary(): Point[] {
    return state.boundaryLocal?.length >= 3 ? state.boundaryLocal : DEFAULT_FARM_BOUNDS;
}

export function setBoundaryFromGeo(points: Point[]): void {
    state.boundaryGeo = clone(points);
    state.boundaryLocal = geoPolygonToLocal(points);
    state.boundaryConfirmed = true;
}

function geoPolygonToLocal(points: Point[]): Point[] {
    if (!points || points.length < 3) return clone(DEFAULT_FARM_BOUNDS);
    const closed = points.slice(0, 3).every(Boolean) ? points.slice() : clone(DEFAULT_FARM_BOUNDS);
    const lngs = closed.map((point) => point[0]);
    const lats = closed.map((point) => point[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
    const feetPerDegreeLat = 364000;
    const feetPerDegreeLng = Math.max(1, feetPerDegreeLat * Math.cos(midLat));
    const projected: Point[] = closed.map((point) => [
      (point[0] - minLng) * feetPerDegreeLng,
      (maxLat - point[1]) * feetPerDegreeLat
    ]);
    const bbox = Geometry.getBBox(projected);
    return projected.map((point) => [point[0] - bbox.minX, point[1] - bbox.minY]);
}

export function resetBoundary(): void {
    state.boundaryGeo = null;
    state.boundaryLocal = clone(DEFAULT_FARM_BOUNDS);
    state.boundaryConfirmed = false;
}

export function deleteObject(id: string): void {
    const object = state.objects.find((item) => item.id === id);
    if (!object) return;
    const childIds =
      object.type === "cropArea"
        ? state.objects.filter((item): item is CropFieldObject => item.type === "cropField" && item.parentId === object.id).map((item) => item.id)
        : [];
    const idsToDelete = new Set([id, ...childIds]);
    state.objects = state.objects.filter((item) => !idsToDelete.has(item.id));
    state.selectedId = state.objects[0]?.id || null;
}

export function loadCommit(index: number): void {
    state.commitIndex = Geometry.clamp(index, 0, state.commits.length - 1);
    state.objects = clone(state.commits[state.commitIndex].objects);
}

export function useAiPreset(): void {
    const preset = clone(initialObjects);
    preset.push(
      cropArea("south-rotation", "South Rotation", [[45, 62], [65, 59], [73, 74], [50, 78]], {
        status: "AI draft crop area",
        soil: "Loam"
      }),
      cropField("squash-slot", "Squash Patch", [[48, 64], [62, 62], [67, 73], [51, 76]], "south-rotation", "squash", {
        status: "AI draft",
        count: 8,
        growth: 0.42
      })
    );
    state.objects = preset;
    createCommit("AI draft preset");
}
