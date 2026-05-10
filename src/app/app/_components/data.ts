import type { AppIconName } from "./icons";

type AppNavItem = {
  label: string;
  href: string;
  activePrefix?: string;
  shortLabel: string;
  icon: AppIconName;
  accent: string;
};

export const appNavItems = [
  {
    label: "Farm",
    href: "/app/farm",
    shortLabel: "F",
    icon: "farm",
    accent: "#2f6f4e",
  },
  {
    label: "Inventory",
    href: "/app/inventory",
    shortLabel: "I",
    icon: "inventory",
    accent: "#8a6f3f",
  },
  {
    label: "Marketplace",
    href: "/app/marketplace/shop",
    activePrefix: "/app/marketplace",
    shortLabel: "M",
    icon: "marketplace",
    accent: "#e9823a",
  },
  {
    label: "Intelligence",
    href: "/app/intelligence",
    shortLabel: "AI",
    icon: "intelligence",
    accent: "#48b9df",
  },
] as const satisfies readonly AppNavItem[];
