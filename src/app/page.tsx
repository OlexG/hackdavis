import { PixelGlyph, SunpatchLogo } from "./app/_components/icons";

const farmSteps = [
  {
    eyebrow: "01",
    glyph: "wheat" as const,
    title: "Sketch your patch",
    text: "Map beds, paths, water barrels, shade, companion plants, and seasonal rotations before you dig.",
  },
  {
    eyebrow: "02",
    glyph: "sparkle" as const,
    title: "Simulate the season",
    text: "Watch sunlight, water, pests, harvest windows, and soil health change as your farm levels up.",
  },
  {
    eyebrow: "03",
    glyph: "wagon" as const,
    title: "Trade the surplus",
    text: "List real produce, find neighbors nearby, and trade baskets when the tomatoes all ripen at once.",
  },
];

const features: { glyph: "wheat" | "sparkle" | "sun" | "leaf" | "basket" | "scroll"; label: string }[] = [
  { glyph: "wheat", label: "Pixel-style farm planner" },
  { glyph: "sparkle", label: "Growing quests and badges" },
  { glyph: "sun", label: "Season and weather simulator" },
  { glyph: "leaf", label: "Seed-to-harvest lessons" },
  { glyph: "basket", label: "Neighborhood produce exchange" },
  { glyph: "scroll", label: "Progress journal for every bed" },
];

const designNotes: { label: string; glyph: "sun" | "leaf" | "sparkle"; value: string }[] = [
  {
    label: "Mood",
    glyph: "sun",
    value: "Solar-punk village, soft indie game UI, warm sunlight, friendly tools.",
  },
  {
    label: "Palette",
    glyph: "leaf",
    value: "Leaf green, tomato red, squash gold, clay brown, sky blue, cream parchment.",
  },
  {
    label: "Visuals",
    glyph: "sparkle",
    value: "Chunky borders, tiny crop tiles, hand-painted landscapes, playful status panels.",
  },
];

const cropTiles = [
  ["Tomato", "#e9503f"],
  ["Kale", "#4e9f5d"],
  ["Corn", "#f2bd4b"],
  ["Berry", "#7067c7"],
  ["Carrot", "#e9823a"],
  ["Herbs", "#7eb56b"],
] as const;

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fbf6e8] text-[#2d2313]">
      <section className="relative min-h-[100svh] overflow-hidden border-b-2 border-[#3b2a14]">
        <div className="hero-sky absolute inset-0" aria-hidden="true">
          <div className="hero-pixel-grid" />
          <div className="hero-pixel-sun" />
          <div className="hero-pixel-cloud hero-pixel-cloud-one" />
          <div className="hero-pixel-cloud hero-pixel-cloud-two" />
          <div className="hero-pixel-cloud hero-pixel-cloud-three" />
          <div className="hero-pixel-cloud hero-pixel-cloud-four" />
          <div className="hero-pixel-cloud hero-pixel-cloud-five" />
          <div className="hero-pixel-spark hero-pixel-spark-one" />
          <div className="hero-pixel-spark hero-pixel-spark-two" />
          <div className="hero-pixel-spark hero-pixel-spark-three" />
          <div className="hero-pixel-horizon" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(32,94,124,0.24),rgba(32,94,124,0.1)_46%,rgba(255,255,255,0)_72%),linear-gradient(0deg,rgba(255,243,207,0.24),rgba(255,243,207,0)_22%)]" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(0deg,#fbf6e8,rgba(255,243,207,0))]" />

        <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a
            href="#top"
            className="inline-flex items-center gap-2 font-mono text-xs font-black uppercase tracking-[0.18em] text-[#fff8dc]"
          >
            <span className="grid size-9 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#ffe89a] text-[#a8761c] shadow-[inset_0_2px_0_rgba(255,255,255,0.6),inset_0_-3px_0_rgba(168,118,28,0.35),0_2px_0_#3b2a14]">
              <SunpatchLogo alt="" className="size-7" priority />
            </span>
            Sunpatch
          </a>
          <div className="hidden items-center gap-4 font-mono text-[11px] font-black uppercase tracking-[0.14em] text-[#fff8dc] md:flex">
            <a href="#planner" className="hover:text-[#ffd36d]">Planner</a>
            <a href="#trade" className="hover:text-[#ffd36d]">Trading</a>
            <a href="#outline" className="hover:text-[#ffd36d]">Design</a>
            <a
              href="/app/farm"
              className="rounded-none border-2 border-[#3b2a14] bg-[#7da854] px-3 py-1.5 text-[#fffdf5] shadow-[0_2px_0_#3b2a14] transition hover:bg-[#9bc278] active:translate-y-0.5 active:shadow-[0_1px_0_#3b2a14]"
            >
              Open app
            </a>
          </div>
        </nav>

        <div
          id="top"
          className="relative z-10 mx-auto flex min-h-[calc(100svh-88px)] w-full max-w-5xl items-center justify-center px-5 pb-24 pt-8 text-center sm:px-8"
        >
          <div className="mx-auto max-w-xl text-[#fff8dc]">
            <HeroEmblem />
            <h1 className="mt-6 font-mono text-3xl font-black uppercase leading-[1.05] tracking-[0.08em] text-[#fff8dc] drop-shadow-[2px_2px_0_#3b2a14] sm:text-5xl lg:text-6xl">
              Plan your farm.
              <br />
              Grow for real.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base font-semibold leading-7 text-[#fff3cf] drop-shadow-[1px_1px_0_rgba(59,42,20,0.6)] sm:text-lg">
              A cozy farm planner for simulating seasons, tracking progress, and trading local harvests.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a
                href="/app/farm"
                className="inline-flex items-center gap-2 rounded-none border-2 border-[#3b2a14] bg-[#ffe89a] px-5 py-2.5 font-mono text-xs font-black uppercase tracking-[0.14em] text-[#5e4a26] shadow-[0_4px_0_#3b2a14] transition hover:-translate-y-0.5 hover:bg-[#fff3cf] active:translate-y-0 active:shadow-[0_2px_0_#3b2a14]"
              >
                <PixelGlyph name="wagon" className="size-4" />
                Open farm
              </a>
              <a
                href="#planner"
                className="inline-flex items-center gap-2 rounded-none border-2 border-[#fff3cf] bg-transparent px-5 py-2.5 font-mono text-xs font-black uppercase tracking-[0.14em] text-[#fff3cf] transition hover:bg-[#fff3cf]/10"
              >
                See how it works
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="planner" className="bg-[#fbf6e8] px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div
            style={{ ["--pixel-frame-bg" as string]: "#fbf6e8" }}
            className="pixel-frame overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] shadow-[0_4px_0_#3b2a14]"
          >
            <div className="pixel-gradient-meadow border-b-2 border-[#3b2a14] p-4">
              <SectionHeader
                eyebrow="Farm Builder"
                title="A cozy planning board for crops, quests, and harvest swaps."
                glyph="wheat"
              />
            </div>
            <div className="grid gap-3 bg-[#fffdf5] p-4 sm:grid-cols-3">
              {farmSteps.map((step) => (
                <article
                  key={step.title}
                  style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
                  className="pixel-frame grid gap-2 rounded-none border-2 border-[#c9b88a] bg-[#fffaf0] p-3 shadow-[0_2px_0_#b29c66]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="grid size-9 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
                      <PixelGlyph name={step.glyph} className="size-5" />
                    </span>
                    <span className="rounded-none border-2 border-[#8b6f3e] bg-[#fff3cf] px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-[0.1em] text-[#7a461f] shadow-[0_2px_0_#5e4a26]">
                      {step.eyebrow}
                    </span>
                  </div>
                  <h3 className="font-mono text-sm font-black uppercase tracking-[0.08em] text-[#27351f]">
                    {step.title}
                  </h3>
                  <p className="text-xs leading-5 text-[#5e4a26]">{step.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div
            style={{ ["--pixel-frame-bg" as string]: "#fbf6e8" }}
            className="pixel-frame overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] shadow-[0_4px_0_#3b2a14]"
          >
            <div className="pixel-gradient-sky border-b-2 border-[#3b2a14] p-3">
              <SectionHeader eyebrow="Sample plot" title="Tile-based crop board" glyph="sparkle" />
            </div>
            <div className="bg-[#fffdf5] p-3">
              <div className="grid grid-cols-3 gap-2 rounded-none border-2 border-[#a8916a] bg-[#7da854] p-3 shadow-[inset_0_2px_0_rgba(255,255,255,0.18),inset_0_-3px_0_rgba(0,0,0,0.18)]">
                {cropTiles.map(([crop, color]) => (
                  <div
                    key={crop}
                    className="aspect-square rounded-none border-2 border-[#3b2a14] bg-[#8f613b] p-1.5 shadow-[0_2px_0_#3b2a14]"
                  >
                    <div className="grid h-full place-items-center rounded-none border-2 border-[#5e4a26] bg-[#a87545]">
                      <span
                        className="grid size-10 place-items-center rounded-none border-2 border-[#3b2a14] font-mono text-[9px] font-black uppercase tracking-[0.04em] text-[#fff8dc] shadow-[inset_0_2px_0_rgba(255,255,255,0.35),inset_0_-3px_0_rgba(0,0,0,0.18)]"
                        style={{ backgroundColor: color }}
                      >
                        {crop}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Stat label="Soil" value="87%" accent="#2f6f4e" />
                <Stat label="Water" value="12L" accent="#245c65" />
                <Stat label="Yield" value="34" accent="#a8761c" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="trade" className="bg-[#fbf6e8] px-5 pb-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div
            style={{ ["--pixel-frame-bg" as string]: "#fbf6e8" }}
            className="pixel-frame overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] shadow-[0_4px_0_#3b2a14]"
          >
            <div className="pixel-gradient-need border-b-2 border-[#3b2a14] p-4">
              <SectionHeader
                eyebrow="Real Produce Marketplace"
                title="Turn game progress into neighbor-to-neighbor abundance."
                glyph="wagon"
              />
            </div>
            <div className="grid gap-4 bg-[#fffdf5] p-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <p className="text-sm leading-6 text-[#5e4a26]">
                Players learn the craft, grow the patch, and trade the harvest when it
                becomes real. The app keeps the loop practical without losing the
                delight of a tiny farm world.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {features.map((feature) => (
                  <div
                    key={feature.label}
                    style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
                    className="pixel-frame flex items-center gap-2 rounded-none border-2 border-[#c9b88a] bg-[#fffaf0] p-2.5 shadow-[0_2px_0_#b29c66]"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] text-[#5e4a26] shadow-[0_1px_0_#3b2a14]">
                      <PixelGlyph name={feature.glyph} className="size-4" />
                    </span>
                    <span className="text-xs font-black leading-tight text-[#2d311f]">
                      {feature.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="outline" className="bg-[#fbf6e8] px-5 pb-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div
            style={{ ["--pixel-frame-bg" as string]: "#fbf6e8" }}
            className="pixel-frame overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] shadow-[0_4px_0_#3b2a14]"
          >
            <div className="pixel-gradient-wood border-b-2 border-[#3b2a14] p-4">
              <SectionHeader
                eyebrow="Design Outline"
                title="Solar-punk warmth with indie game clarity."
                glyph="scroll"
              />
            </div>
            <div className="grid gap-3 bg-[#fffdf5] p-4 lg:grid-cols-3">
              {designNotes.map((note) => (
                <article
                  key={note.label}
                  style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
                  className="pixel-frame grid gap-2 rounded-none border-2 border-[#c9b88a] bg-[#fffaf0] p-4 shadow-[0_2px_0_#b29c66]"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid size-9 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
                      <PixelGlyph name={note.glyph} className="size-5" />
                    </span>
                    <h3 className="font-mono text-xs font-black uppercase tracking-[0.16em] text-[#2f6f4e]">
                      {note.label}
                    </h3>
                  </div>
                  <p className="text-sm leading-6 text-[#5e4a26]">{note.value}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t-2 border-[#3b2a14] bg-[linear-gradient(to_bottom,#a8916a_0_4px,#8b6f3e_4px_8px,#5e4a26_8px_100%)] py-3 text-center">
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#fffdf5] drop-shadow-[1px_1px_0_#3b2a14]">
          ☼ Sunpatch · Plant something good ☼
        </span>
      </footer>
    </main>
  );
}

function HeroEmblem() {
  return (
    <div className="grid place-items-center">
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute -left-6 -top-3 size-2 bg-[#fffdf5]" />
        <span aria-hidden className="pointer-events-none absolute -right-8 top-2 size-1.5 bg-[#ffe89a]" />
        <span aria-hidden className="pointer-events-none absolute -right-4 -bottom-1 size-1 bg-[#fffdf5]" />
        <span className="grid size-32 place-items-center rounded-none border-4 border-[#3b2a14] bg-[#ffe89a] text-[#a8761c] shadow-[inset_0_4px_0_rgba(255,255,255,0.55),inset_0_-8px_0_rgba(168,118,28,0.32),0_4px_0_#3b2a14,0_10px_24px_rgba(39,27,16,0.35)]">
          <PixelGlyph name="sun" className="size-20" />
        </span>
      </div>
      <div className="mt-3 flex h-4 w-32 items-end gap-1">
        {Array.from({ length: 9 }).map((_, index) => (
          <span
            key={index}
            className="flex-1 bg-[#7da854]"
            style={{ height: `${8 + ((index * 5) % 6)}px` }}
          />
        ))}
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  glyph,
}: {
  eyebrow: string;
  title: string;
  glyph: "wheat" | "sparkle" | "wagon" | "scroll" | "leaf" | "sun" | "basket";
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] text-[#5e4a26] shadow-[0_2px_0_#3b2a14]">
        <PixelGlyph name={glyph} className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#5e4a26]">
          {eyebrow}
        </p>
        <h2 className="font-mono text-base font-black uppercase tracking-[0.08em] text-[#27351f] drop-shadow-[1px_1px_0_rgba(255,253,245,0.55)] sm:text-lg">
          {title}
        </h2>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] p-2 shadow-[0_2px_0_#3b2a14]">
      <p className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#7a6843]">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-xl font-black" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}
