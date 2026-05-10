import { connection } from "next/server";
import { getShopSnapshot } from "@/lib/shop";
import { ShopBoard } from "../../shop/shop-board";

export default async function MarketplaceShopPage() {
  await connection();
  const snapshot = await getShopSnapshot();

  return (
    <section className="min-h-[calc(100vh-10rem)]">
      <ShopBoard initialSnapshot={snapshot} />
    </section>
  );
}
