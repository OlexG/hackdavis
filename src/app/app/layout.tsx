import Link from "next/link";
import type { ReactNode } from "react";
import { appNavItems } from "./_components/data";
import { BigStat, MiniStat } from "./_components/ui";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#fff3cf] text-[#2d2313]">
      <div
        className="app-sky fixed inset-x-0 top-0 h-72 overflow-hidden"
        aria-hidden="true"
      >
        <video
          className="app-sky-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
        >
          <source src="/sky-timelapse.webm" type="video/webm" />
        </video>
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-5 px-4 py-4 lg:flex-row lg:px-6">
        <aside className="game-panel z-10 flex shrink-0 flex-col gap-5 bg-[#fff8dc] p-4 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:w-72">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid size-12 place-items-center border-2 border-[#2d2313] bg-[#2f6f4e] text-base font-black text-[#fff8dc]">
              SP
            </div>
            <div>
              <p className="text-xs font-black uppercase text-[#8a3c2f]">
                Sunpatch
              </p>
              <p className="text-2xl font-black leading-none">Farm Console</p>
            </div>
          </Link>

          <nav className="grid gap-2">
            {appNavItems.map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="border-2 border-[#2d2313] bg-[#f6c765] px-4 py-3 text-sm font-black uppercase transition hover:-translate-y-0.5 hover:bg-[#ffd667]"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto border-2 border-[#2d2313] bg-[#e8f3b6] p-4">
            <p className="text-xs font-black uppercase text-[#2f6f4e]">
              Farm status
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <MiniStat value="1" label="Season" />
              <MiniStat value="0" label="Orders" />
              <MiniStat value="B" label="Eco" />
            </div>
          </div>
        </aside>

        <section className="z-10 flex-1 space-y-5">
          <header className="game-panel bg-[#fff8dc]/95 p-5">
            <p className="text-sm font-black uppercase text-[#2f6f4e]">
              Year 1 / Spring / Morning
            </p>
            <div className="mt-2 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h1 className="text-4xl font-black leading-tight sm:text-5xl">
                  Plan the farm like a game. Run it like a real garden.
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-[#5f4b2c]">
                  These first routes map the core loop: see the farm, plan the
                  season, price the harvest, and understand the ecological
                  impact before anything is wired to live data.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center xl:w-80">
                <BigStat value="24" label="Plots" color="#e8f3b6" />
                <BigStat value="$0" label="Sales" color="#f2bd4b" />
                <BigStat value="--" label="Yield" color="#8bd5e9" />
              </div>
            </div>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}
