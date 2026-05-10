import {
  PixelSkeleton,
  PixelSkeletonHero,
  PixelSkeletonPanel,
} from "../_components/skeleton";

export default function SocialLoading() {
  return (
    <section className="min-h-[calc(100vh-7rem)] text-[#2d2313]">
      <div className="mx-auto w-full max-w-6xl">
        <PixelSkeletonPanel>
          <PixelSkeletonHero glyph="basket" title="Top farms nearby" subtitle="Loading farm cards" />
          <div className="grid gap-3 bg-[#fcf6e4] p-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <SocialFarmCardSkeleton key={index} />
            ))}
          </div>
        </PixelSkeletonPanel>
      </div>
    </section>
  );
}

function SocialFarmCardSkeleton() {
  return (
    <article
      style={{ ["--pixel-frame-bg" as string]: "#fcf6e4" }}
      className="pixel-frame grid gap-2 rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-3 shadow-[0_2px_0_#b29c66]"
    >
      <div className="flex items-start gap-3">
        <PixelSkeleton className="size-12 shrink-0" />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <PixelSkeleton className="h-4 w-36" />
            <PixelSkeleton className="h-5 w-16" soft />
          </div>
          <PixelSkeleton className="h-3 w-full" soft />
          <PixelSkeleton className="h-3 w-5/6" soft />
        </div>
        <PixelSkeleton className="h-8 w-14 shrink-0" />
      </div>

      <div className="rounded-none border-2 border-[#e1d0a8] bg-[#fffaf0] px-2 py-2">
        <PixelSkeleton className="h-3 w-full" soft />
        <PixelSkeleton className="mt-1.5 h-3 w-2/3" soft />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {Array.from({ length: 3 }).map((_, index) => (
          <PixelSkeleton key={index} className="h-16 w-full" soft={index % 2 === 0} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <PixelSkeleton className="h-5 w-14" soft />
          <PixelSkeleton className="h-5 w-16" soft />
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <PixelSkeleton key={index} className="size-6" soft />
          ))}
        </div>
      </div>
    </article>
  );
}
