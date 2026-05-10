import Image from "next/image";
import { connection } from "next/server";
import { getInventorySnapshot } from "@/lib/inventory";
import { PixelGlyph } from "../_components/icons";
import { InventoryBoard } from "./inventory-board";
import { YieldForecastPanel } from "./yield-forecast-panel";

export default async function InventoryPage() {
  await connection();
  const snapshot = await getInventorySnapshot();

  return (
    <section className="pixel-frame-2 min-h-[calc(100vh-7rem)] overflow-hidden rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] text-[#2d2313] shadow-[0_4px_0_#3b2a14]">
      <InventoryHeroBanner />
      <div className="grid gap-3 p-3">
        {snapshot.plan ? <YieldForecastPanel plan={snapshot.plan} /> : null}
        <InventoryBoard initialItems={snapshot.items} />
      </div>
    </section>
  );
}

function PixelStar({ className }: { className: string }) {
  return <span aria-hidden className={`pointer-events-none ${className}`} />;
}

function InventoryHeroBanner() {
  return (
    <div className="pixel-gradient-sky relative overflow-hidden border-b-2 border-[#3b2a14] px-4 py-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "8px 8px",
        }}
      />
      <PixelStar className="absolute left-[42%] top-[18%] size-1.5 bg-[#fffdf5]" />
      <PixelStar className="absolute left-[58%] top-[32%] size-1 bg-[#fffdf5]" />
      <PixelStar className="absolute left-[72%] top-[12%] size-1.5 bg-[#ffe89a]" />
      <PixelStar className="absolute left-[88%] top-[44%] size-1 bg-[#fffdf5]" />
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
          <span
            aria-hidden
            className="grid size-12 place-items-center rounded-md border-2 border-[#8b6f3e] bg-[#fff8dc] shadow-[inset_0_2px_0_rgba(255,255,255,0.6),inset_0_-4px_0_rgba(95,80,43,0.22),0_2px_0_#5e4a26]"
          >
            <Image
              src="/inventory-icons/strawberry.png"
              alt=""
              width={28}
              height={28}
              className="size-7"
              style={{ imageRendering: "pixelated" }}
              unoptimized
            />
          </span>
          <div>
            <h1 className="font-mono text-lg font-black uppercase tracking-[0.18em] text-[#34432b] drop-shadow-[1px_1px_0_#fffdf5]">
              Farmhouse Pantry
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-md border-2 border-[#8b6f3e] bg-[#fffdf5] px-3 py-1.5 text-xs font-semibold text-[#5e4a26] shadow-[0_2px_0_#5e4a26]">
          <PixelGlyph name="sun" className="size-3.5 text-[#d39a18]" />
          <span className="font-mono uppercase tracking-[0.12em]">Open · Today</span>
        </div>
      </div>
    </div>
  );
}
