import { NextResponse } from "next/server";
import { createFarmReview, SocialReviewError } from "@/lib/social";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = normalizeRequest(await request.json());
    const result = await createFarmReview(body);

    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to post review" },
      { status: error instanceof SocialReviewError ? 400 : 500 },
    );
  }
}

function normalizeRequest(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    throw new SocialReviewError("Invalid review request");
  }

  const value = raw as Record<string, unknown>;

  return {
    farmUserId: typeof value.farmUserId === "string" ? value.farmUserId : "",
    reviewerName: typeof value.reviewerName === "string" ? value.reviewerName : "",
    rating: typeof value.rating === "number" ? value.rating : 0,
    comment: typeof value.comment === "string" ? value.comment : "",
  };
}
