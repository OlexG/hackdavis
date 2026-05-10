import type { Metadata } from "next";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "./_components/app-shell";

export const metadata: Metadata = {
  title: "Sunpatch App",
  description:
    "Farm planning workspace for crop planning, seasonal views, shop economics, and ecological impact.",
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect("/login");
  }

  return <AppShell currentUser={currentUser}>{children}</AppShell>;
}
