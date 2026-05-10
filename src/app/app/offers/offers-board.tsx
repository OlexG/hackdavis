"use client";

import { useState } from "react";
import { PixelGlyph } from "../_components/icons";
import type { OfferNotificationView } from "@/lib/notifications";

export function OffersBoard({ initialOffers }: { initialOffers: OfferNotificationView[] }) {
  const [offers, setOffers] = useState(initialOffers);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function acceptOffer(offerId: string) {
    setUpdatingId(offerId);
    setError(null);

    try {
      const response = await fetch(`/api/offers/${offerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });
      const data = (await response.json()) as { offer?: OfferNotificationView; error?: string };

      if (!response.ok || !data.offer) {
        throw new Error(data.error ?? "Unable to accept offer");
      }

      setOffers((current) => current.map((offer) => (offer.id === offerId ? data.offer as OfferNotificationView : offer)));
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : "Unable to accept offer");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      <header className="pixel-frame border-2 border-[#3b2a14] bg-[#fffdf5] p-4 shadow-[0_4px_0_#3b2a14]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-none border-2 border-[#c95b76] bg-[#fff0f4] shadow-[0_2px_0_#7a3148]">
              <PixelGlyph name="sparkle" className="size-5" />
            </span>
            <div>
              <p className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#7a3148]">Offers</p>
              <h1 className="text-2xl font-black text-[#2d2313]">Shop offers and barters</h1>
            </div>
          </div>
          <span className="rounded-none border-2 border-[#3b2a14] bg-[#fff4dc] px-3 py-1 font-mono text-[11px] font-black uppercase tracking-[0.1em] text-[#7a461f] shadow-[0_2px_0_#3b2a14]">
            {offers.length} total
          </span>
        </div>
        {error ? <p className="mt-3 rounded-none border-2 border-[#b84c35] bg-[#fff0e6] px-3 py-2 text-sm font-bold text-[#8a2f20]">{error}</p> : null}
      </header>

      <div className="grid gap-3">
        {offers.length ? offers.map((offer) => (
          <article key={offer.id} className="rounded-none border-2 border-[#3b2a14] bg-[#fffdf5] p-4 shadow-[0_3px_0_#5e4a26]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#7a6843]">
                  {offer.mode === "barter" ? "Barter offer" : "Cash offer"} · {offer.status}
                </p>
                <h2 className="mt-1 text-lg font-black text-[#2d311f]">{offer.offeringName}</h2>
                <p className="mt-1 text-sm font-semibold text-[#5e4a26]">
                  {offer.actorName} offered {offer.mode === "cash" ? formatMoney(offer.cashOfferCents ?? 0) : `${offer.barterListingIds.length} barter listing${offer.barterListingIds.length === 1 ? "" : "s"}`}.
                </p>
                {offer.note ? <p className="mt-2 text-sm text-[#6b6254]">{offer.note}</p> : null}
              </div>
              {offer.status === "pending" ? (
                <button
                  type="button"
                  disabled={updatingId === offer.id}
                  onClick={() => acceptOffer(offer.id)}
                  className="rounded-none border-2 border-[#3b2a14] bg-[#7da854] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.12em] text-[#fffdf5] shadow-[0_2px_0_#3b2a14] transition hover:bg-[#9bc278] disabled:cursor-wait disabled:opacity-70"
                >
                  {updatingId === offer.id ? "Accepting" : "Accept"}
                </button>
              ) : null}
            </div>
          </article>
        )) : (
          <div className="grid min-h-80 place-items-center rounded-none border-2 border-dashed border-[#c9b88a] bg-[#fffdf5] text-center">
            <div>
              <PixelGlyph name="basket" className="mx-auto mb-2 size-8 text-[#c9a64a]" />
              <p className="font-mono text-xs font-black uppercase tracking-[0.14em] text-[#7a6843]">No offers yet</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatMoney(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
