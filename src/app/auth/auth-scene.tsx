import type { ReactNode } from "react";
import { PixelGlyph, SunpatchLogo } from "../app/_components/icons";

export function AuthScene({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="grid h-[100svh] place-items-center overflow-hidden bg-[#fbf6e8] px-5 py-6 text-[#2d2313]">
      <div className="absolute inset-0 overflow-hidden hero-sky" aria-hidden="true">
        <div className="hero-pixel-grid" />
        <div className="hero-pixel-sun" />
        <div className="hero-pixel-cloud hero-pixel-cloud-one" />
        <div className="hero-pixel-cloud hero-pixel-cloud-two" />
        <div className="hero-pixel-cloud hero-pixel-cloud-three" />
        <div className="hero-pixel-cloud hero-pixel-cloud-four" />
        <div className="hero-pixel-cloud hero-pixel-cloud-five" />
        <div className="hero-pixel-spark hero-pixel-spark-one" />
        <div className="hero-pixel-spark hero-pixel-spark-two" />
        <div className="hero-pixel-spark hero-pixel-spark-three" />
        <div className="hero-pixel-horizon" />
      </div>
      <section
        style={{ ["--pixel-frame-bg" as string]: "#fbf6e8" }}
        className="pixel-frame relative w-full max-w-md rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] p-6 shadow-[0_6px_0_#3b2a14]"
      >
        <div className="mb-6 text-center">
          <span className="mx-auto grid size-20 place-items-center rounded-none border-2 border-[#3b2a14] bg-[#ffe89a] shadow-[0_3px_0_#3b2a14]">
            <SunpatchLogo alt="Sunpatch" className="size-16" priority />
          </span>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-none border-2 border-[#8b6f3e] bg-[#fff3cf] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[#6f3f1c]">
            <PixelGlyph name="leaf" className="size-3.5" />
            {eyebrow}
          </p>
          <h1 className="mt-3 font-mono text-xl font-black uppercase tracking-[0.14em] text-[#34432b]">
            {title}
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#5e4a26]">{subtitle}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
