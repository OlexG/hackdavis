"use client";

import { PixelGlyph } from "../_components/icons";
import type { ShopPickupCoords } from "@/lib/models";

export function PickupPinMap({
  coords,
  label,
  heightClass = "h-48",
  onClear,
}: {
  coords: ShopPickupCoords;
  label?: string;
  heightClass?: string;
  onClear?: () => void;
}) {
  const src = getOpenStreetMapEmbedSrc(coords);

  return (
    <div className="grid gap-1.5">
      <div
        style={{ ["--pixel-frame-bg" as string]: "#fffaf0" }}
        className="pixel-frame overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#dce8c7] shadow-[0_2px_0_#3b2a14]"
      >
        <div className="pixel-gradient-meadow flex items-center gap-2 border-b-2 border-[#3b2a14] px-2 py-1.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] shadow-[0_1px_0_#3b2a14]">
            <PixelGlyph name="wagon" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#5e4a26]">
              Pickup pin
            </div>
            {label ? (
              <div className="truncate text-[11px] font-bold text-[#365833]">{label}</div>
            ) : null}
          </div>
        </div>
        <div className="relative">
          <iframe
            key={src}
            title="Pickup location map"
            src={src}
            className={`block w-full ${heightClass}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-t-2 border-[#3b2a14] bg-[#fffdf5] px-2 py-1.5 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#5e4a26]">
          <span>
            {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </span>
          <a
            href={`https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=16/${coords.lat}/${coords.lng}`}
            target="_blank"
            rel="noreferrer"
            className="text-[#365833] underline decoration-2 underline-offset-2"
          >
            Open map
          </a>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="rounded-none border-2 border-[#8b6f3e] bg-[#fff8dc] px-2 py-0.5 text-[#7a461f] shadow-[0_2px_0_#5e4a26] transition hover:bg-[#fff3cf] active:translate-y-0.5 active:shadow-[0_1px_0_#5e4a26]"
            >
              Clear pin
            </button>
          ) : null}
        </div>
      </div>
      <p className="font-mono text-[9px] font-black uppercase tracking-[0.1em] text-[#8b6f3e]">
        Map data © OpenStreetMap contributors
      </p>
    </div>
  );
}

function getOpenStreetMapEmbedSrc(coords: ShopPickupCoords) {
  const span = 0.01;
  const minLng = (coords.lng - span).toFixed(6);
  const maxLng = (coords.lng + span).toFixed(6);
  const minLat = (coords.lat - span).toFixed(6);
  const maxLat = (coords.lat + span).toFixed(6);

  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng},${minLat},${maxLng},${maxLat}&layer=mapnik&marker=${coords.lat},${coords.lng}`;
}
