import { NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import {
  createOfferNotification,
  listOfferNotifications,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const offers = await listOfferNotifications({
      userUuid: url.searchParams.get("userUuid") ?? undefined,
    });

    return NextResponse.json({ offers });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load offers" },
      { status: error instanceof AuthenticationError ? 401 : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const offer = await createOfferNotification(await request.json());

    return NextResponse.json({ offer }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create offer" },
      { status: error instanceof AuthenticationError ? 401 : isRequestError(error) ? 400 : 500 },
    );
  }
}

function isRequestError(error: unknown) {
  return error instanceof Error && (
    error.message.includes("Missing listing") ||
    error.message.includes("Offering not found")
  );
}
