const warnings = [
  {
    label: "Weather",
    title: "Heavy rain Thursday may flood Bed 4",
    detail: "Move loose mulch, open the lower drain, and keep fertilizer sealed until the storm clears.",
    time: "2 days",
    tone: "storm",
  },
  {
    label: "Feed",
    title: "Chicken feed is projected to run out",
    detail: "Current bin weight covers roughly 4 days at the last logged ration rate.",
    time: "4 days",
    tone: "supply",
  },
  {
    label: "Disease",
    title: "Squash mildew pressure is high",
    detail: "Three humid nights in a row raise risk around the north trellis and low-airflow leaves.",
    time: "today",
    tone: "crop",
  },
];

const nextActions = [
  {
    action: "Clear Bed 4 drainage channel",
    why: "Prevents standing water around seedlings before rain.",
    when: "Before Thursday",
    effort: "25 min",
  },
  {
    action: "Inspect squash leaf undersides",
    why: "Catches mildew while pruning is still enough.",
    when: "This evening",
    effort: "15 min",
  },
  {
    action: "Order or mill chicken feed",
    why: "Avoids an emergency feed run later in the week.",
    when: "By Sunday",
    effort: "$32 est.",
  },
  {
    action: "Mulch tomatoes after morning watering",
    why: "Cuts evaporation during the next dry spell.",
    when: "Tomorrow",
    effort: "40 min",
  },
];

const sectionGroups = [
  {
    title: "Cost Signals",
    kicker: "Where money is leaking or about to be spent",
    accent: "#e9823a",
    items: [
      "Feed spending is up 18% versus last month.",
      "Tomatoes have high amendment cost with low first harvest.",
      "Compost purchase likely before fall bed prep.",
    ],
  },
  {
    title: "Crop Decisions",
    kicker: "What to plant, replace, rotate, or stop growing",
    accent: "#4e9f5d",
    items: [
      "Replace bolting lettuce with chard, basil, or amaranth.",
      "Rotate tomatoes out of Bed 2 next season.",
      "Plant beans after garlic harvest to rebuild nitrogen.",
    ],
  },
  {
    title: "Animal Needs",
    kicker: "Feed, water, comfort, health, and housing checks",
    accent: "#7067c7",
    items: [
      "Add afternoon shade to the chicken run before the heat bump.",
      "Egg count is down 20% from last week.",
      "Coop bedding is overdue by 3 days.",
    ],
  },
  {
    title: "Inventory & Supplies",
    kicker: "What is low, needed soon, or blocking work",
    accent: "#c9823e",
    items: [
      "Chicken feed is below reorder level.",
      "Mulch is needed for tomato and pepper beds.",
      "Canning jars should be staged before cucumber harvest.",
    ],
  },
  {
    title: "Upcoming Risks",
    kicker: "Problems likely in the next 7 to 14 days",
    accent: "#48b9df",
    items: [
      "Heat wave may raise water demand next week.",
      "Aphid pressure is likely on brassicas.",
      "Zucchini surplus is likely in 5 to 7 days.",
    ],
  },
  {
    title: "Efficiency Suggestions",
    kicker: "Ways to reduce cost, labor, or waste",
    accent: "#f2bd4b",
    items: [
      "Move high-water crops closer to irrigation lines next planting.",
      "Buy feed in bulk if dry storage stays below 60% humidity.",
      "Preserve excess herbs before they flower.",
    ],
  },
];

const toneStyles: Record<string, string> = {
  storm: "border-[#66aec2] bg-[#e8f8f9] text-[#245c65]",
  supply: "border-[#efb16b] bg-[#fff1dc] text-[#7a461f]",
  crop: "border-[#8dbd70] bg-[#edf8de] text-[#335a2d]",
};

export default function IntelligencePage() {
  return (
    <section className="min-h-[calc(100vh-7rem)] overflow-hidden rounded-lg border border-[#d9d2b8] bg-[#fffdf5] text-[#2d2313] shadow-[0_14px_0_rgba(69,89,49,0.08)]">
      <div className="grid gap-4 p-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-md border border-[#d9d2b8] bg-[#fff8dc]">
          <SectionHeader eyebrow="Immediate Warnings" title="Prevent loss, illness, damage, or urgent extra cost" />
          <div className="grid gap-3 p-3">
            {warnings.map((warning) => (
              <article key={warning.title} className="rounded border border-[#dfd2ae] bg-[#fffdf5] p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className={`rounded border px-2 py-1 text-xs font-bold ${toneStyles[warning.tone]}`}>
                      {warning.label}
                    </span>
                    <h3 className="mt-3 text-base font-black text-[#27351f]">{warning.title}</h3>
                  </div>
                  <span className="rounded border border-[#d9d2b8] bg-[#fbf4df] px-2 py-1 font-mono text-xs font-bold text-[#6b5f47]">
                    {warning.time}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#6c614d]">{warning.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-[#d9d2b8] bg-[#edf5df]">
          <SectionHeader eyebrow="What To Do Next" title="Ranked actions with the reason and effort visible" />
          <div className="divide-y divide-[#d9d2b8]">
            {nextActions.map((item, index) => (
              <article key={item.action} className="grid grid-cols-[44px_1fr] gap-3 bg-[#fffdf5] p-3 first:bg-[#fffaf0]">
                <span className="grid size-9 place-items-center rounded border border-[#7fa36a] bg-[#eaf6d8] font-mono text-sm font-black text-[#2f6f4e]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-base font-black text-[#27351f]">{item.action}</h3>
                    <span className="rounded border border-[#d9d2b8] bg-[#fbf4df] px-2 py-1 font-mono text-xs font-bold text-[#6b5f47]">
                      {item.effort}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[#6c614d]">{item.why}</p>
                  <p className="mt-2 text-xs font-bold uppercase tracking-[0.08em] text-[#607145]">{item.when}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

      </div>

      <div className="grid gap-4 px-4 pb-4 md:grid-cols-2 xl:grid-cols-3">
        {sectionGroups.map((section) => (
          <section key={section.title} className="overflow-hidden rounded-md border border-[#d9d2b8] bg-[#fffdf5]">
            <div className="border-b border-[#d9d2b8] bg-[#fbf4df] p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="size-3 rounded-sm border border-[#8f8267]" style={{ backgroundColor: section.accent }} />
                <span className="text-xs font-bold uppercase tracking-[0.1em] text-[#607145]">{section.title}</span>
              </div>
              <h2 className="text-lg font-black leading-tight text-[#27351f]">{section.kicker}</h2>
            </div>
            <div className="grid gap-2 p-3">
              {section.items.map((item) => (
                <div key={item} className="grid grid-cols-[12px_1fr] gap-2 rounded border border-[#eadfca] bg-[#fffaf0] p-2">
                  <span className="mt-2 size-2 rounded-sm" style={{ backgroundColor: section.accent }} />
                  <p className="text-sm leading-6 text-[#655b47]">{item}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="border-b border-[#d9d2b8] p-3">
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#607145]">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black leading-tight text-[#27351f]">{title}</h2>
    </div>
  );
}
