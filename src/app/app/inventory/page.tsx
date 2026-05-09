import { connection } from "next/server";
import {
  getInventorySnapshot,
  type InventoryPlanOutput,
  type InventoryViewItem,
} from "@/lib/inventory";

const categoryLabels: Record<InventoryViewItem["category"], string> = {
  harvest: "Harvest",
  seeds: "Seeds",
  starts: "Starts",
  feed: "Feed",
  amendments: "Soil",
  tools: "Tools",
  preserves: "Preserves",
  livestock: "Livestock",
};

const statusStyles: Record<InventoryViewItem["status"], string> = {
  stocked: "border-[#9bc278] bg-[#eef8df] text-[#335a2d]",
  low: "border-[#efb16b] bg-[#fff1dc] text-[#7a461f]",
  ready: "border-[#68b8c9] bg-[#e4f7f8] text-[#245c65]",
  curing: "border-[#d38aa0] bg-[#fff0f4] text-[#7a3148]",
};

export default async function InventoryPage() {
  await connection();
  const snapshot = await getInventorySnapshot();
  const categoryTotals = getCategoryTotals(snapshot.items);
  const lowItems = snapshot.items.filter((item) => item.status === "low");
  const sellableItems = snapshot.items.filter((item) =>
    ["harvest", "preserves"].includes(item.category),
  );
  const neededItems = snapshot.items
    .filter((item) => item.status === "low" || !["harvest", "preserves"].includes(item.category))
    .sort((left, right) => Number(right.status === "low") - Number(left.status === "low"));

  return (
    <section className="min-h-[calc(100vh-7rem)] overflow-hidden rounded-lg border border-[#d9d2b8] bg-[#fffdf5] text-[#2d2313] shadow-[0_14px_0_rgba(69,89,49,0.08)]">
      <div className="grid gap-4 p-4 xl:grid-cols-[260px_1fr]">
        <aside className="grid content-start gap-4">
          <section className="rounded-md border border-[#d9d2b8] bg-[#fbf4df] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-[#34432b]">Shelves</h2>
              <span className="font-mono text-xs text-[#746850]">{formatShortDate(snapshot.lastUpdated)}</span>
            </div>
            <div className="grid gap-2">
              {categoryTotals.map((category) => (
                <div
                  key={category.name}
                  className="grid grid-cols-[18px_1fr_auto] items-center gap-2 rounded border border-[#e3dac0] bg-[#fffdf5] px-2 py-2"
                >
                  <span className="size-3 rounded-sm" style={{ backgroundColor: category.color }} />
                  <span className="text-sm text-[#5f563f]">{category.label}</span>
                  <span className="font-mono text-xs text-[#2f6f4e]">{category.count}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-[#d9d2b8] bg-[#f2f8e7] p-3">
            <h2 className="text-sm font-bold text-[#34432b]">Low Stock</h2>
            <div className="mt-3 grid gap-2">
              {lowItems.map((item) => (
                <div key={item.id} className="rounded border border-[#dfd2ae] bg-[#fffdf5] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{item.name}</span>
                    <span className="font-mono text-xs text-[#9b5724]">
                      {formatQuantity(item)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#766b55]">{item.location}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <div className="grid min-w-0 gap-4">
          {snapshot.plan ? <PlanOutputPanel plan={snapshot.plan} /> : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <InventoryList title="Produce to Sell" tone="sell" items={sellableItems} />
            <InventoryList title="Need" tone="need" items={neededItems} />
          </div>

          <section className="min-w-0 overflow-hidden rounded-md border border-[#d9d2b8] bg-[#fffaf0]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#d9d2b8] bg-[#edf5df] text-xs font-bold uppercase tracking-[0.08em] text-[#526b3c]">
                    <th className="w-[33%] px-4 py-3">Item</th>
                    <th className="w-[120px] px-4 py-3">Qty</th>
                    <th className="w-[120px] px-4 py-3">Status</th>
                    <th className="w-[150px] px-4 py-3">Location</th>
                    <th className="px-4 py-3">Farm Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eadfca]">
                  {snapshot.items.map((item) => (
                    <tr key={item.id} className="bg-[#fffdf5] transition hover:bg-[#fff7df]">
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <InventoryToken item={item} />
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-bold text-[#2d311f]">{item.name}</h3>
                            <p className="truncate text-xs text-[#77705d]">
                              {categoryLabels[item.category]} from {item.source}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-[#365833]">
                        {formatQuantity(item)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-[#5f563f]">{item.location}</td>
                      <td className="px-4 py-3 text-sm leading-5 text-[#6c614d]">{item.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function PlanOutputPanel({
  plan,
}: {
  plan: NonNullable<Awaited<ReturnType<typeof getInventorySnapshot>>["plan"]>;
}) {
  return (
    <section className="rounded-md border border-[#d9d2b8] bg-[#f6f3dc] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[#34432b]">Latest Plan Output</h2>
          <p className="mt-1 text-xs text-[#746850]">
            {plan.name} · {plan.season} · as of {formatShortDate(plan.currentDate)}
          </p>
        </div>
        <span className="rounded border border-[#8fc3ca] bg-[#e9fbfb] px-2 py-1 font-mono text-xs text-[#245c65]">
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
  return (
    <article className="rounded border border-[#ded5b8] bg-[#fffdf5] p-3">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 size-4 rounded-sm border border-[#cfbea1]"
          style={{ backgroundColor: output.color }}
        />
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-[#2d311f]">{output.name}</h3>
          <p className="mt-1 text-xs text-[#746850]">{output.source}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-[#eadfca] bg-[#fffaf0] p-2">
          <span className="block text-[#7b7058]">Starts</span>
          <span className="font-mono font-semibold text-[#365833]">{formatShortDate(output.startsAt)}</span>
        </div>
        <div className="rounded border border-[#eadfca] bg-[#fffaf0] p-2">
          <span className="block text-[#7b7058]">Cadence</span>
          <span className="font-mono font-semibold text-[#365833]">{output.cadence}</span>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-[#6c614d]">{output.note}</p>
    </article>
  );
}

function InventoryList({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "sell" | "need";
  items: InventoryViewItem[];
}) {
  const headingClass = tone === "sell" ? "bg-[#e4f7f8] text-[#245c65]" : "bg-[#fff1dc] text-[#7a461f]";

  return (
    <section className="rounded-md border border-[#d9d2b8] bg-[#fffaf0]">
      <div className={`border-b border-[#d9d2b8] px-3 py-2 text-sm font-bold ${headingClass}`}>{title}</div>
      <div className="grid gap-2 p-3">
        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded border border-[#eadfca] bg-[#fffdf5] p-2">
            <InventoryToken item={item} compact />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{item.name}</h3>
              <p className="truncate text-xs text-[#746850]">{item.location}</p>
            </div>
            <div className="text-right">
              <span className="block font-mono text-sm font-semibold text-[#365833]">{formatQuantity(item)}</span>
              <span className="mt-1 block">
                <StatusBadge status={item.status} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function InventoryToken({ item, compact = false }: { item: InventoryViewItem; compact?: boolean }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded border border-[#cfbea1] text-xs font-black text-white shadow-[inset_0_-4px_0_rgba(0,0,0,0.12)] ${
        compact ? "size-8" : "size-10"
      }`}
      style={{ backgroundColor: item.color }}
    >
      {categoryLabels[item.category].slice(0, 2)}
    </span>
  );
}

function StatusBadge({ status }: { status: InventoryViewItem["status"] }) {
  return (
    <span className={`rounded border px-2 py-1 text-xs font-semibold ${statusStyles[status]}`}>
      {status}
    </span>
  );
}

function getCategoryTotals(items: InventoryViewItem[]) {
  const colorByCategory = new Map<InventoryViewItem["category"], string>();
  const counts = new Map<InventoryViewItem["category"], number>();

  for (const item of items) {
    colorByCategory.set(item.category, item.color);
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([name, count]) => ({
    name,
    label: categoryLabels[name],
    count,
    color: colorByCategory.get(name) ?? "#6f8f55",
  }));
}

function formatQuantity(item: InventoryViewItem) {
  return `${item.quantity.amount.toLocaleString("en-US", {
    maximumFractionDigits: 1,
  })} ${item.quantity.unit}`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
