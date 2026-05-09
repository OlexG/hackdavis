import type { ReactNode } from "react";
import { PixelGlyph, type PixelGlyphName } from "./icons";

export function PixelSkeleton({
  className = "",
  soft = false,
}: {
  className?: string;
  soft?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={`block rounded-none ${soft ? "pixel-skeleton-soft" : "pixel-skeleton"} ${className}`}
    />
  );
}

export function PixelSkeletonPanel({
  children,
  notch = "#fbf6e8",
  className = "",
}: {
  children: ReactNode;
  notch?: string;
  className?: string;
}) {
  return (
    <section
      style={{ ["--pixel-frame-bg" as string]: notch }}
      className={`pixel-frame overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] shadow-[0_4px_0_#3b2a14] ${className}`}
    >
      {children}
    </section>
  );
}

export function PixelSkeletonHero({
  glyph,
  title,
  subtitle,
}: {
  glyph: PixelGlyphName;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      role="status"
      aria-label={`Loading ${title}`}
      className="pixel-gradient-sky relative overflow-hidden border-b-2 border-[#3b2a14] px-4 py-4"
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-3 items-end gap-1 px-3 opacity-70">
        {Array.from({ length: 32 }).map((_, index) => (
          <span
            key={index}
            className="h-2 flex-1 bg-[#7da854]"
            style={{ height: `${6 + ((index * 7) % 6)}px` }}
          />
        ))}
      </div>
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] text-[#a8761c] shadow-[inset_0_2px_0_rgba(255,255,255,0.6),inset_0_-4px_0_rgba(168,118,28,0.32),0_2px_0_#3b2a14]">
            <PixelGlyph name={glyph} className="size-6" />
          </span>
          <div className="grid gap-1.5">
            <PixelSkeleton className="h-4 w-44" />
            <PixelSkeleton className="h-3 w-60" soft />
          </div>
        </div>
        <PixelSkeleton className="h-7 w-32" />
      </div>
      <span className="sr-only">Loading {title} — {subtitle}</span>
    </div>
  );
}

export function PixelSkeletonCard({
  notch = "#fcf6e4",
  rows = 3,
  withMedia = false,
  mediaHeight = "h-24",
}: {
  notch?: string;
  rows?: number;
  withMedia?: boolean;
  mediaHeight?: string;
}) {
  return (
    <div
      style={{ ["--pixel-frame-bg" as string]: notch }}
      className="pixel-frame grid gap-2 rounded-none border-2 border-[#c9b88a] bg-[#fffdf5] p-2.5 shadow-[0_2px_0_#b29c66]"
    >
      {withMedia ? <PixelSkeleton className={`w-full ${mediaHeight}`} /> : null}
      <div className="flex items-center gap-2">
        <PixelSkeleton className="size-9" />
        <div className="grid flex-1 gap-1.5">
          <PixelSkeleton className="h-3.5 w-3/4" />
          <PixelSkeleton className="h-3 w-1/2" soft />
        </div>
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <PixelSkeleton key={index} className={`h-3 ${index === rows - 1 ? "w-2/3" : "w-full"}`} soft />
      ))}
    </div>
  );
}

export function PixelSkeletonRow() {
  return (
    <div className="flex items-center gap-2 border-b-2 border-[#eadfca] bg-[#fffdf5] px-3 py-2 last:border-b-0">
      <PixelSkeleton className="size-8" />
      <PixelSkeleton className="h-4 w-1/4" />
      <PixelSkeleton className="ml-auto h-4 w-16" soft />
      <PixelSkeleton className="h-4 w-20" soft />
      <PixelSkeleton className="h-4 w-24" soft />
    </div>
  );
}
