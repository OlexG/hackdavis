import { NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/auth";
import { acceptOfferNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "accept";

    if (action !== "accept") {
      throw new Error("Unsupported offer action");
    }

    const offer = await acceptOfferNotification(id);

    return NextResponse.json({ offer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update offer" },
      { status: error instanceof AuthenticationError ? 401 : isRequestError(error) ? 400 : 500 },
    );
  }
}

function isRequestError(error: unknown) {
  return error instanceof Error && (
    error.message.includes("Invalid offer") ||
    error.message.includes("Offer not found") ||
    error.message.includes("Unsupported")
  );
}
