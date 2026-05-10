import { connection } from "next/server";
import {
  getFarmIntelligencePageData,
  type FarmHealthMetric,
  type FarmIntelligenceReport,
  type ProductionForecast,
  type RevenueTrendPoint,
  type YearlyTrendPoint,
} from "@/lib/intelligence";
import type { InventorySnapshot } from "@/lib/inventory";
import { PixelGlyph, type PixelGlyphName } from "../_components/icons";
import { IntelligenceGenerateButton } from "./intelligence-actions";

const healthLabels: Record<FarmHealthMetric["name"], string> = {
  soil: "Soil",
  water: "Water",
  pestRisk: "Pest Risk",
  labor: "Labor",
  reliability: "Reliability",
  storage: "Storage",
};

const confidenceStyles = {
  low: "border-[#d8a05a] bg-[#fff1dc] text-[#7a461f]",
  medium: "border-[#7eb3bd] bg-[#e9fbfb] text-[#245c65]",
  high: "border-[#83b86b] bg-[#eef8df] text-[#335a2d]",
};

const statusStyles = {
  weak: "border-[#d38a6a] bg-[#fff0e6] text-[#8a3f2a]",
  okay: "border-[#d8a05a] bg-[#fff4dc] text-[#7a461f]",
  strong: "border-[#83b86b] bg-[#eef8df] text-[#335a2d]",
};

const healthBarColor: Record<FarmHealthMetric["status"], string> = {
  weak: "#c46a1d",
  okay: "#d39a18",
  strong: "#4e9f5d",
};

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
        hasGeminiKey={data.hasGeminiKey}
        isDemoReport={isDemoReport}
        isStale={isStale}
      />

      <div className="grid gap-3 p-3">
        <OverviewPanel
          report={report}
          isDemoReport={isDemoReport}
          isStale={isStale}
        />

        <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
          <SuggestionsSection report={report} />
          <HealthSection metrics={report.farmHealth} />
        </div>

        <ForecastSection forecasts={report.productionForecasts} />

        <div className="grid gap-3 xl:grid-cols-2">
          <ScenarioSection report={report} />
          <SurplusSection report={report} />
        </div>
      </div>
    </section>
  );
}

function IntelligenceHeroBanner({
  planName,
  generatedAt,
  hasReport,
  hasGeminiKey,
  isDemoReport,
  isStale,
}: {
  planName?: string;
  generatedAt?: string;
  hasReport: boolean;
  hasGeminiKey: boolean;
  isDemoReport: boolean;
  isStale: boolean;
}) {
  const statusLabel = isDemoReport ? "Demo preview" : isStale ? "Stale · Inventory changed" : "Saved";
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
              {planName ? `Gemini forecasts for ${planName}.` : "Gemini forecasts for your farm plan."}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className={`rounded-none border-2 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.1em] ${statusTone}`}>
                {statusLabel}
              </span>
              <span className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#607145]">
                {generatedAt ? `Generated ${formatShortDateTime(generatedAt)}` : "Not generated yet"}
              </span>
            </div>
          </div>
        </div>
        <IntelligenceGenerateButton hasGeminiKey={hasGeminiKey} hasReport={hasReport} />
      </div>
    </div>
  );
}

function OverviewPanel({
  report,
  isDemoReport,
  isStale,
}: {
  report: FarmIntelligenceReport;
  isDemoReport: boolean;
  isStale: boolean;
}) {
  const avgHealth = averageHealth(report.farmHealth);
  const noticeTone = isDemoReport
    ? { class: "border-[#7eb3bd] bg-[#e9fbfb] text-[#245c65]", text: "Generate AI intelligence to replace this demo preview with Gemini forecasts." }
    : isStale
      ? { class: "border-[#d8a05a] bg-[#fff1dc] text-[#7a461f]", text: "Inventory changed after this report. Refresh AI intelligence to resync." }
      : null;

  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fff8dc]"
    >
      <div className="pixel-gradient-meadow border-b-2 border-[#a8916a] p-3">
        <PanelTitle icon="scroll" eyebrow="At A Glance" title="Today's Readout" />
      </div>
      <div className="grid gap-3 p-3 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <p className="text-sm leading-6 text-[#5e4a26]">{report.executiveSummary}</p>
          {noticeTone ? (
            <p className={`mt-3 rounded-none border-2 p-2 font-mono text-[11px] font-black uppercase tracking-[0.08em] ${noticeTone.class}`}>
              {noticeTone.text}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          <MiniStat label="Forecasts" value={report.productionForecasts.length} accent="#2f6f4e" />
          <MiniStat label="Actions" value={report.aiSuggestions.length} accent="#a8761c" />
          <MiniStat label="Scenarios" value={report.scenarioCards.length} accent="#245c65" />
          <MiniStat label="Health" value={`${avgHealth}%`} accent={healthAvgAccent(avgHealth)} />
        </div>
      </div>
    </section>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] px-3 py-2 text-right shadow-[0_2px_0_#3b2a14]">
      <div className="font-mono text-xl font-black leading-none" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-1 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#746850]">{label}</div>
    </div>
  );
}

function ForecastSection({ forecasts }: { forecasts: ProductionForecast[] }) {
  return (
    <section className="grid gap-3">
      <SectionHeader
        icon="wheat"
        eyebrow="Yield Forecast"
        title="What This Plan Will Grow"
        subtitle="A five-year yield curve and latest revenue estimate for every output."
      />
      {forecasts.length ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {forecasts.map((forecast) => (
            <ForecastCard key={forecast.outputId} forecast={forecast} />
          ))}
        </div>
      ) : (
        <EmptyPanel title="No production forecasts" body="Generate AI intelligence after creating a farm plan with outputs." />
      )}
    </section>
  );
}

function ForecastCard({ forecast }: { forecast: ProductionForecast }) {
  const latestRevenue = forecast.revenueTrend.at(-1)?.expectedValueUsd ?? 0;

  return (
    <article
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame grid gap-3 overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className="pixel-gradient-meadow border-b-2 border-[#a8916a] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#2f6f4e]">
              {forecast.unit} forecast
            </p>
            <h3 className="truncate font-mono text-sm font-black uppercase tracking-[0.08em] text-[#27351f]">
              {forecast.outputName}
            </h3>
          </div>
          <span
            className={`rounded-none border-2 px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.1em] ${confidenceStyles[forecast.confidence]}`}
          >
            {forecast.confidence}
          </span>
        </div>
      </div>
      <div className="grid gap-3 px-3 pb-3">
        <div className="grid grid-cols-2 gap-2">
          <KpiBlock
            label="This year"
            value={`${formatCompactNumber(forecast.currentYearEstimate)} ${forecast.unit}`}
            accent="#2f6f4e"
          />
          <KpiBlock
            label="Year 5 value"
            value={`$${formatCompactNumber(latestRevenue)}`}
            accent="#a8761c"
          />
        </div>
        <MiniLineChart
          title="Yield curve"
          series={forecast.yearlyTrend}
          valueKey="expectedAmount"
          accent="#4e9f5d"
          valueSuffix={` ${forecast.unit}`}
        />
        <p className="text-xs leading-5 text-[#5e4a26]">{forecast.trendSummary}</p>
        <TagList items={forecast.keyDrivers} emptyLabel="No drivers returned" />
      </div>
    </article>
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

function SuggestionsSection({ report }: { report: FarmIntelligenceReport }) {
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className="pixel-gradient-sell border-b-2 border-[#a8916a] p-3">
        <PanelTitle icon="sparkle" eyebrow="Action Priorities" title="Next Best Moves" />
      </div>
      <div className="grid gap-2 p-3">
        {report.aiSuggestions.length ? (
          report.aiSuggestions.map((suggestion, index) => (
            <article
              key={`${suggestion.title}-${index}`}
              className="rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="min-w-0 font-mono text-sm font-black uppercase tracking-[0.08em] text-[#27351f]">
                  {suggestion.title}
                </h3>
                <span className={`rounded-none border-2 px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.08em] ${confidenceStyles[suggestion.confidence]}`}>
                  {suggestion.confidence}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-5 text-[#5e4a26]">{suggestion.recommendation}</p>
              <p className="mt-1.5 rounded-none border-2 border-[#c5d8a6] bg-[#eef8df] px-2 py-1 font-mono text-[11px] font-black text-[#2f6f4e]">
                ↑ {suggestion.expectedImpact}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <MetaPill icon="warning" label={`Effort ${suggestion.effort}`} />
                <MetaPill icon="jar" label={`Cost ${suggestion.cost}`} />
                <MetaPill icon="sun" label={suggestion.bestTiming} />
              </div>
              {suggestion.affectedOutputs.length ? (
                <TagList items={suggestion.affectedOutputs} emptyLabel="Whole farm" compact />
              ) : null}
            </article>
          ))
        ) : (
          <EmptyPanel title="No AI suggestions" body="Generate a report to get prioritized farm improvements." compact />
        )}
      </div>
    </section>
  );
}

function MetaPill({ icon, label }: { icon: PixelGlyphName; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-none border-2 border-[#c9b88a] bg-[#fff8dc] px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.08em] text-[#5e4a26]">
      <PixelGlyph name={icon} className="size-3" />
      {label}
    </span>
  );
}

function HealthSection({ metrics }: { metrics: FarmHealthMetric[] }) {
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className="pixel-gradient-need border-b-2 border-[#a8916a] p-3">
        <PanelTitle icon="warning" eyebrow="Farm Health" title="Risk & Resilience" />
      </div>
      <div className="grid gap-2 p-3">
        {metrics.map((metric) => (
          <article key={metric.name} className="rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-2.5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-mono text-xs font-black uppercase tracking-[0.1em] text-[#27351f]">
                {healthLabels[metric.name]}
              </h3>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black" style={{ color: healthBarColor[metric.status] }}>
                  {metric.score}
                </span>
                <span className={`rounded-none border-2 px-1.5 py-0.5 font-mono text-[10px] font-black uppercase ${statusStyles[metric.status]}`}>
                  {metric.status}
                </span>
              </div>
            </div>
            <div className="mt-1.5 h-3 border-2 border-[#3b2a14] bg-[#fff8dc]">
              <div
                className="h-full"
                style={{ width: `${metric.score}%`, backgroundColor: healthBarColor[metric.status] }}
              />
            </div>
            <p className="mt-1.5 text-xs leading-5 text-[#5e4a26]">{metric.explanation}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ScenarioSection({ report }: { report: FarmIntelligenceReport }) {
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className="pixel-gradient-meadow border-b-2 border-[#a8916a] p-3">
        <PanelTitle icon="sun" eyebrow="Scenario Lab" title="What If You Try…" />
      </div>
      <div className="grid gap-2 p-3">
        {report.scenarioCards.length ? (
          report.scenarioCards.map((scenario, index) => (
            <article key={`${scenario.title}-${index}`} className="rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-3">
              <h3 className="font-mono text-sm font-black uppercase tracking-[0.08em] text-[#27351f]">
                {scenario.title}
              </h3>
              <p className="mt-1.5 text-sm leading-5 text-[#5e4a26]">{scenario.change}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <InfoBlock label="Upside" value={scenario.expectedUpside} accent="#2f6f4e" />
                <InfoBlock label="Tradeoff" value={scenario.tradeoff} accent="#a8761c" />
              </div>
              <TagList items={scenario.affectedMetrics} emptyLabel="Whole system" compact />
            </article>
          ))
        ) : (
          <EmptyPanel title="No scenarios" body="Generate AI intelligence to compare possible farm upgrades." compact />
        )}
      </div>
    </section>
  );
}

function SurplusSection({ report }: { report: FarmIntelligenceReport }) {
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className="pixel-gradient-wood border-b-2 border-[#a8916a] p-3">
        <PanelTitle icon="basket" eyebrow="Surplus Calendar" title="Harvest Pressure Windows" />
      </div>
      <div className="grid gap-2 p-3">
        {report.surplusCalendar.length ? (
          report.surplusCalendar.map((month, index) => (
            <article
              key={`${month.month}-${index}`}
              className="grid gap-2 rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-3 sm:grid-cols-[68px_1fr]"
            >
              <div className="grid place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] py-2 shadow-[0_2px_0_#3b2a14]">
                <span className="font-mono text-sm font-black uppercase tracking-[0.08em] text-[#27351f]">
                  {month.month}
                </span>
              </div>
              <div className="grid gap-1.5">
                <SurplusRow icon="basket" tone="text-[#2f6f4e]" label="Surplus" items={month.likelySurplus} />
                <SurplusRow icon="warning" tone="text-[#a8761c]" label="Shortage" items={month.likelyShortage} />
                <SurplusRow icon="sparkle" tone="text-[#245c65]" label="Actions" items={month.recommendedActions} />
              </div>
            </article>
          ))
        ) : (
          <EmptyPanel title="No surplus calendar" body="Generate AI intelligence to see preserve, trade, and reorder timing." compact />
        )}
      </div>
    </section>
  );
}

function SurplusRow({
  icon,
  label,
  items,
  tone,
}: {
  icon: PixelGlyphName;
  label: string;
  items: string[];
  tone: string;
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[88px_1fr]">
      <span className={`flex items-center gap-1 font-mono text-[10px] font-black uppercase tracking-[0.1em] ${tone}`}>
        <PixelGlyph name={icon} className="size-3" />
        {label}
      </span>
      <p className="text-xs leading-5 text-[#5e4a26]">{items.length ? items.join(", ") : "None projected"}</p>
    </div>
  );
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

function MiniLineChart<T extends YearlyTrendPoint | RevenueTrendPoint>({
  title,
  series,
  valueKey,
  accent,
  valuePrefix = "",
  valueSuffix = "",
}: {
  title: string;
  series: T[];
  valueKey: keyof T;
  accent: string;
  valuePrefix?: string;
  valueSuffix?: string;
}) {
  const values = series.map((point) => Number(point[valueKey]) || 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = series.map((point, index) => {
    const x = 18 + index * (264 / Math.max(series.length - 1, 1));
    const y = 116 - ((Number(point[valueKey]) - min) / range) * 78;
    return { x, y, year: point.year, value: Number(point[valueKey]) || 0 };
  });
  const polylinePoints = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const latest = points.at(-1)?.value ?? 0;

  return (
    <div className="rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#607145]">{title}</span>
        <span className="font-mono text-xs font-black text-[#27351f]">
          {valuePrefix}
          {formatCompactNumber(latest)}
          {valueSuffix}
        </span>
      </div>
      <svg className="h-32 w-full" viewBox="0 0 300 132" role="img" aria-label={`${title} forecast chart`} shapeRendering="crispEdges">
        <path d="M18 120H286" stroke="#a8916a" strokeWidth="2" />
        <path d="M18 76H286" stroke="#d4c39a" strokeWidth="2" strokeDasharray="4 4" />
        <path d="M18 34H286" stroke="#d4c39a" strokeWidth="2" strokeDasharray="4 4" />
        <polyline fill="none" points={polylinePoints} stroke={accent} strokeLinecap="square" strokeLinejoin="miter" strokeWidth="4" />
        {points.map(({ x, y, year }) => (
          <g key={year}>
            <rect x={x - 4} y={y - 4} width="8" height="8" fill={accent} stroke="#3b2a14" strokeWidth="2" />
            <text fill="#5e4a26" fontFamily="ui-monospace" fontSize="9" fontWeight="700" textAnchor="middle" x={x} y="130">
              {String(year).slice(2)}
            </text>
          </g>
        ))}
      </svg>
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

function InfoBlock({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-none border-2 border-[#d4c39a] bg-[#fff8dc] p-2">
      <p className="font-mono text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: accent }}>
        {label}
      </p>
      <p className="mt-1 text-xs leading-5 text-[#5e4a26]">{value}</p>
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

function averageHealth(metrics: FarmHealthMetric[]) {
  if (!metrics.length) {
    return 0;
  }

  return Math.round(metrics.reduce((sum, metric) => sum + metric.score, 0) / metrics.length);
}

function healthAvgAccent(score: number) {
  if (score >= 70) return "#4e9f5d";
  if (score >= 50) return "#d39a18";
  return "#c46a1d";
}

function buildDemoReport(snapshot: InventorySnapshot): FarmIntelligenceReport {
  const outputs = snapshot.plan?.outputs ?? [];
  const baseYear = new Date(snapshot.plan?.currentDate ?? new Date().toISOString()).getUTCFullYear();
  const forecasts = outputs.map((output, index) => {
    const unit = output.category === "livestock" ? "dozen" : output.name.toLowerCase().includes("lettuce") ? "heads" : "lb";
    const baseAmount = output.category === "livestock" ? 18 : output.name.toLowerCase().includes("lettuce") ? 36 : 42 + index * 8;

    return {
      outputId: output.id,
      outputName: output.name,
      unit,
      currentYearEstimate: baseAmount,
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
      trendSummary: "Demo curve based on the current plan output. Generate AI intelligence for a Gemini-specific forecast.",
      keyDrivers: ["soil improvement", "water timing", "harvest cadence"],
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    planName: snapshot.plan?.name ?? "Demo farm plan",
    executiveSummary:
      "Generate AI intelligence to turn the latest farm plan into full yield forecasts, improvement suggestions, scenario cards, and risk diagnostics.",
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
