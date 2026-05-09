const farmSteps = [
  {
    eyebrow: "01",
    title: "Sketch your patch",
    text: "Map beds, paths, water barrels, shade, companion plants, and seasonal rotations before you dig.",
  },
  {
    eyebrow: "02",
    title: "Simulate the season",
    text: "Watch sunlight, water, pests, harvest windows, and soil health change as your farm levels up.",
  },
  {
    eyebrow: "03",
    title: "Trade the surplus",
    text: "List real produce, find neighbors nearby, and trade baskets when the tomatoes all ripen at once.",
  },
];

const features = [
  "Pixel-style farm planner",
  "Growing quests and badges",
  "Season and weather simulator",
  "Seed-to-harvest lessons",
  "Neighborhood produce exchange",
  "Progress journal for every bed",
];

const designNotes = [
  {
    label: "Mood",
    value: "Solar-punk village, soft indie game UI, warm sunlight, friendly tools.",
  },
  {
    label: "Palette",
    value: "Leaf green, tomato red, squash gold, clay brown, sky blue, cream parchment.",
  },
  {
    label: "Visuals",
    value: "Chunky borders, tiny crop tiles, hand-painted landscapes, playful status panels.",
  },
];

const cropTiles = [
  ["Tomato", "bg-[#e9503f]"],
  ["Kale", "bg-[#4e9f5d]"],
  ["Corn", "bg-[#f2bd4b]"],
  ["Berry", "bg-[#7067c7]"],
  ["Carrot", "bg-[#e9823a]"],
  ["Herbs", "bg-[#7eb56b]"],
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fff3cf] text-[#2d2313]">
      <section className="relative min-h-[100svh] overflow-hidden border-b-2 border-[#5aa06d]">
        <div className="hero-sky absolute inset-0" aria-hidden="true">
          <div className="pixel-sky-grid" />
          <div className="pixel-sun" />
          <div className="pixel-cloud pixel-cloud-one" />
          <div className="pixel-cloud pixel-cloud-two" />
          <div className="pixel-cloud pixel-cloud-three" />
          <div className="pixel-cloud pixel-cloud-four" />
          <div className="pixel-spark pixel-spark-one" />
          <div className="pixel-spark pixel-spark-two" />
          <div className="pixel-spark pixel-spark-three" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(32,94,124,0.24),rgba(32,94,124,0.1)_46%,rgba(255,255,255,0)_72%),linear-gradient(0deg,rgba(255,243,207,0.24),rgba(255,243,207,0)_22%)]" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(0deg,#fff3cf,rgba(255,243,207,0))]" />

        <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <a
            href="#top"
            className="inline-flex items-center gap-3 text-sm font-black uppercase text-[#fff8dc]"
          >
            <span className="grid size-9 place-items-center border-2 border-[#fff8dc] bg-[#2f6f4e] shadow-[0_3px_10px_rgba(45,35,19,0.16)]">
              SP
            </span>
            Sunpatch
          </a>
          <div className="hidden items-center gap-6 text-sm font-bold text-[#fff8dc] md:flex">
            <a href="#planner" className="hover:text-[#ffd36d]">
              Planner
            </a>
            <a href="#trade" className="hover:text-[#ffd36d]">
              Trading
            </a>
            <a href="#outline" className="hover:text-[#ffd36d]">
              Design
            </a>
            <a href="/app/farm" className="hover:text-[#ffd36d]">
              Open app
            </a>
          </div>
        </nav>

        <div
          id="top"
          className="relative z-10 mx-auto flex min-h-[calc(100svh-88px)] w-full max-w-7xl items-center px-5 pb-20 pt-12 sm:px-8"
        >
          <div className="max-w-3xl text-[#fff8dc]">
            <p className="mb-5 inline-flex border-2 border-[#fff8dc] bg-[rgba(47,111,78,0.86)] px-3 py-2 text-xs font-black uppercase shadow-[0_4px_16px_rgba(45,35,19,0.14)]">
              Grow a farm before you grow the food
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-[1.02] text-[#fff8dc] drop-shadow-[0_2px_14px_rgba(39,27,16,0.28)] sm:text-6xl lg:text-7xl">
              Plan, learn, simulate, and trade from your own living farm.
            </h1>
            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-[#fff3cf] sm:text-xl">
              Sunpatch turns backyard dreams into a warm indie farming game:
              design your beds, practice the season, track progress, then swap
              real fruits and vegetables with your local community.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="/app/farm"
                className="inline-flex min-h-12 items-center justify-center border-2 border-[#2d2313] bg-[#f2bd4b] px-6 text-sm font-black uppercase text-[#2d2313] shadow-[0_5px_18px_rgba(45,35,19,0.18)] transition hover:-translate-y-1"
              >
                Open farm console
              </a>
              <a
                href="#outline"
                className="inline-flex min-h-12 items-center justify-center border-2 border-[#fff8dc] bg-[#fff8dc] px-6 text-sm font-black uppercase text-[#2d2313] shadow-[0_5px_18px_rgba(45,35,19,0.14)] transition hover:-translate-y-1"
              >
                View design outline
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="planner" className="bg-[#fff3cf] px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.8fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase text-[#2f6f4e]">
              Farm builder
            </p>
            <h2 className="mt-3 max-w-2xl text-4xl font-black leading-tight text-[#2d2313] sm:text-5xl">
              A cozy planning board for crops, quests, and neighborhood
              harvests.
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {farmSteps.map((step) => (
                <article
                  key={step.title}
                  className="border-2 border-[#2d2313] bg-[#fff8dc] p-5 shadow-[0_8px_22px_rgba(123,82,42,0.12)]"
                >
                  <p className="text-sm font-black text-[#d84933]">
                    {step.eyebrow}
                  </p>
                  <h3 className="mt-3 text-xl font-black">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#5f4b2c]">
                    {step.text}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className="border-2 border-[#2d2313] bg-[#80bd7b] p-4 shadow-[0_12px_28px_rgba(45,35,19,0.14)]">
            <div className="grid grid-cols-3 gap-3 border-2 border-[#2d2313] bg-[#7ab16f] p-3">
              {cropTiles.map(([crop, color]) => (
                <div
                  key={crop}
                  className="aspect-square border-2 border-[#2d2313] bg-[#c98852] p-2 shadow-[0_4px_12px_rgba(45,35,19,0.14)]"
                >
                  <div className="grid h-full place-items-center bg-[#8f613b]">
                    <span
                      className={`grid size-12 place-items-center border-2 border-[#2d2313] ${color} text-[10px] font-black uppercase text-[#fff8dc]`}
                    >
                      {crop}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <Stat label="Soil" value="87%" />
              <Stat label="Water" value="12L" />
              <Stat label="Yield" value="34" />
            </div>
          </div>
        </div>
      </section>

      <section
        id="trade"
        className="bg-[#315f4a] px-5 py-16 text-[#fff8dc] sm:px-8"
      >
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1fr] lg:items-start">
          <div>
            <p className="text-sm font-black uppercase text-[#ffd36d]">
              Real produce marketplace
            </p>
            <h2 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">
              Turn game progress into neighbor-to-neighbor abundance.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#f5e9bc]">
              Players learn the craft, grow the patch, and trade the harvest
              when it becomes real. The app keeps the loop practical without
              losing the delight of a tiny farm world.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature}
                className="border-2 border-[#fff3cf] bg-[#fff3cf] px-4 py-4 text-base font-black text-[#2d2313] shadow-[0_6px_16px_rgba(27,51,40,0.16)]"
              >
                {feature}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="outline" className="bg-[#f6c765] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase text-[#8a3c2f]">
              Design outline
            </p>
            <h2 className="mt-3 text-4xl font-black leading-tight text-[#2d2313] sm:text-5xl">
              Solar-punk warmth with indie game clarity.
            </h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {designNotes.map((note) => (
              <article
                key={note.label}
                className="border-2 border-[#2d2313] bg-[#fff8dc] p-6 shadow-[0_8px_20px_rgba(139,60,47,0.12)]"
              >
                <h3 className="text-lg font-black uppercase text-[#2f6f4e]">
                  {note.label}
                </h3>
                <p className="mt-4 text-base leading-7 text-[#5f4b2c]">
                  {note.value}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-[#2d2313] bg-[#fff8dc] p-3">
      <p className="text-xs font-black uppercase text-[#2f6f4e]">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
