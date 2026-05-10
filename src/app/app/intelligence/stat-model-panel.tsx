"use client";

import { useState } from "react";
import { PixelGlyph } from "../_components/icons";

type ScoreBreakdown = {
  profit: number;
  climate: number;
  space: number;
  market: number;
  water?: number;
  risk: number;
};

type OptionScore = {
  option_id: string;
  category: "plant" | "animal";
  name: string;
  score: number;
  rank: number;
  expected_profit_usd: number;
  expected_profit_usd_per_acre: number;
  p10_profit_usd: number;
  probability_of_loss: number;
  capacity_units: number;
  ideal_space_square_feet: number;
  score_breakdown: ScoreBreakdown;
  assumptions: Record<string, unknown>;
  reasons: string[];
  warnings: string[];
};

type WeatherContext = {
  rainfall_inches_seasonal: number;
  rainfall_mm_seasonal: number;
  gdd_base50: number;
  heat_stress_days_over_95f: number;
  mean_growing_temp_c: number;
  source: string;
};

type SoilContext = {
  soil_quality_index: number;
  ph: number;
  texture_class: string;
};

type ModelContext = {
  farm_area_acres: number;
  farm_area_square_feet: number;
  location: { latitude: number; longitude: number } | null;
  weather: WeatherContext;
  soil: SoilContext;
  labor_rate_usd_per_hour: number;
  water_cost_usd_per_acre_foot: number;
  seasonal_water_allocation_acre_feet: number;
  scenario_count: number;
  random_seed: number;
  risk_tolerance: number;
};

type FarmPlanSummary = {
  planName: string;
  planStatus: string;
  boundarySource: string;
  areaSquareFeet: number;
  areaAcres: number;
  cropFieldCount: number;
  livestockCount: number;
  livestockSpecies: string[];
  structureCount: number;
  totalObjects: number;
  cropNames: string[];
  hasGeoLocation: boolean;
  updatedAt: string;
};

type StatModelResponse = {
  farm_id: string;
  season_year: number;
  generated_at: string;
  ranked_options: OptionScore[];
  plant_options: OptionScore[];
  animal_options: OptionScore[];
  context: ModelContext;
  farm_plan_summary: FarmPlanSummary;
};

export function StatModelButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StatModelResponse | null>(null);

  async function fetchStatModel() {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/intelligence/stat-model", {
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to reach statistical model");
      }

      setData(result as StatModelResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach statistical model");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
            <PixelGlyph name="sparkle" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#607145]">GPU Model</p>
            <h2 className="truncate font-mono text-base font-black uppercase tracking-[0.08em] text-[#27351f]">
              Statistical Crop &amp; Livestock Scoring
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchStatModel}
          disabled={isLoading}
          className="pixel-frame inline-flex items-center justify-center gap-2 rounded-none border-2 border-[#3b2a14] bg-[#b8e6a3] px-3 py-2 font-mono text-xs font-black uppercase tracking-[0.12em] text-[#3b2a14] shadow-[0_3px_0_#3b2a14] transition active:translate-y-0.5 active:shadow-[0_1px_0_#3b2a14] disabled:cursor-not-allowed disabled:bg-[#d8cfaa] disabled:text-[#746850] disabled:shadow-none"
        >
          <PixelGlyph name="sparkle" className="size-4" />
          {isLoading ? "Loading..." : data ? "Refresh Model" : "Run Statistical Model"}
        </button>
      </div>

      {error ? (
        <div className="rounded-none border-2 border-[#d88a68] bg-[#fff3ee] p-3">
          <p className="text-xs font-semibold text-[#8a3f2a]">{error}</p>
        </div>
      ) : null}

      {data ? <StatModelResults data={data} /> : null}
    </section>
  );
}

function StatModelResults({ data }: { data: StatModelResponse }) {
  const context = data.context ?? ({} as ModelContext);
  const plan = data.farm_plan_summary;

  return (
    <div className="grid gap-3">
      {/* Farm Plan Input Summary */}
      {plan ? <FarmInputPanel plan={plan} /> : null}

      {/* Environmental Context from Model */}
      {context.weather ? <EnvironmentPanel context={context} /> : null}

      {/* Top Ranked Options */}
      <RankedOptionsPanel options={data.ranked_options} />

      {/* Footer */}
      <p className="px-1 text-[10px] text-[#6c614d]">
        Generated {new Date(data.generated_at).toLocaleString()} · Vultr GPU statistical model · {data.ranked_options.length} options scored across {context.scenario_count ?? 200} scenarios{context.random_seed ? ` · seed ${context.random_seed}` : ""}
      </p>
    </div>
  );
}

function FarmInputPanel({ plan }: { plan: FarmPlanSummary }) {
  return (
    <article
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className="pixel-gradient-sky border-b-2 border-[#a8916a] p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
            <PixelGlyph name="leaf" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#607145]">Model Input</p>
            <h3 className="truncate font-mono text-base font-black uppercase tracking-[0.08em] text-[#27351f]">
              Farm Plan: {plan.planName}
            </h3>
          </div>
        </div>
      </div>
      <div className="grid gap-2 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label="Area" value={`${plan.areaAcres} acres`} />
          <MetricCard label="Crop Fields" value={String(plan.cropFieldCount)} />
          <MetricCard label="Livestock" value={`${plan.livestockCount} head`} />
          <MetricCard label="Structures" value={String(plan.structureCount)} />
        </div>
        {plan.cropNames.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {plan.cropNames.map((name) => (
              <span key={name} className="rounded-none border-2 border-[#c9b88a] bg-[#fff8dc] px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#5e4a26]">
                {name}
              </span>
            ))}
          </div>
        ) : null}
        {plan.livestockSpecies.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {plan.livestockSpecies.map((species) => (
              <span key={species} className="rounded-none border-2 border-[#83b86b] bg-[#eef8df] px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#335a2d]">
                {species}
              </span>
            ))}
          </div>
        ) : null}
        <p className="text-[10px] text-[#6c614d]">
          Plan status: {plan.planStatus} · Boundary: {plan.boundarySource} · Geo: {plan.hasGeoLocation ? "yes" : "no"} · Updated {new Date(plan.updatedAt).toLocaleDateString()}
        </p>
      </div>
    </article>
  );
}

function EnvironmentPanel({ context }: { context: ModelContext }) {
  const weather = context.weather;
  const soil = context.soil;

  if (!weather || !soil) {
    return null;
  }

  return (
    <article
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className="pixel-gradient-need border-b-2 border-[#a8916a] p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
            <PixelGlyph name="sun" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#607145]">Environment</p>
            <h3 className="truncate font-mono text-base font-black uppercase tracking-[0.08em] text-[#27351f]">
              Weather, Soil &amp; Water Assumptions
            </h3>
          </div>
        </div>
      </div>
      <div className="grid gap-2 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label="Rainfall" value={`${(weather.rainfall_inches_seasonal ?? 0).toFixed(1)}″`} />
          <MetricCard label="Growing Temp" value={`${(weather.mean_growing_temp_c ?? 0).toFixed(1)}°C`} />
          <MetricCard label="Heat Stress" value={`${weather.heat_stress_days_over_95f ?? 0}d >95°F`} />
          <MetricCard label="GDD (base 50)" value={String(Math.round(weather.gdd_base50 ?? 0))} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard label="Soil Quality" value={`${((soil.soil_quality_index ?? 0) * 100).toFixed(0)}%`} />
          <MetricCard label="Soil pH" value={(soil.ph ?? 0).toFixed(1)} />
          <MetricCard label="Texture" value={soil.texture_class ?? "unknown"} />
          <MetricCard label="Water Alloc." value={`${(context.seasonal_water_allocation_acre_feet ?? 0).toFixed(1)} af`} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MetricCard label="Water Cost" value={`$${context.water_cost_usd_per_acre_foot ?? 0}/af`} />
          <MetricCard label="Labor Rate" value={`$${context.labor_rate_usd_per_hour ?? 0}/hr`} />
        </div>
        <p className="text-[10px] text-[#6c614d]">
          Weather source: {weather.source ?? "unknown"} · Location: {context.location ? `${context.location.latitude.toFixed(4)}, ${context.location.longitude.toFixed(4)}` : "not set"}
        </p>
      </div>
    </article>
  );
}

function RankedOptionsPanel({ options }: { options: OptionScore[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const topOptions = options.slice(0, 10);

  return (
    <article
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className="pixel-gradient-sell border-b-2 border-[#a8916a] p-3">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
            <PixelGlyph name="basket" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#607145]">Top Ranked</p>
            <h3 className="truncate font-mono text-base font-black uppercase tracking-[0.08em] text-[#27351f]">
              Best Options for Your Farm
            </h3>
          </div>
        </div>
      </div>
      <div className="divide-y-2 divide-[#e8dfc4]">
        {topOptions.map((option) => (
          <OptionRow
            key={option.option_id}
            option={option}
            isExpanded={expanded === option.option_id}
            onToggle={() => setExpanded(expanded === option.option_id ? null : option.option_id)}
          />
        ))}
      </div>
    </article>
  );
}

function OptionRow({ option, isExpanded, onToggle }: { option: OptionScore; isExpanded: boolean; onToggle: () => void }) {
  const profitColor = option.expected_profit_usd >= 0 ? "text-[#2f6f4e]" : "text-[#8a3f2a]";

  return (
    <div>
      <button type="button" onClick={onToggle} className="flex w-full flex-wrap items-center gap-3 px-3 py-2.5 text-left hover:bg-[#fff8dc]/50">
        <span className="grid size-7 shrink-0 place-items-center rounded-none border-2 border-[#c9b88a] bg-[#fff8dc] font-mono text-[10px] font-black text-[#5e4a26]">
          {option.rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-mono text-sm font-black text-[#27351f]">{option.name}</p>
            <span className="rounded-none border border-[#c9b88a] bg-[#fff8dc] px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-[#5e4a26]">
              {option.category}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] font-black text-[#607145]">
              Score: {option.score.toFixed(1)}
            </span>
            <span className={`font-mono text-[10px] font-black ${profitColor}`}>
              Profit: ${formatNumber(option.expected_profit_usd)}
            </span>
          </div>
        </div>
        <span className="font-mono text-[10px] text-[#6c614d]">{isExpanded ? "▲" : "▼"}</span>
      </button>

      {isExpanded ? <OptionDetail option={option} /> : null}
    </div>
  );
}

function OptionDetail({ option }: { option: OptionScore }) {
  const breakdown = option.score_breakdown;
  const assumptions = option.assumptions;

  return (
    <div className="border-t border-[#e8dfc4] bg-[#fffdf5] px-3 py-2.5">
      {/* Score Breakdown */}
      <p className="mb-1.5 font-mono text-[9px] font-black uppercase tracking-[0.12em] text-[#607145]">Score Breakdown</p>
      <div className="mb-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        <MiniMetric label="Profit" value={breakdown.profit} />
        <MiniMetric label="Climate" value={breakdown.climate} />
        <MiniMetric label="Market" value={breakdown.market} />
        {breakdown.water !== undefined ? <MiniMetric label="Water" value={breakdown.water} /> : null}
      </div>

      {/* Key Metrics */}
      <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <MiniCard label="Profit/acre" value={`$${formatNumber(option.expected_profit_usd_per_acre)}`} />
        <MiniCard label="Space needed" value={`${option.ideal_space_square_feet} sqft`} />
      </div>

      {/* Assumptions */}
      <p className="mb-1 font-mono text-[9px] font-black uppercase tracking-[0.12em] text-[#607145]">Assumptions</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {Object.entries(assumptions).map(([key, value]) => (
          <span key={key} className="rounded-none border border-[#d4c39a] bg-[#fff8dc] px-1.5 py-0.5 font-mono text-[9px] text-[#5e4a26]">
            {formatAssumptionKey(key)}: {formatAssumptionValue(value)}
          </span>
        ))}
      </div>

      {/* Reasons */}
      {option.reasons.length > 0 ? (
        <p className="mb-1 text-[10px] text-[#2f6f4e]">
          ✓ {option.reasons.join(" · ")}
        </p>
      ) : null}

      {/* Warnings */}
      {option.warnings.length > 0 ? (
        <div className="mt-1">
          {option.warnings.map((warning, i) => (
            <p key={i} className="text-[10px] text-[#8a3f2a]">⚠ {warning}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  const barColor = value >= 70 ? "bg-[#83b86b]" : value >= 40 ? "bg-[#f2bd4b]" : "bg-[#c95b76]";

  return (
    <div className="rounded-none border border-[#d4c39a] bg-[#fff8dc] px-1.5 py-1">
      <p className="font-mono text-[8px] font-black uppercase text-[#607145]">{label}</p>
      <div className="mt-0.5 flex items-center gap-1">
        <div className="h-1.5 flex-1 rounded-none bg-[#e8dfc4]">
          <div className={`h-full rounded-none ${barColor}`} style={{ width: `${Math.min(100, value)}%` }} />
        </div>
        <span className="font-mono text-[8px] font-black text-[#27351f]">{Math.round(value)}</span>
      </div>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none border border-[#d4c39a] bg-[#fff8dc] px-1.5 py-1">
      <p className="font-mono text-[8px] font-black uppercase text-[#607145]">{label}</p>
      <p className="mt-0.5 truncate font-mono text-[10px] font-black text-[#27351f]">{value}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none border-2 border-[#c9b88a] bg-[#fff8dc] px-3 py-2">
      <p className="font-mono text-[9px] font-black uppercase tracking-[0.1em] text-[#607145]">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-black text-[#27351f]">{value}</p>
    </div>
  );
}

function formatNumber(value: number) {
  if (Math.abs(value) >= 1000) {
    return `${(Math.round(value / 100) / 10).toFixed(1)}k`;
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(0);
}

function formatAssumptionKey(key: string) {
  return key.replace(/_/g, " ").replace(/usd/gi, "$").replace(/per/g, "/");
}

function formatAssumptionValue(value: unknown): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }
  return String(value ?? "—");
}
