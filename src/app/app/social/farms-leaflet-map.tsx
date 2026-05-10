"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { SocialFarmCard } from "@/lib/social";

type FarmsLeafletMapProps = {
  farms: SocialFarmCard[];
  activeUserId: string | null;
  onSelect: (userId: string) => void;
};

export function FarmsLeafletMap({ farms, activeUserId, onSelect }: FarmsLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markersRef = useRef<Map<string, import("leaflet").Marker>>(new Map());
  const onSelectRef = useRef(onSelect);
  const farmsRef = useRef(farms);
  const didFitRef = useRef(false);

  function renderMarkers(L: typeof import("leaflet")) {
    const map = mapRef.current;
    if (!map) return;

    const wantedIds = new Set<string>();
    const points: import("leaflet").LatLngTuple[] = [];

    for (const farm of farmsRef.current) {
      const coords = farm.snapshot.details.pickupCoords;
      if (!coords) continue;
      wantedIds.add(farm.userId);
      points.push([coords.lat, coords.lng]);

      const isActive = farm.userId === activeUserId;
      const html = markerHtml(isActive);
      const icon = L.divIcon({
        className: "farms-leaflet-marker",
        html,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
      });

      const existing = markersRef.current.get(farm.userId);
      if (existing) {
        existing.setLatLng([coords.lat, coords.lng]);
        existing.setIcon(icon);
      } else {
        const marker = L.marker([coords.lat, coords.lng], { icon });
        marker.on("click", () => onSelectRef.current(farm.userId));
        marker.addTo(map);
        markersRef.current.set(farm.userId, marker);
      }
    }

    // Remove stale markers.
    for (const [userId, marker] of markersRef.current) {
      if (!wantedIds.has(userId)) {
        marker.remove();
        markersRef.current.delete(userId);
      }
    }

    // Fit bounds once on first render with at least one point.
    if (!didFitRef.current && points.length) {
      didFitRef.current = true;
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
    }
  }

  // Keep callback fresh without re-creating the map.
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // One-time map setup.
  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const markers = markersRef.current;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
        worldCopyJump: true,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;

      // Initial render — build markers and fit bounds.
      renderMarkers(L);

      // Re-render markers when the active selection or list of farms changes.
      // The next effect handles updates; this just kicks off layout settling.
      resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(containerRef.current);
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markers.clear();
      didFitRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render markers whenever the inputs change.
  useEffect(() => {
    farmsRef.current = farms;
    if (!mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      renderMarkers(L);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farms, activeUserId]);

  return <div ref={containerRef} className="block h-[600px] w-full" aria-label="Map of nearby farms" />;
}

function markerHtml(isActive: boolean) {
  const bg = isActive ? "#c95b76" : "#ffe89a";
  const fg = isActive ? "#fffdf5" : "#5e4a26";
  return `
    <div style="position: relative; width: 32px; height: 40px; cursor: pointer; image-rendering: pixelated;">
      <div style="
        position: absolute; inset: 0 0 8px 0;
        display: grid; place-items: center;
        border: 2px solid #3b2a14;
        background: ${bg};
        color: ${fg};
        box-shadow: 0 2px 0 #3b2a14;
        font-family: ui-monospace, monospace;
        font-weight: 900;
      ">
        <svg width="16" height="16" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
          <rect x="2" y="5" width="11" height="5" fill="currentColor" />
          <rect x="13" y="7" width="2" height="2" fill="currentColor" />
          <rect x="3" y="11" width="3" height="3" fill="currentColor" />
          <rect x="10" y="11" width="3" height="3" fill="currentColor" />
          <rect x="4" y="12" width="1" height="1" fill="#fffdf5" />
          <rect x="11" y="12" width="1" height="1" fill="#fffdf5" />
        </svg>
      </div>
      <div style="
        position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
        width: 0; height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid ${bg};
      "></div>
    </div>
  `;
}
