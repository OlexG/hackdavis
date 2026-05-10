"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PixelGlyph } from "../_components/icons";

const phrases = [
  "Reading the almanac",
  "Counting the chickens",
  "Tasting the soil",
  "Asking the bees",
  "Polishing the harvest moon",
  "Listening to the wind",
  "Sharpening the scythes",
  "Whispering to the wheat",
  "Charting the tomato moon",
];

const sparkLayout: { left: string; top: string; delay: string; tone: "pink" | "gold" | "" }[] = [
  { left: "8%", top: "62%", delay: "0s", tone: "" },
  { left: "16%", top: "72%", delay: "0.4s", tone: "gold" },
  { left: "22%", top: "84%", delay: "1.1s", tone: "" },
  { left: "30%", top: "70%", delay: "0.7s", tone: "pink" },
  { left: "38%", top: "82%", delay: "1.6s", tone: "" },
  { left: "44%", top: "76%", delay: "0.2s", tone: "gold" },
  { left: "52%", top: "88%", delay: "0.9s", tone: "" },
  { left: "60%", top: "74%", delay: "2.0s", tone: "pink" },
  { left: "68%", top: "82%", delay: "0.5s", tone: "" },
  { left: "76%", top: "70%", delay: "1.3s", tone: "gold" },
  { left: "84%", top: "84%", delay: "0.8s", tone: "" },
  { left: "92%", top: "78%", delay: "1.8s", tone: "pink" },
];

const EXPECTED_SECONDS = 30;

export function MagicGenerateOverlay({ visible }: { visible: boolean }) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const mountTarget = typeof document === "undefined" ? null : document.getElementById("app-main");

  useEffect(() => {
    if (!visible) {
      return;
    }

    const phraseTimer = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % phrases.length);
    }, 2400);

    const startedAt = Date.now();
    const elapsedTimer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    return () => {
      window.clearInterval(phraseTimer);
      window.clearInterval(elapsedTimer);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || typeof document === "undefined") return;
    const target = document.getElementById("app-main");
    if (!target) return;
    const previousOverflow = target.style.overflow;
    target.style.overflow = "hidden";
    return () => {
      target.style.overflow = previousOverflow;
    };
  }, [visible]);

  if (!visible || !mountTarget) {
    return null;
  }

  const overlay = (
    <div
      role="status"
      aria-live="polite"
      aria-label="Generating farm intelligence"
      className="magic-backdrop absolute inset-0 z-[60] flex items-center justify-center px-6"
    >
      <div className="magic-stars" aria-hidden />
      <div className="magic-scanlines" aria-hidden />

      {sparkLayout.map((spark, index) => (
        <span
          key={index}
          aria-hidden
          className={`magic-spark ${spark.tone === "gold" ? "magic-spark-gold" : spark.tone === "pink" ? "magic-spark-pink" : ""}`}
          style={{ left: spark.left, top: spark.top, animationDelay: spark.delay }}
        />
      ))}

      <div
        style={{ ["--pixel-frame-bg" as string]: "#1c2c4a" }}
        className="pixel-frame magic-panel-pop relative w-full max-w-md rounded-none border-4 border-[#3b2a14] bg-[#fffdf5] p-6 text-center shadow-[0_6px_0_#3b2a14,0_18px_40px_rgba(0,0,0,0.45)]"
      >
        <div className="relative mx-auto mb-4 grid h-36 w-36 place-items-center">
          <span className="magic-rays absolute inset-0" aria-hidden />
          <span className="magic-sun-core relative grid size-20 place-items-center rounded-none">
            <PixelGlyph name="sun" className="size-12 text-[#a8761c]" />
          </span>
        </div>

        <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#7a6843]">
          Gemini · Almanac
        </p>
        <h2 className="mt-1 font-mono text-2xl font-black uppercase leading-tight tracking-[0.12em] text-[#34432b] drop-shadow-[2px_2px_0_#fffdf5]">
          Growing Intelligence
        </h2>

        <div className="mt-4 grid h-6 place-items-center">
          <p
            key={phraseIndex}
            className="magic-panel-pop flex items-center gap-2 font-mono text-xs font-black uppercase tracking-[0.12em] text-[#5e4a26]"
          >
            <PixelGlyph name="sparkle" className="size-4 text-[#a8761c]" />
            {phrases[phraseIndex]}…
          </p>
        </div>

        <div className="mt-5 grid gap-2">
          <div className="magic-progress" />
          <div className="flex items-center justify-between gap-2 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-[#7a6843]">
            <span>~ {EXPECTED_SECONDS}s · please don&apos;t close this tab</span>
            <span className="rounded-none border-2 border-[#3b2a14] bg-[#fff8dc] px-1.5 py-0.5 text-[#5e4a26] shadow-[0_1px_0_#3b2a14]">
              {formatElapsed(elapsedSeconds)}
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3 text-[#5e4a26]">
          <PixelGlyph name="leaf" className="size-4 text-[#2f6f4e]" />
          <PixelGlyph name="wheat" className="size-4 text-[#a8761c]" />
          <PixelGlyph name="basket" className="size-4 text-[#6f3f1c]" />
          <PixelGlyph name="jar" className="size-4 text-[#245c65]" />
          <PixelGlyph name="sparkle" className="size-4 text-[#c95b76]" />
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, mountTarget);
}

function formatElapsed(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
