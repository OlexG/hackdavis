import {
  PixelSkeleton,
  PixelSkeletonHero,
  PixelSkeletonPanel,
} from "../_components/skeleton";

export default function FarmLoading() {
  return (
    <PixelSkeletonPanel className="min-h-[calc(100vh-7rem)]">
      <PixelSkeletonHero glyph="wheat" title="Farm Planner" subtitle="Tilling the planning canvas" />
      <div className="grid gap-3 p-3 lg:grid-cols-[1fr_280px]">
        <div
          style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
          className="pixel-frame relative overflow-hidden rounded-none border-2 border-[#a8916a] bg-[linear-gradient(45deg,#cfe8de_0_25%,#dceee2_25%_50%,#e7f1d8_50%_75%,#f6f3dc_75%_100%)]"
        >
          <div className="aspect-[4/3] w-full">
            <div className="grid h-full grid-cols-12 gap-px bg-[#a8916a]/20 p-2">
              {Array.from({ length: 96 }).map((_, index) => (
                <PixelSkeleton
                  key={index}
                  className="aspect-square w-full"
                  soft={(index + Math.floor(index / 12)) % 2 === 0}
                />
              ))}
            </div>
          </div>
        </div>
        <aside className="grid gap-2">
          <div
            style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
            className="pixel-frame rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
          >
            <div className="pixel-gradient-wood flex items-center gap-2 border-b-2 border-[#a8916a] px-3 py-2">
              <PixelSkeleton className="size-7" />
              <PixelSkeleton className="h-4 w-28" />
            </div>
            <div className="grid gap-2 p-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-2"
                >
                  <PixelSkeleton className="size-9" />
                  <div className="grid flex-1 gap-1.5">
                    <PixelSkeleton className="h-3.5 w-3/4" />
                    <PixelSkeleton className="h-2.5 w-1/2" soft />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </PixelSkeletonPanel>
  );
}
