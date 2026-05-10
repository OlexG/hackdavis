"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const marketplaceTabs = [
  { label: "Shop", href: "/app/marketplace/shop" },
  { label: "Offers", href: "/app/marketplace/offers" },
  { label: "Social", href: "/app/marketplace/social" },
] as const;

export function MarketplaceTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 border-b-2 border-[#3b2a14] pb-3">
      {marketplaceTabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-none border-2 px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.14em] transition ${
              active
                ? "border-[#3b2a14] bg-[#ffd667] text-[#2d2313] shadow-[inset_0_2px_0_rgba(255,255,255,0.55),0_2px_0_#3b2a14]"
                : "border-[#c9b88a] bg-[#fffdf5] text-[#5e4a26] shadow-[0_2px_0_#b29c66] hover:border-[#8b6f3e] hover:bg-[#fff3cf]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
