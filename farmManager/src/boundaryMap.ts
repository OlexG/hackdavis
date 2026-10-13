import type { BoundaryMapUi, Point } from "./types.js";

type MapClickEvent = { lngLat: { lng: number; lat: number } };

interface GeoJsonSource {
  setData(data: unknown): void;
}

interface BoundaryMap {
  addControl(control: unknown, position?: string): void;
  addLayer(layer: unknown): void;
  addSource(id: string, source: unknown): void;
  flyTo(options: unknown): void;
  getSource(id: string): GeoJsonSource | undefined;
  on(event: "click", listener: (event: MapClickEvent) => void): void;
  on(event: "load" | "error", listener: () => void): void;
  remove(): void;
}

interface MapLibreGlobal {
  Map: new (options: unknown) => BoundaryMap;
  NavigationControl: new (options: unknown) => unknown;
  ScaleControl: new (options: unknown) => unknown;
  GeolocateControl: new (options: unknown) => unknown;
}

const boundaryPoints: Point[] = [];
let map: BoundaryMap | null = null;

export function init(ui: BoundaryMapUi, onBoundarySaved: (points: Point[]) => void, options: { bindControls?: boolean } = {}): () => void {
    const controller = new AbortController();
    const bindControls = options.bindControls !== false;
    const mapLibre = (globalThis as typeof globalThis & { maplibregl?: MapLibreGlobal }).maplibregl;

    if (!mapLibre) {
      ui.mapFallback.classList.remove("hidden");
      if (bindControls) bindUiControls(ui, onBoundarySaved, controller.signal);
      return () => controller.abort();
    }

    try {
      let mapLoaded = false;
      map = new mapLibre.Map({
        container: ui.boundaryMap,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [-121.7405, 38.5449],
        zoom: 13.5,
        pitch: 0
      });
      map.addControl(new mapLibre.NavigationControl({ visualizePitch: false }), "top-right");
      map.addControl(new mapLibre.ScaleControl({ maxWidth: 160, unit: "imperial" }), "bottom-left");
      try {
        const geolocate = new mapLibre.GeolocateControl({
          positionOptions: { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
          trackUserLocation: false,
          showUserLocation: true,
          fitBoundsOptions: { maxZoom: 18 }
        });
        map.addControl(geolocate, "top-right");
      } catch (controlError) {
        // Geolocate control unavailable — fall back to manual recenter below.
      }
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            if (!map) return;
            map.flyTo({
              center: [position.coords.longitude, position.coords.latitude],
              zoom: 18,
              speed: 1.6,
              curve: 1.4,
              essential: true
            });
          },
          () => {
            // Permission denied or unavailable — keep the default center.
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
        );
      }
      map.on("load", () => {
        mapLoaded = true;
        ui.mapFallback.classList.add("hidden");
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
      map.on("click", (event: MapClickEvent) => {
        boundaryPoints.push([event.lngLat.lng, event.lngLat.lat]);
        updateMapSource();
      });
      map.on("error", () => {
        if (!mapLoaded) ui.mapFallback.classList.remove("hidden");
      });
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

export function focusLocation(longitude: number, latitude: number): void {
    if (!map || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
    map.flyTo({
      center: [longitude, latitude],
      zoom: 18,
      speed: 1.4,
      curve: 1.2,
      essential: true
    });
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
