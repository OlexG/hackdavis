"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PixelGlyph, PixelIcon } from "../_components/icons";

const marketplaceTabs = [
  { label: "Shop", href: "/app/marketplace/shop", icon: "shop" },
  { label: "Offers", href: "/app/marketplace/offers", glyph: "ledger" },
  { label: "Social", href: "/app/marketplace/social", icon: "social" },
] as const;

export function MarketplaceTabs() {
  const pathname = usePathname();

  return (
    <aside className="mb-5 md:mb-0 md:w-44 md:shrink-0 lg:w-48">
      <nav
        aria-label="Marketplace sections"
        className="flex gap-2 overflow-x-auto border-b-2 border-[#3b2a14] pb-3 md:sticky md:top-4 md:flex-col md:overflow-visible md:border-b-0 md:border-r-2 md:pb-0 md:pr-3"
      >
      {marketplaceTabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-[7.5rem] items-center gap-2 rounded-none border-2 px-3 py-2 font-mono text-xs font-black uppercase tracking-[0.14em] transition md:min-w-0 md:justify-start md:px-3 md:py-3 ${
              active
                ? "border-[#3b2a14] bg-[#ffd667] text-[#2d2313] shadow-[inset_0_2px_0_rgba(255,255,255,0.55),0_2px_0_#3b2a14]"
                : "border-[#c9b88a] bg-[#fffdf5] text-[#5e4a26] shadow-[0_2px_0_#b29c66] hover:border-[#8b6f3e] hover:bg-[#fff3cf]"
            }`}
          >
            {"icon" in tab ? (
              <PixelIcon name={tab.icon} className="h-4 w-4 shrink-0" />
            ) : (
              <PixelGlyph name={tab.glyph} className="h-4 w-4 shrink-0" />
            )}
            {tab.label}
          </Link>
        );
      })}
      </nav>
    </aside>
  );
}
