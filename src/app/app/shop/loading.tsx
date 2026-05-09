import {
  PixelSkeleton,
  PixelSkeletonCard,
  PixelSkeletonHero,
  PixelSkeletonPanel,
} from "../_components/skeleton";

export default function ShopLoading() {
  return (
    <section className="min-h-[calc(100vh-7rem)] text-[#2d2313]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        <PixelSkeletonPanel>
          <div
            aria-hidden
            className="h-3 border-b-2 border-[#3b2a14]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, #c1492f 0 16px, #fffdf5 16px 32px)",
            }}
          />
          <PixelSkeletonHero glyph="wagon" title="Farm Stand" subtitle="Loading market shelf" />
          <div className="pixel-dots min-h-[420px] bg-[#fcf6e4] p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <PixelSkeletonCard key={index} rows={2} withMedia mediaHeight="h-32" />
              ))}
            </div>
          </div>
          <div className="border-t-2 border-[#3b2a14] bg-[linear-gradient(to_bottom,#a8916a_0_4px,#8b6f3e_4px_8px,#5e4a26_8px_100%)] py-2 text-center">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#fffdf5] drop-shadow-[1px_1px_0_#3b2a14]">
              Loading…
            </span>
          </div>
        </PixelSkeletonPanel>

        <PixelSkeletonPanel>
          <div className="pixel-gradient-need flex items-center gap-2 border-b-2 border-[#3b2a14] px-3 py-2">
            <PixelSkeleton className="size-7" />
            <div className="grid flex-1 gap-1.5">
              <PixelSkeleton className="h-3.5 w-32" />
              <PixelSkeleton className="h-2.5 w-56" soft />
            </div>
            <PixelSkeleton className="h-6 w-10" soft />
          </div>
          <div className="grid gap-2 bg-[#fcf6e4] p-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <PixelSkeletonCard key={index} rows={1} withMedia mediaHeight="h-24" />
            ))}
          </div>
        </PixelSkeletonPanel>
      </div>
    </section>
  );
}
