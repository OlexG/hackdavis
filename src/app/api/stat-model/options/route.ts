import { NextResponse } from "next/server";
import type { FarmV2Plan, GeoPoint } from "@/lib/models";

export const dynamic = "force-dynamic";

const DEFAULT_STAT_MODEL_URL = "http://149.28.204.120:8000";
const SQUARE_FEET_PER_ACRE = 43_560;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const plan = normalizePlan(body);
    const statModelUrl = (process.env.STAT_MODEL_URL ?? DEFAULT_STAT_MODEL_URL).replace(/\/+$/, "");
    const response = await fetch(`${statModelUrl}/v1/options/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        farm_id: typeof body.farmId === "string" ? body.farmId : "farm_001",
        season_year: normalizeInteger(body.seasonYear, 2026),
        scenario_count: normalizeInteger(body.scenarioCount, 200),
        random_seed: normalizeInteger(body.randomSeed, 42),
        risk_tolerance: normalizeNumber(body.riskTolerance, 0.5),
        farm_area_acres: Math.max(0.01, plan.boundary.areaSquareFeet / SQUARE_FEET_PER_ACRE),
        location: centroidFromGeoBoundary(plan.boundary.geo),
        current_plan: {
          boundary: plan.boundary,
          objects: plan.objects,
          units: plan.units,
        },
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.detail ?? "Statistical model option scoring failed" },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to score farm options" },
      { status: 500 },
    );
  }
}

function normalizePlan(body: unknown): FarmV2Plan {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid option scoring request");
  }
  const plan = (body as { plan?: unknown }).plan;
  if (!plan || typeof plan !== "object") {
    throw new Error("Missing farm plan");
  }
  const candidate = plan as FarmV2Plan;
  if (!candidate.boundary || !Number.isFinite(candidate.boundary.areaSquareFeet)) {
    throw new Error("Farm plan boundary area is required");
  }
  return candidate;
}

function centroidFromGeoBoundary(points: GeoPoint[] | null) {
  if (!points?.length) return null;
  const valid = points.filter((point) =>
    Number.isFinite(point[0]) &&
    Number.isFinite(point[1]) &&
    point[0] >= -180 &&
    point[0] <= 180 &&
    point[1] >= -90 &&
    point[1] <= 90,
  );
  if (!valid.length) return null;
  return {
    longitude: round(valid.reduce((sum, point) => sum + point[0], 0) / valid.length),
    latitude: round(valid.reduce((sum, point) => sum + point[1], 0) / valid.length),
  };
}

function normalizeInteger(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function normalizeNumber(value: unknown, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
