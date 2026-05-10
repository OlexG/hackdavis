import type { ReactNode } from "react";
import { MarketplaceTabs } from "./marketplace-tabs";

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <section className="text-[#2d2313] md:flex md:items-start md:gap-5">
      <MarketplaceTabs />
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
