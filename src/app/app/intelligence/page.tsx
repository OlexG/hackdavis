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
      />

      <div className="grid gap-3 p-3">
        {isDemoReport ? (
          <NoticePanel
            tone="empty"
            title="AI intelligence has not been generated yet"
            body="The dashboard is showing a deterministic demo preview from the current plan. Generate AI intelligence to replace it with Gemini-powered forecasts and recommendations."
          />
        ) : null}
        {isStale ? (
          <NoticePanel
            tone="stale"
            title="Inventory changed after this report"
            body="Refresh AI intelligence when you want Gemini to account for the latest inventory quantities and status changes."
          />
        ) : null}

        <ExecutivePanel report={report} canPersist={data.canPersist} isDemoReport={isDemoReport} />
        <ForecastSection forecasts={report.productionForecasts} />

        <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
          <SuggestionsSection report={report} />
          <HealthSection metrics={report.farmHealth} />
        </div>

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
}: {
  planName?: string;
  generatedAt?: string;
  hasReport: boolean;
  hasGeminiKey: boolean;
}) {
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
          <div>
            <h1 className="font-mono text-lg font-black uppercase tracking-[0.18em] text-[#34432b] drop-shadow-[1px_1px_0_#fffdf5]">
              Farm Intelligence
            </h1>
            <p className="text-xs text-[#5e4a26]">
              {planName ? `Gemini forecasts for ${planName}.` : "Gemini forecasts for your farm plan."}
            </p>
            <p className="mt-1 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#607145]">
              {generatedAt ? `Generated ${formatShortDateTime(generatedAt)}` : "Demo preview until AI runs"}
            </p>
          </div>
        </div>
        <IntelligenceGenerateButton hasGeminiKey={hasGeminiKey} hasReport={hasReport} />
      </div>
    </div>
  );
}

function ExecutivePanel({
  report,
  canPersist,
  isDemoReport,
}: {
  report: FarmIntelligenceReport;
  canPersist: boolean;
  isDemoReport: boolean;
}) {
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fff8dc]"
    >
      <div className="pixel-gradient-meadow border-b-2 border-[#a8916a] p-3">
        <PanelTitle
          icon="ledger"
          eyebrow="AI Readout"
          title={isDemoReport ? "Starter preview" : report.planName}
          meta={canPersist ? "Latest report saved to this plan" : "Demo mode without report persistence"}
        />
      </div>
      <div className="grid gap-3 p-3 lg:grid-cols-[1fr_auto]">
        <p className="text-sm leading-6 text-[#5e4a26]">{report.executiveSummary}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          <MiniStat label="Forecasts" value={report.productionForecasts.length.toString()} />
          <MiniStat label="Actions" value={report.aiSuggestions.length.toString()} />
          <MiniStat label="Scenarios" value={report.scenarioCards.length.toString()} />
          <MiniStat label="Health" value={`${averageHealth(report.farmHealth)}%`} />
        </div>
      </div>
    </section>
  );
}

function ForecastSection({ forecasts }: { forecasts: ProductionForecast[] }) {
  return (
    <section className="grid gap-3">
      <SectionHeader
        icon="wheat"
        title="AI Production Forecast"
        subtitle="One Gemini-generated yield and value curve for every output in the current plan."
      />
      {forecasts.length ? (
        <div className="grid gap-3 xl:grid-cols-3">
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
  return (
    <article
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
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
      <div className="grid gap-3 p-3">
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <span className="grid size-14 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] font-mono text-lg font-black text-[#2f6f4e] shadow-[0_2px_0_#3b2a14]">
            {formatCompactNumber(forecast.currentYearEstimate)}
          </span>
          <p className="min-w-0 text-xs leading-5 text-[#5e4a26]">{forecast.trendSummary}</p>
        </div>
        <MiniLineChart
          title="Yield"
          series={forecast.yearlyTrend}
          valueKey="expectedAmount"
          accent="#4e9f5d"
          valuePrefix=""
          valueSuffix={` ${forecast.unit}`}
        />
        <MiniLineChart
          title="Value"
          series={forecast.revenueTrend}
          valueKey="expectedValueUsd"
          accent="#c46a1d"
          valuePrefix="$"
        />
        <TagList items={forecast.keyDrivers} emptyLabel="No drivers returned" />
      </div>
    </article>
  );
}

function SuggestionsSection({ report }: { report: FarmIntelligenceReport }) {
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className="pixel-gradient-sell border-b-2 border-[#a8916a] p-3">
        <PanelTitle icon="sparkle" eyebrow="Gemini Suggestions" title="Next Best Farm Moves" />
      </div>
      <div className="grid gap-2 p-3">
        {report.aiSuggestions.length ? (
          report.aiSuggestions.map((suggestion, index) => (
            <article key={`${suggestion.title}-${index}`} className="rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-mono text-sm font-black uppercase tracking-[0.08em] text-[#27351f]">
                  {suggestion.title}
                </h3>
                <span className={`rounded-none border-2 px-2 py-0.5 font-mono text-[10px] font-black uppercase ${confidenceStyles[suggestion.confidence]}`}>
                  {suggestion.confidence}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[#5e4a26]">{suggestion.recommendation}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[#2f6f4e]">{suggestion.expectedImpact}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <TinyBadge label={`Effort ${suggestion.effort}`} />
                <TinyBadge label={`Cost ${suggestion.cost}`} />
                <TinyBadge label={suggestion.bestTiming} />
              </div>
              <TagList items={suggestion.affectedOutputs} emptyLabel="Whole farm" compact />
            </article>
          ))
        ) : (
          <EmptyPanel title="No AI suggestions" body="Generate a report to get prioritized farm improvements." compact />
        )}
      </div>
    </section>
  );
}

function HealthSection({ metrics }: { metrics: FarmHealthMetric[] }) {
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className="pixel-gradient-need border-b-2 border-[#a8916a] p-3">
        <PanelTitle icon="warning" eyebrow="Farm Health" title="Risk And Resilience" />
      </div>
      <div className="grid gap-2 p-3">
        {metrics.map((metric) => (
          <article key={metric.name} className="rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-mono text-xs font-black uppercase tracking-[0.1em] text-[#27351f]">
                {healthLabels[metric.name]}
              </h3>
              <span className={`rounded-none border-2 px-2 py-0.5 font-mono text-[10px] font-black uppercase ${statusStyles[metric.status]}`}>
                {metric.status}
              </span>
            </div>
            <div className="mt-2 h-4 border-2 border-[#3b2a14] bg-[#fff8dc]">
              <div className="h-full bg-[#4e9f5d]" style={{ width: `${metric.score}%` }} />
            </div>
            <div className="mt-1 flex items-start justify-between gap-3">
              <p className="text-xs leading-5 text-[#5e4a26]">{metric.explanation}</p>
              <span className="font-mono text-sm font-black text-[#2f6f4e]">{metric.score}</span>
            </div>
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
        <PanelTitle icon="sun" eyebrow="Scenario Lab" title="AI What-If Cards" />
      </div>
      <div className="grid gap-2 p-3">
        {report.scenarioCards.length ? (
          report.scenarioCards.map((scenario, index) => (
            <article key={`${scenario.title}-${index}`} className="rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-3">
              <h3 className="font-mono text-sm font-black uppercase tracking-[0.08em] text-[#27351f]">
                {scenario.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#5e4a26]">{scenario.change}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <InfoBlock label="Upside" value={scenario.expectedUpside} />
                <InfoBlock label="Tradeoff" value={scenario.tradeoff} />
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
            <article key={`${month.month}-${index}`} className="grid gap-2 rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-3 sm:grid-cols-[84px_1fr]">
              <h3 className="font-mono text-sm font-black uppercase tracking-[0.08em] text-[#27351f]">
                {month.month}
              </h3>
              <div className="grid gap-2">
                <LabelList label="Surplus" items={month.likelySurplus} />
                <LabelList label="Shortage" items={month.likelyShortage} />
                <LabelList label="Actions" items={month.recommendedActions} />
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

function SectionHeader({ icon, title, subtitle }: { icon: PixelGlyphName; title: string; subtitle: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <PanelTitle icon={icon} eyebrow="Main Forecast" title={title} />
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

function NoticePanel({ title, body, tone }: { title: string; body: string; tone: "empty" | "stale" }) {
  const classes =
    tone === "empty"
      ? "border-[#7eb3bd] bg-[#e9fbfb] text-[#245c65]"
      : "border-[#d8a05a] bg-[#fff1dc] text-[#7a461f]";

  return (
    <div className={`rounded-none border-2 p-3 ${classes}`}>
      <h2 className="font-mono text-xs font-black uppercase tracking-[0.12em]">{title}</h2>
      <p className="mt-1 text-sm leading-5">{body}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] px-3 py-2 text-right shadow-[0_2px_0_#3b2a14]">
      <div className="font-mono text-lg font-black text-[#2f6f4e]">{value}</div>
      <div className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#746850]">{label}</div>
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

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-none border-2 border-[#d4c39a] bg-[#fff8dc] p-2">
      <p className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#607145]">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[#5e4a26]">{value}</p>
    </div>
  );
}

function LabelList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[76px_1fr]">
      <span className="font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#607145]">{label}</span>
      <p className="text-xs leading-5 text-[#5e4a26]">{items.length ? items.join(", ") : "None projected"}</p>
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
      "This preview shows the shape of the AI dashboard before Gemini generates a saved report for the latest farm plan.",
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

function averageHealth(metrics: FarmHealthMetric[]) {
  if (!metrics.length) {
    return 0;
  }

  return Math.round(metrics.reduce((sum, metric) => sum + metric.score, 0) / metrics.length);
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
