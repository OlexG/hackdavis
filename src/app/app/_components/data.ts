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
    label: "Shop",
    href: "/app/shop",
    shortLabel: "$",
    icon: "shop",
    accent: "#e9823a",
  },
  {
    label: "Intelligence",
    href: "/app/intelligence",
    shortLabel: "AI",
    icon: "intelligence",
    accent: "#48b9df",
  },
  {
    label: "Social",
    href: "/app/social",
    shortLabel: "S",
    icon: "social",
    accent: "#c95b76",
  },
] as const;

export type AppIconName = (typeof appNavItems)[number]["icon"];
