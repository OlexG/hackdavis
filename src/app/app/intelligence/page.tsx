import Image from "next/image";
import { connection } from "next/server";
import { getInventorySnapshot, type InventoryPlanOutput } from "@/lib/inventory";

type CalendarDay = {
  date: Date;
  key: string;
  day: number;
  isCurrentMonth: boolean;
  outputs: InventoryPlanOutput[];
};

const incomeSeries = [
  { label: "Jan", value: 86 },
  { label: "Feb", value: 112 },
  { label: "Mar", value: 184 },
  { label: "Apr", value: 226 },
  { label: "May", value: 318 },
  { label: "Jun", value: 372 },
];

const spendingSeries = [
  { label: "Jan", value: 142 },
  { label: "Feb", value: 128 },
  { label: "Mar", value: 196 },
  { label: "Apr", value: 244 },
  { label: "May", value: 211 },
  { label: "Jun", value: 236 },
];

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function IntelligencePage() {
  await connection();
  const snapshot = await getInventorySnapshot();
  const plan = snapshot.plan;
  const calendarAnchor = plan?.outputs[0]?.startsAt ?? plan?.currentDate ?? new Date().toISOString();
  const calendarDays = buildCalendarDays(calendarAnchor, plan?.outputs ?? []);

  return (
    <section className="min-h-[calc(100vh-7rem)] overflow-hidden rounded-lg border border-[#d9d2b8] bg-[#fffdf5] text-[#2d2313] shadow-[0_14px_0_rgba(69,89,49,0.08)]">
      <div className="p-4">
        <CalendarPanel plan={plan} days={calendarDays} />
      </div>

      <div className="grid gap-4 px-4 pb-4 xl:grid-cols-2">
        <MoneyChart
          title="Money Made"
          subtitle="Produce swaps, farmstand, and preserved goods"
          total={incomeSeries.reduce((sum, point) => sum + point.value, 0)}
          series={incomeSeries}
          accent="#4e9f5d"
        />
        <MoneyChart
          title="Money Spent"
          subtitle="Feed, seed, soil, water, repairs, and supplies"
          total={spendingSeries.reduce((sum, point) => sum + point.value, 0)}
          series={spendingSeries}
          accent="#e9823a"
        />
      </div>
    </section>
  );
}

function CalendarPanel({
  plan,
  days,
}: {
  plan: Awaited<ReturnType<typeof getInventorySnapshot>>["plan"];
  days: CalendarDay[];
}) {
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(days.find((day) => day.isCurrentMonth)?.date ?? new Date());
  const outputs = plan?.outputs ?? [];

  return (
    <section className="overflow-hidden rounded-md border border-[#d9d2b8] bg-[#fff8dc]">
      <div className="border-b border-[#d9d2b8] bg-[#fbf4df] p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#607145]">Farm Calendar</p>
            <h2 className="mt-1 text-xl font-black leading-tight text-[#27351f]">{monthLabel} harvest board</h2>
            <p className="mt-1 text-sm leading-6 text-[#6c614d]">
              {plan
                ? `${plan.name} projections from the latest plan output.`
                : "Demo projections shown until a farm plan exists."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CalendarStat label="Plan" value={plan?.season ?? "demo"} />
            <CalendarStat label="Drops" value={outputs.length.toString()} />
          </div>
        </div>
      </div>

      <div className="grid gap-3 p-3 lg:grid-cols-[1fr_220px]">
        <div className="rounded border border-[#d9d2b8] bg-[#fffdf5] p-2">
          <div className="grid grid-cols-7 gap-1 pb-2">
            {weekdays.map((weekday) => (
              <div key={weekday} className="text-center text-xs font-black uppercase tracking-[0.08em] text-[#607145]">
                {weekday}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => (
              <CalendarCell key={day.key} day={day} />
            ))}
          </div>
        </div>

        <aside className="grid content-start gap-2">
          <h3 className="text-xs font-black uppercase tracking-[0.1em] text-[#607145]">Next Drops</h3>
          {outputs.slice(0, 4).map((output) => (
            <article key={output.id} className="grid grid-cols-[auto_1fr] gap-2 rounded border border-[#eadfca] bg-[#fffdf5] p-2">
              <PixelIconSlot src={iconForOutput(output)} label={output.name} color={output.color} compact />
              <div className="min-w-0">
                <h4 className="truncate text-sm font-black text-[#27351f]">{output.name}</h4>
                <p className="font-mono text-xs font-bold text-[#2f6f4e]">{formatShortDate(output.startsAt)}</p>
                <p className="truncate text-xs text-[#746850]">{output.cadence}</p>
              </div>
            </article>
          ))}
        </aside>
      </div>
    </section>
  );
}

function CalendarCell({ day }: { day: CalendarDay }) {
  return (
    <div
      className={`min-h-20 rounded border p-1.5 ${
        day.isCurrentMonth
          ? "border-[#ded5b8] bg-[#fffaf0]"
          : "border-[#eee5ce] bg-[#fbf4df] text-[#a3987e]"
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-xs font-black">{day.day}</span>
        {day.outputs.length ? (
          <span className="rounded border border-[#8fc3ca] bg-[#e9fbfb] px-1 font-mono text-[10px] font-black text-[#245c65]">
            +{day.outputs.length}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {day.outputs.slice(0, 3).map((output) => (
          <PixelIconSlot key={output.id} src={iconForOutput(output)} label={output.name} color={output.color} tiny />
        ))}
      </div>
    </div>
  );
}


function MoneyChart({
  title,
  subtitle,
  total,
  series,
  accent,
}: {
  title: string;
  subtitle: string;
  total: number;
  series: { label: string; value: number }[];
  accent: string;
}) {
  const max = Math.max(...series.map((point) => point.value), 1);
  const points = series
    .map((point, index) => {
      const x = 24 + index * (252 / Math.max(series.length - 1, 1));
      const y = 128 - (point.value / max) * 92;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <section className="overflow-hidden rounded-md border border-[#d9d2b8] bg-[#fffaf0]">
      <div className="border-b border-[#d9d2b8] bg-[#fbf4df] p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#607145]">{title}</p>
            <h2 className="mt-1 text-lg font-black leading-tight text-[#27351f]">{subtitle}</h2>
          </div>
          <span className="font-mono text-2xl font-black text-[#27351f]">${total.toLocaleString("en-US")}</span>
        </div>
      </div>
      <div className="p-3">
        <svg className="h-44 w-full" viewBox="0 0 300 160" role="img" aria-label={`${title} chart`}>
          <path d="M24 132H286" stroke="#d9d2b8" strokeWidth="2" />
          <path d="M24 84H286" stroke="#eadfca" strokeWidth="1" strokeDasharray="4 5" />
          <path d="M24 36H286" stroke="#eadfca" strokeWidth="1" strokeDasharray="4 5" />
          <polyline fill="none" points={points} stroke={accent} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
          {series.map((point, index) => {
            const x = 24 + index * (252 / Math.max(series.length - 1, 1));
            const y = 128 - (point.value / max) * 92;

            return (
              <g key={point.label}>
                <circle cx={x} cy={y} fill="#fffdf5" r="5" stroke={accent} strokeWidth="3" />
                <text fill="#6b5f47" fontSize="10" fontWeight="700" textAnchor="middle" x={x} y="150">
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function PixelIconSlot({
  src,
  label,
  color = "#fff8dc",
  compact = false,
  tiny = false,
}: {
  src: string;
  label: string;
  color?: string;
  compact?: boolean;
  tiny?: boolean;
}) {
  const sizeClass = tiny ? "size-7" : compact ? "size-8" : "size-10";
  const iconClass = tiny ? "size-4" : compact ? "size-5" : "size-7";

  return (
    <span
      className={`grid shrink-0 place-items-center rounded border border-[#cfbea1] shadow-[inset_0_-4px_0_rgba(95,80,43,0.12)] ${sizeClass}`}
      style={{ backgroundColor: color }}
    >
      <Image
        src={src}
        alt={`${label} icon`}
        width={16}
        height={16}
        className={iconClass}
        style={{ imageRendering: "pixelated" }}
        unoptimized
      />
    </span>
  );
}

function CalendarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#d9d2b8] bg-[#fffdf5] px-3 py-2 text-right">
      <div className="font-mono text-lg font-black text-[#2f6f4e]">{value}</div>
      <div className="text-[10px] font-black uppercase tracking-[0.1em] text-[#746850]">{label}</div>
    </div>
  );
}

function buildCalendarDays(anchorValue: string, outputs: InventoryPlanOutput[]) {
  const anchor = new Date(anchorValue);
  const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const gridStart = new Date(monthStart);
  gridStart.setUTCDate(monthStart.getUTCDate() - monthStart.getUTCDay());

  return Array.from({ length: 35 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    const key = toDateKey(date);

    return {
      date,
      key,
      day: date.getUTCDate(),
      isCurrentMonth: date.getUTCMonth() === monthStart.getUTCMonth(),
      outputs: outputs.filter((output) => outputOccursOnDate(output, date)),
    };
  });
}

function outputOccursOnDate(output: InventoryPlanOutput, date: Date) {
  const startDate = startOfUtcDay(new Date(output.startsAt));
  const currentDate = startOfUtcDay(date);

  if (currentDate < startDate) {
    return false;
  }

  const endDate = output.endsAt ? startOfUtcDay(new Date(output.endsAt)) : undefined;

  if (endDate && currentDate > endDate) {
    return false;
  }

  if (output.cadence === "daily") {
    return true;
  }

  if (output.cadence === "weekly flush") {
    return daysBetween(startDate, currentDate) % 7 === 0;
  }

  return toDateKey(startDate) === toDateKey(currentDate);
}

function iconForOutput(output: InventoryPlanOutput) {
  const name = `${output.name} ${output.source}`.toLowerCase();

  if (name.includes("tomato")) {
    return "/inventory-icons/tomato.png";
  }

  if (name.includes("lettuce")) {
    return "/inventory-icons/lettuce.png";
  }

  if (name.includes("egg") || output.category === "livestock") {
    return "/inventory-icons/egg.png";
  }

  return output.category === "produce" ? "/inventory-icons/pea-pod.png" : "/inventory-icons/corn.png";
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetween(startDate: Date, endDate: Date) {
  return Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000);
}
