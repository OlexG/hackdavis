import {
  PixelSkeleton,
  PixelSkeletonCard,
  PixelSkeletonHero,
  PixelSkeletonPanel,
} from "../_components/skeleton";

export default function SocialLoading() {
  return (
    <PixelSkeletonPanel className="min-h-[calc(100vh-7rem)]">
      <PixelSkeletonHero glyph="basket" title="Neighbors" subtitle="Loading farm community" />
      <div className="grid gap-3 p-3 lg:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            style={{ ["--pixel-frame-bg" as string]: "#fffdf5" }}
            className="pixel-frame grid gap-2 rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-3 shadow-[0_2px_0_#b29c66]"
          >
            <div className="flex items-center gap-2">
              <PixelSkeleton className="size-11" />
              <div className="grid flex-1 gap-1.5">
                <PixelSkeleton className="h-3.5 w-2/3" />
                <PixelSkeleton className="h-2.5 w-1/2" soft />
              </div>
              <PixelSkeleton className="h-6 w-16" soft />
            </div>
            <PixelSkeleton className="h-3 w-full" soft />
            <PixelSkeleton className="h-3 w-11/12" soft />
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((__, mediaIndex) => (
                <PixelSkeletonCard key={mediaIndex} rows={0} withMedia mediaHeight="h-20" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </PixelSkeletonPanel>
  );
}
