"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { appNavItems } from "./data";
import { PixelIcon } from "./icons";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <main className="min-h-screen bg-[#fbf6e8] text-[#2d2313]">
      <div className="flex min-h-screen">
        <aside
          className={`app-wood-sidebar bg-[#fffdf5] transition-[width] duration-200 ${
            collapsed ? "w-[72px]" : "w-64"
          }`}
        >
          <div
            className={`flex h-16 items-center border-b border-[#eadfca] ${
              collapsed ? "justify-center px-2" : "justify-between px-4"
            }`}
          >
            {!collapsed ? (
              <Link href="/" className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-[#24583d] bg-[#2f6f4e] text-sm font-semibold text-white">
                  SP
                </span>
                <span className="truncate text-sm font-semibold">Sunpatch</span>
              </Link>
            ) : null}
            <button
              type="button"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed((value) => !value)}
              className="grid size-8 place-items-center rounded-md border border-[#d9d2c5] bg-white text-[#6b6254] transition hover:border-[#bbb09d] hover:bg-[#f8f5ee] hover:text-[#2d2313] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6f4e]"
            >
              <SidebarToggleIcon collapsed={collapsed} />
            </button>
          </div>

          <nav className="space-y-1 p-3">
            {appNavItems.map(({ label, href, shortLabel, icon, accent }) => {
              const active = pathname === href;

              return (
                <Link
                  key={href}
                  href={href}
                  title={collapsed ? label : undefined}
                  className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm transition ${
                    active
                      ? "bg-[#fff3cf] font-medium text-[#2d2313]"
                      : "font-normal text-[#837766] hover:bg-[#fff8dc] hover:text-[#2d2313]"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded border text-xs font-medium"
                    style={{
                      backgroundColor: active ? `${accent}1f` : "#f4efe2",
                      borderColor: active ? `${accent}66` : "#eadfca",
                      color: accent,
                    }}
                  >
                    <PixelIcon name={icon} className="size-4" />
                  </span>
                  {!collapsed ? (
                    <span>{label}</span>
                  ) : (
                    <span className="sr-only">{shortLabel}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="app-wood-header flex h-16 items-center justify-end bg-[#fffdf5] px-6">
            <Link
              href="/"
              className="rounded-md border border-[#eadfca] bg-white px-3 py-2 text-sm font-normal text-[#7a6b55] hover:bg-[#fff8dc] hover:text-[#2d2313]"
            >
              Landing
            </Link>
          </header>
          <div className="p-6">{children}</div>
        </section>
      </div>
    </main>
  );
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 16 16"
      fill="none"
    >
      <rect
        x="2.5"
        y="2.5"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
      />
      <path d="M6 3V13" stroke="currentColor" strokeLinecap="round" />
      <path
        d={collapsed ? "M9 6L11 8L9 10" : "M11 6L9 8L11 10"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
