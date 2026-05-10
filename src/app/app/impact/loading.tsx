import {
  PixelSkeleton,
  PixelSkeletonHero,
  PixelSkeletonPanel,
} from "../_components/skeleton";

export default function ImpactLoading() {
  return (
    <PixelSkeletonPanel className="min-h-[calc(100vh-7rem)]">
      <PixelSkeletonHero glyph="leaf" title="Impact" subtitle="Tallying the harvest legacy" />
      <div className="grid gap-3 p-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
              className="pixel-frame rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] p-3 text-center shadow-[0_2px_0_#3b2a14]"
            >
              <PixelSkeleton className="mx-auto h-7 w-20" />
              <PixelSkeleton className="mx-auto mt-1.5 h-3 w-24" soft />
            </div>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <section
              key={index}
              style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
              className="pixel-frame rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
            >
              <div className="pixel-gradient-meadow flex items-center gap-2 border-b-2 border-[#a8916a] px-3 py-2">
                <PixelSkeleton className="size-7" />
                <PixelSkeleton className="h-4 w-40" />
              </div>
              <div className="p-3">
                <PixelSkeleton className="h-44 w-full" />
              </div>
            </section>
          ))}
        </div>
      </div>
    </PixelSkeletonPanel>
  );
}
