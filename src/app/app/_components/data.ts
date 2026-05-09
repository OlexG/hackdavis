export const appNavItems = [
  {
    label: "Farm",
    href: "/app/farm",
    shortLabel: "F",
    icon: "farm",
    accent: "#2f6f4e",
  },
  {
    label: "Seasonal",
    href: "/app/seasonal",
    shortLabel: "S",
    icon: "season",
    accent: "#f2bd4b",
  },
  {
    label: "Shop",
    href: "/app/shop",
    shortLabel: "$",
    icon: "shop",
    accent: "#e9823a",
  },
  {
    label: "Impact",
    href: "/app/impact",
    shortLabel: "I",
    icon: "impact",
    accent: "#48b9df",
  },
] as const;

export type AppIconName = (typeof appNavItems)[number]["icon"];
