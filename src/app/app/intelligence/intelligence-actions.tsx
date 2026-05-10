"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PixelGlyph } from "../_components/icons";
import { MagicGenerateOverlay } from "./magic-generate-overlay";

export function IntelligenceGenerateButton({
  hasGeminiKey,
  hasReport,
}: {
  hasGeminiKey: boolean;
  hasReport: boolean;
}) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateReport() {
    if (isGenerating || !hasGeminiKey) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/intelligence/generate", {
        method: "POST",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to generate farm intelligence");
      }

      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to generate farm intelligence");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={generateReport}
        disabled={isGenerating || !hasGeminiKey}
        className="pixel-frame inline-flex items-center justify-center gap-2 rounded-none border-2 border-[#3b2a14] bg-[#ffd667] px-3 py-2 font-mono text-xs font-black uppercase tracking-[0.12em] text-[#3b2a14] shadow-[0_3px_0_#3b2a14] transition active:translate-y-0.5 active:shadow-[0_1px_0_#3b2a14] disabled:cursor-not-allowed disabled:bg-[#d8cfaa] disabled:text-[#746850] disabled:shadow-none"
      >
        <PixelGlyph name="sparkle" className="size-4" />
        {isGenerating ? "Generating..." : hasReport ? "Refresh AI" : "Generate AI"}
      </button>
      {!hasGeminiKey ? (
        <p className="max-w-xs text-xs font-semibold text-[#8a3f2a]">Add GEMINI_API_KEY to generate intelligence.</p>
      ) : null}
      {error ? <p className="max-w-xs text-xs font-semibold text-[#8a3f2a]">{error}</p> : null}
      <MagicGenerateOverlay visible={isGenerating} />
    </div>
  );
}
