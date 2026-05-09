import {
  PixelSkeleton,
  PixelSkeletonCard,
  PixelSkeletonHero,
  PixelSkeletonPanel,
} from "../_components/skeleton";

export default function IntelligenceLoading() {
  return (
    <PixelSkeletonPanel className="min-h-[calc(100vh-7rem)]">
      <PixelSkeletonHero glyph="sparkle" title="Farm Intelligence" subtitle="Reading the leaves" />
      <div className="grid gap-3 p-3">
        <ExecutiveSkeleton />
        <ForecastSkeleton />
        <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
          <SuggestionsSkeleton />
          <HealthSkeleton />
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          <ChartSkeleton tone="meadow" />
          <ChartSkeleton tone="need" />
        </div>
      </div>
    </PixelSkeletonPanel>
  );
}

function ExecutiveSkeleton() {
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fff8dc]"
    >
      <div className="pixel-gradient-meadow border-b-2 border-[#a8916a] p-3">
        <div className="flex items-center gap-3">
          <PixelSkeleton className="size-9" />
          <div className="grid flex-1 gap-1.5">
            <PixelSkeleton className="h-3 w-32" />
            <PixelSkeleton className="h-4 w-56" soft />
          </div>
        </div>
      </div>
      <div className="grid gap-3 p-3 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-1.5">
          <PixelSkeleton className="h-3 w-full" soft />
          <PixelSkeleton className="h-3 w-11/12" soft />
          <PixelSkeleton className="h-3 w-10/12" soft />
          <PixelSkeleton className="h-3 w-3/4" soft />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] px-3 py-2 text-right shadow-[0_2px_0_#3b2a14]"
            >
              <PixelSkeleton className="ml-auto h-5 w-12" />
              <PixelSkeleton className="ml-auto mt-1 h-2.5 w-16" soft />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForecastSkeleton() {
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2">
        <PixelSkeleton className="size-7" />
        <div className="grid gap-1.5">
          <PixelSkeleton className="h-3.5 w-44" />
          <PixelSkeleton className="h-3 w-72" soft />
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <PixelSkeletonCard key={index} rows={3} />
        ))}
      </div>
    </section>
  );
}

function SuggestionsSkeleton() {
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className="pixel-gradient-wood flex items-center gap-2 border-b-2 border-[#a8916a] px-3 py-2">
        <PixelSkeleton className="size-7" />
        <PixelSkeleton className="h-4 w-32" />
      </div>
      <div className="grid gap-2 bg-[#fffaf0] p-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <PixelSkeletonCard key={index} rows={2} />
        ))}
      </div>
    </section>
  );
}

function HealthSkeleton() {
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className="pixel-gradient-meadow flex items-center gap-2 border-b-2 border-[#a8916a] px-3 py-2">
        <PixelSkeleton className="size-7" />
        <PixelSkeleton className="h-4 w-28" />
      </div>
      <div className="grid gap-3 bg-[#fffaf0] p-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <PixelSkeleton className="h-3 w-20" />
              <PixelSkeleton className="h-3 w-10" soft />
            </div>
            <PixelSkeleton className="h-3 w-full" soft />
          </div>
        ))}
      </div>
    </section>
  );
}

function ChartSkeleton({ tone }: { tone: "meadow" | "need" }) {
  const headerClass = tone === "meadow" ? "pixel-gradient-meadow" : "pixel-gradient-need";
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className={`${headerClass} border-b-2 border-[#a8916a] p-3`}>
        <div className="flex items-center gap-3">
          <PixelSkeleton className="size-9" />
          <div className="grid flex-1 gap-1.5">
            <PixelSkeleton className="h-3 w-24" />
            <PixelSkeleton className="h-4 w-56" soft />
          </div>
          <PixelSkeleton className="h-9 w-24" />
        </div>
      </div>
      <div className="p-3">
        <PixelSkeleton className="h-44 w-full" />
      </div>
    </section>
  );
}
