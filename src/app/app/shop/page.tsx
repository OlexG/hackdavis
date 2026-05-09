import { connection } from "next/server";
import { getShopSnapshot } from "@/lib/shop";
import { ShopBoard } from "./shop-board";

export default async function ShopPage() {
  await connection();
  const snapshot = await getShopSnapshot();

  return (
    <section className="min-h-[calc(100vh-7rem)] text-[#2d2313]">
      <ShopBoard initialSnapshot={snapshot} />
    </section>
  );
}
