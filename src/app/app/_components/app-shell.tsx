"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { logoutAction } from "@/app/auth/actions";
import type { CurrentUser } from "@/lib/auth";
import { appNavItems } from "./data";
import { PixelIcon, SunpatchLogo } from "./icons";

export function AppShell({ children, currentUser }: { children: ReactNode; currentUser: CurrentUser }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const userInitial = currentUser.displayName.trim().charAt(0).toUpperCase() || "U";

  return (
    <main className="h-screen overflow-hidden bg-[#fbf6e8] text-[#2d2313]">
      <div className="flex h-screen min-h-0 max-md:flex-col">
        <aside
          className={`h-screen shrink-0 overflow-hidden border-r-2 border-[#3b2a14] bg-[#fffdf5] transition-[width] duration-200 max-md:h-auto max-md:w-full max-md:border-b-2 max-md:border-r-0 ${
            collapsed ? "w-[76px]" : "w-64"
          }`}
        >
          <div
            className={`pixel-gradient-sky flex h-16 items-center border-b-2 border-[#3b2a14] max-md:px-4 ${
              collapsed ? "justify-center px-2" : "justify-between px-3"
            }`}
          >
            {!collapsed ? (
              <Link href="/" className="flex min-w-0 items-center gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-md border-2 border-[#8b6f3e] bg-[#ffe89a] text-[#a8761c] shadow-[inset_0_2px_0_rgba(255,255,255,0.6),inset_0_-3px_0_rgba(168,118,28,0.35),0_2px_0_#5e4a26]">
                  <SunpatchLogo alt="" className="size-8" />
                </span>
                <span className="truncate font-mono text-sm font-black uppercase tracking-[0.18em] text-[#34432b] drop-shadow-[1px_1px_0_#fffdf5]">
                  Sunpatch
                </span>
              </Link>
            ) : (
              <Link href="/" aria-label="Sunpatch home" className="grid size-9 place-items-center rounded-md border-2 border-[#8b6f3e] bg-[#ffe89a] text-[#a8761c] shadow-[inset_0_2px_0_rgba(255,255,255,0.6),inset_0_-3px_0_rgba(168,118,28,0.35),0_2px_0_#5e4a26]">
                <SunpatchLogo alt="" className="size-8" />
              </Link>
            )}
            {!collapsed ? (
              <button
                type="button"
                aria-label="Collapse sidebar"
                onClick={() => setCollapsed(true)}
                className="grid size-8 place-items-center rounded-md border-2 border-[#8b6f3e] bg-[#fffdf5] text-[#5e4a26] shadow-[0_2px_0_#5e4a26] transition hover:bg-[#fff3cf] active:translate-y-0.5 active:shadow-[0_1px_0_#5e4a26] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2f6f4e]"
              >
                <SidebarToggleIcon collapsed={false} />
              </button>
            ) : null}
          </div>

          {collapsed ? (
            <div className="flex justify-center border-b-2 border-[#3b2a14] bg-[#fcf6e4] py-1.5">
              <button
                type="button"
                aria-label="Expand sidebar"
                onClick={() => setCollapsed(false)}
                className="grid size-8 place-items-center rounded-md border-2 border-[#8b6f3e] bg-[#fffdf5] text-[#5e4a26] shadow-[0_2px_0_#5e4a26] transition hover:bg-[#fff3cf] active:translate-y-0.5 active:shadow-[0_1px_0_#5e4a26]"
              >
                <SidebarToggleIcon collapsed={true} />
              </button>
            </div>
          ) : null}

          <div className="flex min-h-[calc(100vh-4rem)] flex-col max-md:min-h-0">
            <nav className="space-y-1.5 p-3 max-md:flex max-md:gap-2 max-md:overflow-x-auto max-md:space-y-0 max-md:p-2">
              {appNavItems.map(({ label, href, shortLabel, icon, accent }) => {
                const active = pathname === href;

                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    style={active ? { ["--pixel-frame-bg" as string]: "#fffdf5" } : undefined}
                    className={`relative flex h-11 items-center gap-3 rounded-none border-2 px-2.5 font-mono text-xs uppercase tracking-[0.12em] transition ${
                      active
                        ? "pixel-frame border-[#8b6f3e] bg-[#fff3cf] font-bold text-[#2d2313] shadow-[inset_0_2px_0_rgba(255,255,255,0.6),0_2px_0_#5e4a26]"
                        : "border-transparent font-semibold text-[#837766] hover:border-[#c9b88a] hover:bg-[#fff8dc] hover:text-[#2d2313] hover:shadow-[0_2px_0_#b29c66]"
                    } ${collapsed ? "justify-center px-1.5" : ""} max-md:shrink-0`}
                  >
                    <span
                      className="grid size-8 shrink-0 place-items-center rounded-md border-2"
                      style={{
                        backgroundColor: active ? `${accent}26` : "#fff8dc",
                        borderColor: active ? accent : "#c9b88a",
                        color: accent,
                        boxShadow: active
                          ? `inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -3px 0 ${accent}40, 0 1px 0 #5e4a26`
                          : "inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -3px 0 rgba(95,80,43,0.18), 0 1px 0 #b29c66",
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

            <div className="mt-auto border-t-2 border-[#3b2a14] bg-[#fcf6e4] p-3 max-md:hidden">
              <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
                <span className="grid size-9 shrink-0 place-items-center rounded-md border-2 border-[#8b6f3e] bg-[#ffe89a] font-mono text-sm font-black text-[#5e4a26] shadow-[0_2px_0_#5e4a26]">
                  {userInitial}
                </span>
                {!collapsed ? (
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs font-black uppercase tracking-[0.1em] text-[#34432b]">
                      {currentUser.displayName}
                    </p>
                    <p className="truncate text-xs font-semibold text-[#746850]">
                      @{currentUser.username ?? currentUser.email}
                    </p>
                  </div>
                ) : null}
              </div>
              {!collapsed ? (
                <form action={logoutAction} className="mt-2">
                  <button
                    type="submit"
                    className="h-9 w-full rounded-none border-2 border-[#8b6f3e] bg-[#fffdf5] font-mono text-xs font-black uppercase tracking-[0.12em] text-[#5e4a26] shadow-[0_2px_0_#5e4a26] transition hover:bg-[#fff3cf]"
                  >
                    Sign out
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </aside>

        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto">
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
