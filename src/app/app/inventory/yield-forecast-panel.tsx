"use client";

import Image from "next/image";
import type { DragEvent } from "react";
import type { InventoryPlanOutput } from "@/lib/inventory";
import { PixelGlyph } from "../_components/icons";
import { yieldForecastDragType } from "./drag-types";

export function YieldForecastPanel({
  plan,
}: {
  plan: {
    name: string;
    season: string;
    currentDate: string;
    outputs: InventoryPlanOutput[];
  };
}) {
  return (
    <section
      className="pixel-frame rounded-none border-2 border-[#a8916a] bg-[#f6f3dc] p-2"
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md border-2 border-[#8b6f3e] bg-[#fffdf5] text-[#8b6f3e] shadow-[0_1px_0_#5e4a26]">
            <PixelGlyph name="scroll" className="size-4" />
          </span>
          <div>
            <h2 className="font-mono text-sm font-black uppercase tracking-[0.14em] text-[#34432b]">
              Today&rsquo;s Yield Forecast
            </h2>
            <p className="mt-0.5 text-xs text-[#746850]">
              {plan.name} · {plan.season} · as of {formatShortDate(plan.currentDate)}
            </p>
          </div>
        </div>
        <span className="rounded-md border-2 border-[#8fc3ca] bg-[#e9fbfb] px-2 py-1 font-mono text-xs font-bold text-[#245c65] shadow-[0_2px_0_#5e8a91]">
          {plan.outputs.length} projected
        </span>
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        {plan.outputs.map((output) => (
          <OutputCard key={output.id} output={output} />
        ))}
      </div>
    </section>
  );
}

function OutputCard({ output }: { output: InventoryPlanOutput }) {
  function handleDragStart(event: DragEvent<HTMLElement>) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(yieldForecastDragType, JSON.stringify(output));
  }

  return (
    <article
      draggable
      onDragStart={handleDragStart}
      className="cursor-grab rounded-md border-2 border-[#c9b88a] bg-[#fffdf5] p-2 shadow-[0_2px_0_#b29c66] transition hover:-translate-y-0.5 hover:shadow-[0_4px_0_#b29c66] active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <PixelIconSlot src={iconForOutput(output)} label={output.name} compact />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-[#2d311f]">{output.name}</h3>
          <p className="truncate text-xs text-[#746850]">{output.source}</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded border border-[#eadfca] bg-[#fffaf0] px-2 py-1 font-mono font-semibold text-[#365833]">
          {formatShortDate(output.startsAt)}
        </span>
        <span className="rounded border border-[#eadfca] bg-[#fffaf0] px-2 py-1 font-mono font-semibold text-[#365833]">
          {output.cadence}
        </span>
      </div>
    </article>
  );
}

function PixelIconSlot({
  src,
  label,
  compact = false,
}: {
  src: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded border border-[#cfbea1] bg-[#fff8dc] shadow-[inset_0_-4px_0_rgba(95,80,43,0.12)] ${
        compact ? "size-8" : "size-10"
      }`}
    >
      <Image
        src={src}
        alt={`${label} icon`}
        width={16}
        height={16}
        className={compact ? "size-5" : "size-7"}
        style={{ imageRendering: "pixelated" }}
        unoptimized
      />
    </span>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function iconForOutput(output: InventoryPlanOutput) {
  const name = `${output.name} ${output.source}`.toLowerCase();

  if (name.includes("tomato")) {
    return "/inventory-icons/plants/tomato.png";
  }

  if (name.includes("lettuce")) {
    return "/inventory-icons/plants/lettuce.png";
  }

  if (name.includes("egg") || output.category === "livestock") {
    return "/inventory-icons/animals/chickens.png";
  }

  return output.category === "produce" ? "/inventory-icons/plants/peas.png" : "/inventory-icons/plants/corn.png";
}
