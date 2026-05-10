import { connection } from "next/server";
import {
  getFarmIntelligencePageData,
  type FarmIntelligenceReport,
  type MonthlyForecastPoint,
  type PlanEconomicsPoint,
  type PlanEconomicsProjection,
  type ProductionForecast,
} from "@/lib/intelligence";
import type { InventorySnapshot } from "@/lib/inventory";
import { PixelGlyph, type PixelGlyphName } from "../_components/icons";
import { IntelligenceGenerateButton } from "./intelligence-actions";
import { YieldForecastSelector } from "./yield-forecast-selector";

export default async function IntelligencePage() {
  await connection();
  const data = await getFarmIntelligencePageData();
  const report = data.savedReport?.report ?? buildDemoReport(data.snapshot);
  const isDemoReport = !data.savedReport;
  const planName = data.snapshot.plan?.name ?? report.planName;
  const isStale = data.savedReport
    ? data.snapshot.lastUpdated.localeCompare(data.savedReport.updatedAt) > 0
    : false;

  return (
    <section className="pixel-frame-2 min-h-[calc(100vh-7rem)] overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] text-[#2d2313] shadow-[0_4px_0_#3b2a14]">
      <IntelligenceHeroBanner
        planName={planName}
        generatedAt={data.savedReport?.generatedAt}
        hasReport={Boolean(data.savedReport)}
        hasBackupModelKey={data.hasBackupModelKey}
        isDemoReport={isDemoReport}
        isStale={isStale}
      />

      <div className="grid gap-3 p-3">
        {data.economics ? <PlanEconomicsSection economics={data.economics} /> : null}

        <YieldForecastSelector forecasts={report.productionForecasts} />
      </div>
    </section>
  );
}

function IntelligenceHeroBanner({
  planName,
  generatedAt,
  hasReport,
  hasBackupModelKey,
  isDemoReport,
  isStale,
}: {
  planName?: string;
  generatedAt?: string;
  hasReport: boolean;
  hasBackupModelKey: boolean;
  isDemoReport: boolean;
  isStale: boolean;
}) {
  const statusLabel = isDemoReport ? "Preview" : isStale ? "Stale · Inventory changed" : "Saved";
  const statusTone = isDemoReport
    ? "border-[#7eb3bd] bg-[#e9fbfb] text-[#245c65]"
    : isStale
      ? "border-[#d8a05a] bg-[#fff1dc] text-[#7a461f]"
      : "border-[#83b86b] bg-[#eef8df] text-[#335a2d]";

  return (
    <div className="pixel-gradient-sky relative overflow-hidden border-b-2 border-[#3b2a14] px-4 py-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "8px 8px",
        }}
      />
      <span aria-hidden className="pointer-events-none absolute left-[44%] top-[20%] size-1.5 bg-[#fffdf5]" />
      <span aria-hidden className="pointer-events-none absolute left-[64%] top-[34%] size-1 bg-[#fffdf5]" />
      <span aria-hidden className="pointer-events-none absolute left-[78%] top-[14%] size-1.5 bg-[#ffe89a]" />
      <span aria-hidden className="pointer-events-none absolute left-[88%] top-[46%] size-1 bg-[#fffdf5]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-3 items-end gap-1 px-3 opacity-70">
        {Array.from({ length: 32 }).map((_, index) => (
          <span
            key={index}
            className="h-2 flex-1 bg-[#7da854]"
            style={{ height: `${6 + ((index * 7) % 6)}px` }}
          />
        ))}
      </div>

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] text-[#a8761c] shadow-[inset_0_2px_0_rgba(255,255,255,0.6),inset_0_-4px_0_rgba(168,118,28,0.32),0_2px_0_#3b2a14]">
            <PixelGlyph name="sparkle" className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="font-mono text-lg font-black uppercase tracking-[0.18em] text-[#34432b] drop-shadow-[1px_1px_0_#fffdf5]">
              Farm Intelligence
            </h1>
            <p className="truncate text-xs text-[#5e4a26]">
              {planName ? `Backup model forecasts for ${planName}.` : "Backup model forecasts for your farm plan."}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className={`rounded-none border-2 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.1em] ${statusTone}`}>
                {statusLabel}
              </span>
              <span className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#607145]">
                {generatedAt ? `Generated ${formatShortDateTime(generatedAt)}` : "Ready when you are"}
              </span>
            </div>
          </div>
        </div>
        <IntelligenceGenerateButton hasBackupModelKey={hasBackupModelKey} hasReport={hasReport} />
      </div>
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

function PlanEconomicsSection({ economics }: { economics: PlanEconomicsProjection }) {
  const totalCost = sumEconomicsValues(economics.monthlyPoints, "operatingCostUsd");
  const totalProduction = sumEconomicsValues(economics.monthlyPoints, "productionValueUsd");
  const totalUnits = sumEconomicsValues(economics.monthlyPoints, "productionUnits");

  return (
    <section className="grid gap-3">
      <SectionHeader
        icon="ledger"
        eyebrow="Plan Economics"
        title="Month-by-Month Cost & Production"
        subtitle="A granular current-year model from the plan's crop areas, livestock output, expected prices, recurring costs, and seasonal timing."
      />
      <div className="grid gap-3 xl:grid-cols-2">
        <article
          style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
          className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
        >
          <div className="pixel-gradient-need border-b-2 border-[#a8916a] p-3">
            <PanelTitle
              icon="jar"
              eyebrow="Operating Cost"
              title="Monthly Cost Model"
              meta={`Modeled year: $${formatCompactNumber(totalCost)}`}
            />
          </div>
          <div className="grid gap-3 p-3">
            <DetailedEconomicsChart
              title="Operating cost by month"
              points={economics.monthlyPoints}
              valueKey="operatingCostUsd"
              accent="#c46a1d"
              fill="#fff1dc"
              valuePrefix="$"
            />
          </div>
        </article>

        <article
          style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
          className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
        >
          <div className="pixel-gradient-sell border-b-2 border-[#a8916a] p-3">
            <PanelTitle
              icon="basket"
              eyebrow="Production"
              title="Monthly Output Model"
              meta={`Modeled year: $${formatCompactNumber(totalProduction)} · ${formatCompactNumber(totalUnits)} units`}
            />
          </div>
          <div className="grid gap-3 p-3">
            <DetailedEconomicsChart
              title="Production value by month"
              points={economics.monthlyPoints}
              valueKey="productionValueUsd"
              accent="#2f6f4e"
              fill="#eef8df"
              valuePrefix="$"
            />
            <TagList items={economics.topOutputs} emptyLabel="No producing objects yet" compact />
          </div>
        </article>
      </div>
    </section>
  );
}

function DetailedEconomicsChart({
  title,
  points,
  valueKey,
  accent,
  fill,
  valuePrefix = "",
}: {
  title: string;
  points: PlanEconomicsPoint[];
  valueKey: "operatingCostUsd" | "productionValueUsd";
  accent: string;
  fill: string;
  valuePrefix?: string;
}) {
  if (!points.length) {
    return <EmptyPanel title={title} body="No monthly economics data is available for this plan yet." compact />;
  }

  const values = points.map((point) => point[valueKey]);
  const total = values.reduce((sum, value) => sum + value, 0);
  const mean = points.length ? total / points.length : 0;
  const variance = points.length
    ? values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / points.length
    : 0;
  const volatility = mean ? (Math.sqrt(variance) / mean) * 100 : 0;
  const firstPoint = points[0]!;
  const peak = points.reduce((best, point) => (point[valueKey] > best[valueKey] ? point : best), firstPoint);
  const low = points.reduce((best, point) => (point[valueKey] < best[valueKey] ? point : best), firstPoint);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const paddedMax = max * 1.12;
  const range = Math.max(paddedMax - min, 1);
  const chartPoints = points.map((point, index) => {
    const x = 54 + index * (340 / Math.max(points.length - 1, 1));
    const y = 174 - ((point[valueKey] - min) / range) * 128;

    return { ...point, x, y, value: point[valueKey] };
  });
  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const firstChartPoint = chartPoints[0]!;
  const lastChartPoint = chartPoints.at(-1)!;
  const areaPath = `${linePath} L ${lastChartPoint.x.toFixed(1)} 174 L ${firstChartPoint.x.toFixed(1)} 174 Z`;
  const currentTimeMarker = getCurrentTimeMarker();
  const currentTimeX = 54 + currentTimeMarker.yearProgress * 340;
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = min + (range * (4 - index)) / 4;
    const y = 174 - ((value - min) / range) * 128;

    return { value, y };
  });

  return (
    <div className="rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] p-2 shadow-[0_2px_0_#3b2a14]">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[#607145]">{title}</p>
          <p className="mt-0.5 font-mono text-sm font-black text-[#27351f]">
            {valuePrefix}
            {formatCompactNumber(total)} total · {valuePrefix}
            {formatCompactNumber(mean)} mean
          </p>
        </div>
        <span className="rounded-none border-2 border-[#c9b88a] bg-[#fff8dc] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#5e4a26]">
          CV {volatility.toFixed(1)}%
        </span>
      </div>

      <svg className="h-60 w-full" viewBox="0 0 420 220" role="img" aria-label={`${title} monthly chart`} shapeRendering="crispEdges">
        <rect x="0" y="0" width="420" height="220" fill="#fffdf5" />
        {yTicks.map((tick) => (
          <g key={tick.y}>
            <path d={`M54 ${tick.y.toFixed(1)}H394`} stroke="#d4c39a" strokeDasharray="4 4" strokeWidth="1.5" />
            <text fill="#6c614d" fontFamily="ui-monospace" fontSize="10" fontWeight="700" textAnchor="end" x="48" y={tick.y + 3}>
              {valuePrefix}
              {formatCompactNumber(tick.value)}
            </text>
          </g>
        ))}
        <path d="M54 34V174H398" fill="none" stroke="#3b2a14" strokeWidth="2" />
        <path d={areaPath} fill={fill} stroke="none" />
        <path d={linePath} fill="none" stroke={accent} strokeLinejoin="miter" strokeWidth="4" />
        <path d={`M54 ${174 - ((mean - min) / range) * 128}H398`} stroke="#245c65" strokeDasharray="7 5" strokeWidth="2" />
        <g>
          <path d={`M${currentTimeX.toFixed(1)} 28V174`} stroke="#c3342f" strokeDasharray="6 5" strokeWidth="2" />
          <rect x={currentTimeX - 13} y="203" width="26" height="13" fill="#fffdf5" stroke="#c3342f" strokeWidth="1.5" />
          <text fill="#c3342f" fontFamily="ui-monospace" fontSize="9" fontWeight="900" textAnchor="middle" x={currentTimeX} y="213">
            now
          </text>
        </g>
        {chartPoints.map((point) => (
          <g key={point.label}>
            <rect x={point.x - 4} y={point.y - 4} width="8" height="8" fill={accent} stroke="#3b2a14" strokeWidth="2" />
            <text fill="#5e4a26" fontFamily="ui-monospace" fontSize="9" fontWeight="800" textAnchor="middle" x={point.x} y="194">
              {point.label}
            </text>
          </g>
        ))}
        <g>
          <path d={`M${54 + (peak.month - 1) * (340 / 11)} 28V174`} stroke={accent} strokeDasharray="3 5" strokeWidth="1.5" />
          <text fill={accent} fontFamily="ui-monospace" fontSize="10" fontWeight="900" textAnchor="middle" x={54 + (peak.month - 1) * (340 / 11)} y="22">
            peak {peak.label}
          </text>
        </g>
      </svg>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <EconomicsMetric label="Peak" value={`${peak.label} ${valuePrefix}${formatCompactNumber(peak[valueKey])}`} accent={accent} />
        <EconomicsMetric label="Low" value={`${low.label} ${valuePrefix}${formatCompactNumber(low[valueKey])}`} accent="#245c65" />
        <EconomicsMetric label="Range" value={`${valuePrefix}${formatCompactNumber(peak[valueKey] - low[valueKey])}`} accent="#a8761c" />
        <EconomicsMetric label="Mean" value={`${valuePrefix}${formatCompactNumber(mean)}`} accent="#2f6f4e" />
      </div>
    </div>
  );
}

function getCurrentTimeMarker() {
  const now = new Date();
  const monthIndex = now.getMonth();
  const daysInMonth = new Date(now.getFullYear(), monthIndex + 1, 0).getDate();
  const monthProgress = daysInMonth ? (now.getDate() - 1) / daysInMonth : 0;
  const yearProgress = Math.min(1, Math.max(0, (monthIndex + monthProgress) / 11));

  return { yearProgress };
}

function EconomicsMetric({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-none border-2 border-[#c9b88a] bg-[#fff8dc] px-2 py-1">
      <p className="font-mono text-[9px] font-black uppercase tracking-[0.1em] text-[#607145]">{label}</p>
      <p className="mt-0.5 truncate font-mono text-xs font-black" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function sumEconomicsValues(points: PlanEconomicsPoint[], valueKey: "operatingCostUsd" | "productionValueUsd" | "productionUnits") {
  return points.reduce((total, point) => total + point[valueKey], 0);
}

function PanelTitle({
  icon,
  eyebrow,
  title,
  meta,
}: {
  icon: PixelGlyphName;
  eyebrow: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
        <PixelGlyph name={icon} className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#607145]">{eyebrow}</p>
        <h2 className="truncate font-mono text-base font-black uppercase tracking-[0.08em] text-[#27351f]">
          {title}
        </h2>
        {meta ? <p className="mt-0.5 text-xs text-[#6c614d]">{meta}</p> : null}
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  eyebrow,
  title,
  subtitle,
}: {
  icon: PixelGlyphName;
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-1">
      <PanelTitle icon={icon} eyebrow={eyebrow} title={title} />
      <p className="max-w-2xl text-xs leading-5 text-[#6c614d]">{subtitle}</p>
    </div>
  );
}

function TinyBadge({ label }: { label: string }) {
  return (
    <span className="rounded-none border-2 border-[#c9b88a] bg-[#fff8dc] px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#5e4a26]">
      {label}
    </span>
  );
}

function TagList({ items, emptyLabel, compact = false }: { items: string[]; emptyLabel: string; compact?: boolean }) {
  const displayItems = items.length ? items : [emptyLabel];

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "mt-2" : ""}`}>
      {displayItems.map((item) => (
        <TinyBadge key={item} label={item} />
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

function buildDemoReport(snapshot: InventorySnapshot): FarmIntelligenceReport {
  const outputs = snapshot.plan?.outputs ?? [];
  const baseYear = new Date(snapshot.plan?.currentDate ?? new Date().toISOString()).getUTCFullYear();
  const forecasts = outputs.map((output, index) => {
    const unit = output.category === "livestock" ? "dozen" : output.name.toLowerCase().includes("lettuce") ? "heads" : "lb";
    const baseAmount = output.category === "livestock" ? 18 : output.name.toLowerCase().includes("lettuce") ? 36 : 42 + index * 8;
    const currentYearValue = baseAmount * (output.category === "livestock" ? 6 : 4);

    return {
      outputId: output.id,
      outputName: output.name,
      unit,
      currentYearEstimate: baseAmount,
      monthlyTrend: getMonthlyForecastTrend({
        outputId: output.id,
        outputName: output.name,
        unit,
        currentYearEstimate: baseAmount,
        yearlyTrend: [{ year: baseYear, expectedAmount: baseAmount, lowEstimate: baseAmount * 0.78, highEstimate: baseAmount * 1.18 }],
        revenueTrend: [{ year: baseYear, expectedValueUsd: currentYearValue }],
        confidence: "medium" as const,
        trendSummary: "",
        keyDrivers: [],
      }),
      yearlyTrend: Array.from({ length: 5 }, (_, yearIndex) => {
        const expectedAmount = Math.round((baseAmount * (1 + yearIndex * 0.12 - Math.max(0, yearIndex - 2) * 0.04)) * 10) / 10;

        return {
          year: baseYear + yearIndex,
          expectedAmount,
          lowEstimate: Math.round(expectedAmount * 0.78 * 10) / 10,
          highEstimate: Math.round(expectedAmount * 1.18 * 10) / 10,
        };
      }),
      revenueTrend: Array.from({ length: 5 }, (_, yearIndex) => ({
        year: baseYear + yearIndex,
        expectedValueUsd: Math.round(baseAmount * (output.category === "livestock" ? 6 : 4) * (1 + yearIndex * 0.1)),
      })),
      confidence: "medium" as const,
      trendSummary: "Plan-based estimate using current outputs, timing, and expected harvest cadence.",
      keyDrivers: ["soil improvement", "water timing", "harvest cadence"],
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    planName: snapshot.plan?.name ?? "Demo farm plan",
    executiveSummary:
      "Plan-based preview of likely outputs, improvement ideas, scenarios, and risk diagnostics.",
    productionForecasts: forecasts,
    aiSuggestions: [
      {
        title: "Mulch high-water beds",
        affectedOutputs: outputs.map((output) => output.name).slice(0, 3),
        recommendation: "Add mulch before peak heat to protect soil moisture and reduce watering work.",
        expectedImpact: "Improves summer reliability for thirsty crops.",
        effort: "low",
        cost: "low",
        bestTiming: "Before summer heat",
        confidence: "medium",
      },
      {
        title: "Prepare surplus handling",
        affectedOutputs: outputs.map((output) => output.name).slice(0, 2),
        recommendation: "Set up crates, jars, or swap plans before the largest harvest window arrives.",
        expectedImpact: "Reduces waste when outputs arrive faster than household use.",
        effort: "medium",
        cost: "low",
        bestTiming: "Two weeks before first flush",
        confidence: "medium",
      },
    ],
    scenarioCards: [
      {
        title: "Add drip irrigation",
        change: "Convert high-water beds from hand watering to drip line.",
        expectedUpside: "More consistent production and less weekly labor.",
        tradeoff: "Requires setup time and simple maintenance.",
        affectedMetrics: ["water", "labor", "reliability"],
      },
      {
        title: "Boost compost cycle",
        change: "Reserve finished compost for the highest-yield annual beds.",
        expectedUpside: "Raises soil score and supports stronger second-year yields.",
        tradeoff: "May leave lower-priority beds under-amended.",
        affectedMetrics: ["soil", "reliability"],
      },
    ],
    surplusCalendar: [
      {
        month: "May",
        likelySurplus: ["lettuce"],
        likelyShortage: ["tomatoes"],
        recommendedActions: ["share greens early", "start warm-season harvest supplies"],
      },
      {
        month: "June",
        likelySurplus: ["eggs", "greens"],
        likelyShortage: ["storage space"],
        recommendedActions: ["schedule swaps", "prep wash station"],
      },
      {
        month: "July",
        likelySurplus: ["tomatoes"],
        likelyShortage: ["water buffer"],
        recommendedActions: ["preserve sauce", "mulch beds"],
      },
    ],
    farmHealth: [
      { name: "soil", score: 68, status: "okay", explanation: "Compost and rotation details will sharpen this read." },
      { name: "water", score: 58, status: "okay", explanation: "High-water crops may need summer support." },
      { name: "pestRisk", score: 62, status: "okay", explanation: "Diverse plantings lower risk, but annual beds still need scouting." },
      { name: "labor", score: 55, status: "okay", explanation: "Harvest and watering windows may stack up." },
      { name: "reliability", score: 66, status: "okay", explanation: "Multiple output types improve resilience." },
      { name: "storage", score: 48, status: "weak", explanation: "Preservation capacity is not yet visible in the plan." },
    ],
  };
}

function formatCompactNumber(value: number) {
  if (value >= 1000) {
    return `${Math.round(value / 100) / 10}k`;
  }

  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
