import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type NominatimEntry = {
  display_name?: unknown;
  lat?: unknown;
  lon?: unknown;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=0&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Sunpatch/0.1 (farm-stand pickup geocoder)",
        "Accept-Language": "en",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = (await response.json()) as NominatimEntry[];

    if (!Array.isArray(data)) {
      return NextResponse.json({ results: [] });
    }

    const results = data
      .map((entry) => ({
        displayName: typeof entry.display_name === "string" ? entry.display_name : "",
        lat: Number(entry.lat),
        lng: Number(entry.lon),
      }))
      .filter((entry) =>
        entry.displayName &&
        Number.isFinite(entry.lat) &&
        Number.isFinite(entry.lng),
      )
      .slice(0, 5);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
