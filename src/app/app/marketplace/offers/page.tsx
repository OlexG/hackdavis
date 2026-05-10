import { connection } from "next/server";
import { getSocialOffers } from "@/lib/social";
import { OffersBoard } from "../../offers/offers-board";

export default async function MarketplaceOffersPage() {
  await connection();
  const { offers } = await getSocialOffers("inbox");

  return (
    <section className="min-h-[calc(100vh-10rem)]">
      <OffersBoard initialOffers={offers} />
    </section>
  );
}
