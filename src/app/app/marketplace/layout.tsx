import type { ReactNode } from "react";
import { MarketplaceTabs } from "./marketplace-tabs";

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <section className="text-[#2d2313]">
      <MarketplaceTabs />
      {children}
    </section>
  );
}
