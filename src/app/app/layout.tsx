import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "./_components/app-shell";

export const metadata: Metadata = {
  title: "Sunpatch App",
  description:
    "Farm planning workspace for crop planning, seasonal views, shop economics, and ecological impact.",
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
