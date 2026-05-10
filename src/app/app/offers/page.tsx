import { connection } from "next/server";
import { listOfferNotifications } from "@/lib/notifications";
import { OffersBoard } from "./offers-board";

export default async function OffersPage() {
  await connection();
  const offers = await listOfferNotifications();

  return (
    <section className="min-h-[calc(100vh-7rem)] text-[#2d2313]">
      <OffersBoard initialOffers={offers} />
    </section>
  );
}
