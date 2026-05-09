import {
  PixelSkeleton,
  PixelSkeletonCard,
  PixelSkeletonHero,
  PixelSkeletonPanel,
} from "../_components/skeleton";

export default function InventoryLoading() {
  return (
    <PixelSkeletonPanel className="min-h-[calc(100vh-7rem)]">
      <PixelSkeletonHero glyph="basket" title="Farmhouse Pantry" subtitle="Loading inventory" />
      <div className="grid gap-3 p-3">
        <PlanSkeleton />
        <div className="grid gap-3 lg:grid-cols-2">
          <ColumnSkeleton tone="sell" />
          <ColumnSkeleton tone="need" />
        </div>
        <LedgerSkeleton />
      </div>
    </PixelSkeletonPanel>
  );
}

function PlanSkeleton() {
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame rounded-none border-2 border-[#a8916a] bg-[#f6f3dc] p-2"
    >
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <PixelSkeleton className="size-7" />
          <div className="grid gap-1.5">
            <PixelSkeleton className="h-3.5 w-40" />
            <PixelSkeleton className="h-3 w-56" soft />
          </div>
        </div>
        <PixelSkeleton className="h-6 w-24" soft />
      </div>
      <div className="grid gap-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <PixelSkeletonCard key={index} notch="#f6f3dc" rows={1} />
        ))}
      </div>
    </section>
  );
}

function ColumnSkeleton({ tone }: { tone: "sell" | "need" }) {
  const headerClass = tone === "sell" ? "pixel-gradient-sell" : "pixel-gradient-need";
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className={`${headerClass} flex items-center gap-2 border-b-2 border-[#a8916a] px-3 py-2`}>
        <PixelSkeleton className="size-7" />
        <div className="grid flex-1 gap-1.5">
          <PixelSkeleton className="h-3 w-32" />
          <PixelSkeleton className="h-2.5 w-44" soft />
        </div>
        <PixelSkeleton className="h-6 w-8" soft />
      </div>
      <div className="grid gap-1.5 bg-[#fcf6e4] p-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <PixelSkeletonCard key={index} rows={1} />
        ))}
      </div>
    </section>
  );
}

function LedgerSkeleton() {
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
      className="pixel-frame min-w-0 overflow-hidden rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
    >
      <div className="pixel-gradient-wood flex items-center gap-2 border-b-2 border-[#a8916a] px-3 py-2">
        <PixelSkeleton className="size-7" />
        <PixelSkeleton className="h-4 w-40" />
        <PixelSkeleton className="ml-auto h-6 w-20" soft />
      </div>
      <div className="grid gap-0.5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 bg-[#fffdf5] px-3 py-2">
            <PixelSkeleton className="size-8" />
            <PixelSkeleton className="h-4 w-44" />
            <PixelSkeleton className="ml-auto h-4 w-16" soft />
            <PixelSkeleton className="h-4 w-20" soft />
            <PixelSkeleton className="h-4 w-24" soft />
            <PixelSkeleton className="h-4 w-32" soft />
          </div>
        ))}
      </div>
    </section>
  );
}
