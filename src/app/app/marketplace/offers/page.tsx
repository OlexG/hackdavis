import { connection } from "next/server";
import { listOfferNotifications } from "@/lib/notifications";
import { OffersBoard } from "../../offers/offers-board";

export default async function MarketplaceOffersPage() {
  await connection();
  const offers = await listOfferNotifications();

  return (
    <section className="min-h-[calc(100vh-10rem)]">
      <OffersBoard initialOffers={offers} />
    </section>
  );
}
