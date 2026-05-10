import { NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { generateAndSaveFarmIntelligence } from "@/lib/intelligence";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await generateAndSaveFarmIntelligence();

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: formatApiError(error, "Unable to generate farm intelligence") },
      { status: error instanceof AuthenticationError ? 401 : isSetupError(error) ? 400 : 500 },
    );
  }
}

function formatApiError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isSetupError(error: unknown) {
  return error instanceof Error && error.message.includes("GEMINI_API_KEY");
}
