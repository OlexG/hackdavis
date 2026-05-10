"use client";

import { useMemo, useState } from "react";
import type { MonthlyForecastPoint, ProductionForecast } from "@/lib/intelligence";
import { PixelGlyph } from "../_components/icons";

const confidenceStyles = {
  low: "border-[#d8a05a] bg-[#fff1dc] text-[#7a461f]",
  medium: "border-[#7eb3bd] bg-[#e9fbfb] text-[#245c65]",
  high: "border-[#83b86b] bg-[#eef8df] text-[#335a2d]",
};

export function YieldForecastSelector({ forecasts }: { forecasts: ProductionForecast[] }) {
  const [selectedOutputId, setSelectedOutputId] = useState(forecasts[0]?.outputId ?? "");
  const selectedForecast = forecasts.find((forecast) => forecast.outputId === selectedOutputId) ?? forecasts[0];
  const monthlyTrend = useMemo(
    () => selectedForecast ? getMonthlyForecastTrend(selectedForecast) : [],
    [selectedForecast],
  );
  const annualAmount = monthlyTrend.reduce((total, point) => total + point.expectedAmount, 0);
  const annualRevenue = monthlyTrend.reduce((total, point) => total + point.expectedValueUsd, 0);

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <PanelTitle />
        <p className="max-w-2xl text-xs leading-5 text-[#6c614d]">
          Select a product to inspect its month-by-month output curve.
        </p>
      </div>

      {selectedForecast ? (
        <article
          style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
          className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
        >
          <div className="pixel-gradient-meadow border-b-2 border-[#a8916a] p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#2f6f4e]">
                  {selectedForecast.unit} forecast
                </p>
                <h3 className="truncate font-mono text-base font-black uppercase tracking-[0.08em] text-[#27351f]">
                  {selectedForecast.outputName}
                </h3>
              </div>
              <label className="grid min-w-[220px] gap-1">
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#607145]">
                  Product
                </span>
                <select
                  className="h-10 rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] px-2 font-mono text-xs font-black uppercase tracking-[0.08em] text-[#27351f] shadow-[0_2px_0_#3b2a14]"
                  value={selectedForecast.outputId}
                  onChange={(event) => setSelectedOutputId(event.target.value)}
                >
                  {forecasts.map((forecast) => (
                    <option key={forecast.outputId} value={forecast.outputId}>
                      {forecast.outputName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="grid gap-3 p-3">
            <div className="grid gap-2 md:grid-cols-3">
              <KpiBlock
                label="Modeled year"
                value={`${formatCompactNumber(annualAmount)} ${selectedForecast.unit}`}
                accent="#2f6f4e"
              />
              <KpiBlock
                label="Annual value"
                value={`$${formatCompactNumber(annualRevenue)}`}
                accent="#a8761c"
              />
              <div className={`rounded-none border-2 px-3 py-2 font-mono text-xs font-black uppercase tracking-[0.1em] ${confidenceStyles[selectedForecast.confidence]}`}>
                {selectedForecast.confidence} confidence
              </div>
            </div>

            <MonthlyForecastChart
              title={`${selectedForecast.outputName} monthly output`}
              points={monthlyTrend}
              unit={selectedForecast.unit}
              accent="#4e9f5d"
            />

            <TagList items={selectedForecast.keyDrivers} emptyLabel="No drivers returned" />
          </div>
        </article>
      ) : (
        <EmptyPanel title="No production forecasts" body="Generate AI intelligence after creating a farm plan with outputs." />
      )}
    </section>
  );
}

function PanelTitle() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
        <PixelGlyph name="wheat" className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#607145]">Yield Forecast</p>
        <h2 className="truncate font-mono text-base font-black uppercase tracking-[0.08em] text-[#27351f]">
          Product Forecast
        </h2>
      </div>
    </div>
  );
}

function KpiBlock({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-2">
      <p className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#607145]">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-black" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function MonthlyForecastChart({
  title,
  points,
  unit,
  accent,
}: {
  title: string;
  points: MonthlyForecastPoint[];
  unit: string;
  accent: string;
}) {
  if (!points.length) {
    return <EmptyPanel title={title} body="No monthly forecast data is available for this output yet." compact />;
  }

  const values = points.map((point) => point.expectedAmount);
  const total = values.reduce((sum, value) => sum + value, 0);
  const peak = points.reduce((best, point) => (point.expectedAmount > best.expectedAmount ? point : best), points[0]!);
  const max = Math.max(...points.map((point) => point.highEstimate), 1);
  const range = Math.max(max, 1);
  const chartPoints = points.map((point, index) => {
    const x = 42 + index * (336 / Math.max(points.length - 1, 1));
    const y = 170 - (point.expectedAmount / range) * 120;
    const lowY = 170 - (point.lowEstimate / range) * 120;
    const highY = 170 - (point.highEstimate / range) * 120;

    return { ...point, x, y, lowY, highY };
  });
  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const bandPath = [
    ...chartPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.highY.toFixed(1)}`),
    ...chartPoints.slice().reverse().map((point) => `L ${point.x.toFixed(1)} ${point.lowY.toFixed(1)}`),
    "Z",
  ].join(" ");
  const currentTimeMarker = getCurrentTimeMarker();
  const currentTimeX = 42 + currentTimeMarker.yearProgress * 336;

  return (
    <div className="rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] p-2 shadow-[0_2px_0_#3b2a14]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#607145]">{title}</span>
        <span className="font-mono text-xs font-black text-[#27351f]">
          {formatCompactNumber(total)} {unit}
        </span>
      </div>
      <svg className="h-64 w-full" viewBox="0 0 420 220" role="img" aria-label={`${title} monthly forecast chart`} shapeRendering="crispEdges">
        <rect x="0" y="0" width="420" height="220" fill="#fffdf5" />
        <path d="M42 170H378" stroke="#3b2a14" strokeWidth="2" />
        <path d="M42 110H378" stroke="#d4c39a" strokeDasharray="4 4" strokeWidth="1.5" />
        <path d="M42 50H378" stroke="#d4c39a" strokeDasharray="4 4" strokeWidth="1.5" />
        <path d={bandPath} fill="#eef8df" opacity="0.9" />
        <path d={linePath} fill="none" stroke={accent} strokeLinejoin="miter" strokeWidth="4" />
        <path d={`M${currentTimeX.toFixed(1)} 34V170`} stroke="#c3342f" strokeDasharray="6 5" strokeWidth="2" />
        {chartPoints.map((point) => (
          <g key={point.label}>
            <rect x={point.x - 4} y={point.y - 4} width="8" height="8" fill={accent} stroke="#3b2a14" strokeWidth="2" />
            <text fill="#5e4a26" fontFamily="ui-monospace" fontSize="9" fontWeight="800" textAnchor="middle" x={point.x} y="194">
              {point.label}
            </text>
          </g>
        ))}
        <text fill="#c3342f" fontFamily="ui-monospace" fontSize="10" fontWeight="900" textAnchor="middle" x={currentTimeX} y="28">
          now
        </text>
      </svg>
      <div className="grid grid-cols-3 gap-1.5">
        <ForecastMetric label="Peak" value={`${peak.label} ${formatCompactNumber(peak.expectedAmount)}`} accent={accent} />
        <ForecastMetric label="Value" value={`$${formatCompactNumber(points.reduce((totalValue, point) => totalValue + point.expectedValueUsd, 0))}`} accent="#a8761c" />
        <ForecastMetric label="Mean" value={`${formatCompactNumber(total / points.length)} ${unit}`} accent="#245c65" />
      </div>
    </div>
  );
}

function ForecastMetric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-none border-2 border-[#c9b88a] bg-[#fff8dc] px-2 py-1">
      <p className="font-mono text-[9px] font-black uppercase tracking-[0.1em] text-[#607145]">{label}</p>
      <p className="mt-0.5 truncate font-mono text-xs font-black" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function TagList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  const displayItems = items.length ? items : [emptyLabel];

  return (
    <div className="flex flex-wrap gap-1.5">
      {displayItems.map((item) => (
        <span key={item} className="rounded-none border-2 border-[#c9b88a] bg-[#fff8dc] px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#5e4a26]">
          {item}
        </span>
      ))}
    </div>
  );
}

function EmptyPanel({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return (
    <div className={`rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] ${compact ? "p-3" : "p-5"}`}>
      <h3 className="font-mono text-sm font-black uppercase tracking-[0.1em] text-[#27351f]">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-[#6c614d]">{body}</p>
    </div>
  );
}

function getMonthlyForecastTrend(forecast: ProductionForecast | Omit<ProductionForecast, "monthlyTrend">): MonthlyForecastPoint[] {
  if ("monthlyTrend" in forecast && forecast.monthlyTrend?.length && !isSteadyAnimalForecast(forecast.outputName)) {
    return forecast.monthlyTrend;
  }

  const currentYear = forecast.yearlyTrend[0]?.year ?? new Date().getFullYear();
  const annualAmount = forecast.currentYearEstimate;
  const annualValueUsd = forecast.revenueTrend[0]?.expectedValueUsd ?? 0;
  const weights = monthNames().map((_, index) => fallbackForecastWeight(forecast.outputName, index));
  const weightTotal = weights.reduce((total, weight) => total + weight, 0) || 1;

  return monthNames().map((label, index) => {
    const amount = annualAmount * (weights[index]! / weightTotal);

    return {
      year: currentYear,
      month: index + 1,
      label,
      expectedAmount: Math.round(amount * 10) / 10,
      expectedValueUsd: Math.round(annualValueUsd * (weights[index]! / weightTotal) * 100) / 100,
      lowEstimate: Math.round(amount * 0.78 * 10) / 10,
      highEstimate: Math.round(amount * 1.18 * 10) / 10,
    };
  });
}

function fallbackForecastWeight(outputName: string, index: number) {
  const normalized = outputName.toLowerCase();

  if (isSteadyAnimalForecast(normalized)) {
    return [0.92, 0.95, 1.02, 1.06, 1.08, 1.06, 1.03, 1, 0.98, 0.96, 0.94, 0.92][index] ?? 1;
  }

  if (/\b(green|lettuce|spinach|kale|herb|cilantro|parsley|basil)\b/.test(normalized)) {
    return [0.35, 0.45, 0.9, 1.4, 1.55, 1.25, 0.85, 0.65, 0.9, 1.25, 1, 0.55][index] ?? 1;
  }

  return [0.08, 0.12, 0.22, 0.55, 0.9, 1.3, 1.62, 1.74, 1.38, 0.82, 0.33, 0.14][index] ?? 1;
}

function isSteadyAnimalForecast(outputName: string) {
  return /\b(eggs?|milk|chickens?|ducks?|goats?|cows?|rabbits?|honey)\b/.test(outputName.toLowerCase());
}

function monthNames() {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
}

function getCurrentTimeMarker() {
  const now = new Date();
  const monthIndex = now.getMonth();
  const daysInMonth = new Date(now.getFullYear(), monthIndex + 1, 0).getDate();
  const monthProgress = daysInMonth ? (now.getDate() - 1) / daysInMonth : 0;
  const yearProgress = Math.min(1, Math.max(0, (monthIndex + monthProgress) / 11));

  return { yearProgress };
}

function formatCompactNumber(value: number) {
  if (value >= 1000) {
    return `${Math.round(value / 100) / 10}k`;
  }

  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}
