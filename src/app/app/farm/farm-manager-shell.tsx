"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./farm-manager-shell.module.css";

type FarmManagerRuntime = {
  mountFarmManager: (root: ParentNode) => () => void;
};

const mapLibreCssUrl = "https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.css";
const mapLibreScriptUrl = "https://unpkg.com/maplibre-gl@5.23.0/dist/maplibre-gl.js";

export function FarmManagerShell() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cleanupFarmManager: (() => void) | null = null;
    let cancelled = false;

    async function startFarmManager() {
      try {
        await loadStylesheet("farm-manager-maplibre-css", mapLibreCssUrl);
        await loadScript("farm-manager-maplibre-js", mapLibreScriptUrl).catch(() => undefined);

        const loadRuntime = new Function("path", "return import(path)") as (path: string) => Promise<FarmManagerRuntime>;
        const runtime = await loadRuntime("/farm-manager/dist/app.js");

        if (cancelled || !rootRef.current) return;
        cleanupFarmManager = runtime.mountFarmManager(rootRef.current);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Unable to load farm manager");
      }
    }

    void startFarmManager();

    return () => {
      cancelled = true;
      cleanupFarmManager?.();
    };
  }, []);

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
              <button id="selectMode" className="active" type="button">Select</button>
              <button id="drawMode" type="button">Draw</button>
            </div>

            <div className="segmented" aria-label="Object type">
              <button data-draw-type="cropArea" className="active" type="button">Crop Area</button>
              <button data-draw-type="cropField" type="button">Crop Field</button>
              <button data-draw-type="livestock" type="button">Livestock</button>
              <button data-draw-type="structure" type="button">Structure</button>
              <button data-draw-type="path" type="button">Path</button>
            </div>

            <button id="closeShape" type="button">Close</button>
            <button id="clearDraft" type="button">Clear</button>
          </div>

          <div className="toolbar-group right">
            <div className="segmented" aria-label="Map view">
              <button data-view="grid" className="active" type="button">Grid</button>
              <button data-view="satellite" type="button">Satellite</button>
            </div>

            <div className="segmented" aria-label="Measurement units">
              <button data-units="ft" className="active" type="button">ft</button>
              <button data-units="m" type="button">m</button>
            </div>

            <button id="zoomOut" type="button">-</button>
            <button id="zoomIn" type="button">+</button>
            <button id="rotateView" type="button">Rotate</button>
            <button id="resetView" type="button">Reset</button>
            <button id="settingsButton" type="button">Settings</button>
          </div>
        </header>

        <main className="stage">
          <canvas id="farmCanvas" aria-label="Interactive low-poly farm map" />

          <aside className="object-panel" aria-live="polite">
            <div className="panel-header">
              <span id="panelKicker">Selection</span>
              <strong id="panelTitle">No object selected</strong>
            </div>
            <div id="objectDetails" className="details" />
          </aside>

          <div className="snapshot-chip">
            <span id="snapshotDate" />
            <strong id="snapshotLabel" />
          </div>
        </main>

        <footer className="timeline">
          <button id="playTimeline" type="button">Play</button>
          <input id="timelineInput" type="range" min="0" value="0" step="1" readOnly />
          <div id="timelineMarkers" className="timeline-markers" />
          <button id="addTimelineEntry" className="timeline-add" type="button">+</button>
        </footer>

        <section id="onboarding" className="onboarding">
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
                <button id="useDemoBoundary" type="button">Demo Boundary</button>
                <button id="clearBoundary" type="button">Clear</button>
                <button id="saveBoundary" type="button">Save Boundary</button>
              </div>
            </div>
          </div>

          <div id="setupChoice" className="setup-choice hidden">
            <div className="choice-card">
              <span className="eyebrow">Step 2</span>
              <h2>Set Up Farm</h2>
              <div className="choice-grid">
                <button id="manualSetup" className="choice-button" type="button">
                  <strong>Manual</strong>
                  <span>Draw slots, then populate crop fields, paddocks, structures, and paths.</span>
                </button>
                <button id="aiSetup" className="choice-button" type="button">
                  <strong>AI Draft</strong>
                  <span>Future Gemini partitioning flow. This demo loads a preset recommendation.</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <div id="commitModal" className="modal hidden" role="dialog" aria-modal="true">
          <div className="modal-card">
            <span className="eyebrow">Timeline</span>
            <h2>Create Timeline Entry</h2>
            <p>Name the current farm state, or skip to use an automatic timestamp label.</p>
            <input id="commitName" type="text" placeholder="Optional name" />
            <div className="modal-actions">
              <button id="skipCommitName" type="button">Skip</button>
              <button id="saveCommitName" className="active" type="button">Save</button>
            </div>
          </div>
        </div>

        <div id="backendGate" className="backend-gate hidden" role="status" aria-live="polite" />
      </div>

      {loadError ? <div className={styles.loadError}>Farm manager failed to load: {loadError}</div> : null}
    </div>
  );
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
