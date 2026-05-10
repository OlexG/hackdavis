import {
  PixelSkeleton,
  PixelSkeletonHero,
  PixelSkeletonPanel,
} from "../_components/skeleton";

export default function SeasonalLoading() {
  return (
    <PixelSkeletonPanel className="min-h-[calc(100vh-7rem)]">
      <PixelSkeletonHero glyph="sun" title="Seasonal" subtitle="Watching the calendar turn" />
      <div className="grid gap-3 p-3">
        <section
          style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
          className="pixel-frame rounded-none border-2 border-[#a8916a] bg-[#fffaf0]"
        >
          <div className="pixel-gradient-wood flex items-center gap-2 border-b-2 border-[#a8916a] px-3 py-2">
            <PixelSkeleton className="size-7" />
            <PixelSkeleton className="h-4 w-44" />
            <PixelSkeleton className="ml-auto h-6 w-24" soft />
          </div>
          <div className="grid grid-cols-7 gap-1 p-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <PixelSkeleton key={`weekday-${index}`} className="h-3 w-12 justify-self-center" />
            ))}
            {Array.from({ length: 35 }).map((_, index) => (
              <PixelSkeleton key={`day-${index}`} className="aspect-square w-full" soft={index % 2 === 0} />
            ))}
          </div>
        </section>
      </div>
    </PixelSkeletonPanel>
  );
}
