import type { BoundaryMapUi, Point } from "./types.js";

declare const maplibregl: any;

const boundaryPoints: Point[] = [];
let map: any = null;

export function init(ui: BoundaryMapUi, onBoundarySaved: (points: Point[]) => void, options: { bindControls?: boolean } = {}): () => void {
    const controller = new AbortController();
    const bindControls = options.bindControls !== false;

    if (typeof maplibregl === "undefined") {
      ui.mapFallback.classList.remove("hidden");
      if (bindControls) bindUiControls(ui, onBoundarySaved, controller.signal);
      return () => controller.abort();
    }

    try {
      map = new maplibregl.Map({
        container: ui.boundaryMap,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [-121.7405, 38.5449],
        zoom: 13.5,
        pitch: 0
      });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 160, unit: "imperial" }), "bottom-left");
      map.on("load", () => {
        map.addSource("farm-boundary", emptyGeoJsonSource());
        map.addLayer({
          id: "farm-boundary-fill",
          type: "fill",
          source: "farm-boundary",
          paint: {
            "fill-color": "#67c5a0",
            "fill-opacity": 0.24
          }
        });
        map.addLayer({
          id: "farm-boundary-line",
          type: "line",
          source: "farm-boundary",
          paint: {
            "line-color": "#f0c35a",
            "line-width": 3
          }
        });
        map.addLayer({
          id: "farm-boundary-points",
          type: "circle",
          source: "farm-boundary",
          paint: {
            "circle-radius": 5,
            "circle-color": "#f0c35a",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#151d1a"
          }
        });
      });
      map.on("click", (event: { lngLat: { lng: number; lat: number } }) => {
        boundaryPoints.push([event.lngLat.lng, event.lngLat.lat]);
        updateMapSource();
      });
      map.on("error", () => ui.mapFallback.classList.remove("hidden"));
    } catch (error) {
      ui.mapFallback.classList.remove("hidden");
    }

    if (bindControls) bindUiControls(ui, onBoundarySaved, controller.signal);

    return () => {
      controller.abort();
      boundaryPoints.length = 0;
      if (map) {
        map.remove();
        map = null;
      }
    };
}

export function redraw(): void {
    clearBoundary();
}

export function clearBoundary(): void {
    boundaryPoints.length = 0;
    updateMapSource();
}

export function useDemoBoundary(): void {
    boundaryPoints.length = 0;
    boundaryPoints.push(...demoBoundary());
    updateMapSource();
}

export function saveBoundary(onBoundarySaved: (points: Point[]) => void): void {
    if (boundaryPoints.length < 3) {
      boundaryPoints.length = 0;
      boundaryPoints.push(...demoBoundary());
    }
    updateMapSource();
    onBoundarySaved(boundaryPoints.slice());
}

function bindUiControls(ui: BoundaryMapUi, onBoundarySaved: (points: Point[]) => void, signal: AbortSignal): void {
    ui.clearBoundary?.addEventListener("click", clearBoundary, { signal });
    ui.useDemoBoundary?.addEventListener("click", useDemoBoundary, { signal });
    ui.saveBoundary?.addEventListener("click", () => saveBoundary(onBoundarySaved), { signal });
}

function demoBoundary(): Point[] {
    return [
      [-121.7471, 38.5484],
      [-121.7354, 38.5488],
      [-121.7334, 38.5407],
      [-121.7462, 38.5399]
    ];
}

function emptyGeoJsonSource() {
    return {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: []
      }
    };
}

function updateMapSource(): void {
    if (!map || !map.getSource("farm-boundary")) return;
    const features: unknown[] = [];
    if (boundaryPoints.length >= 2) {
      features.push({
        type: "Feature",
        geometry: {
          type: boundaryPoints.length >= 3 ? "Polygon" : "LineString",
          coordinates:
            boundaryPoints.length >= 3
              ? [[...boundaryPoints, boundaryPoints[0]]]
              : boundaryPoints
        },
        properties: {}
      });
    }
    boundaryPoints.forEach((point) => {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: point },
        properties: {}
      });
    });
    map.getSource("farm-boundary").setData({
      type: "FeatureCollection",
      features
    });
}
