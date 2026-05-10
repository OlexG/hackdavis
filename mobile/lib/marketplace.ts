import { apiFetch } from "./api";

export type MarketCategory =
  | "harvest"
  | "preserves"
  | "livestock"
  | "eggs"
  | "dairy"
  | "starts";

export type MarketIcon =
  | "corn"
  | "egg"
  | "hammer"
  | "lettuce"
  | "mushroom"
  | "pea"
  | "potato"
  | "strawberry"
  | "tomato";

export type MarketRatingProfile = {
  quality: number;
  fairness: number;
  pickup: number;
};

export type MarketOffering = {
  id: string;
  listingId?: string;
  userUuid?: string;
  name: string;
  category: MarketCategory;
  amount: number;
  unit: string;
  priceCents: number;
  signText: string;
  icon: MarketIcon;
  color: string;
};

export type MarketFarm = {
  id: string;
  name: string;
  shortName: string;
  distance: string;
  neighborhood: string;
  response: string;
  rating: number;
  reviews: number;
  // GeoJSON Point: [longitude, latitude]
  location: {
    type: "Point";
    coordinates: [number, number];
  };
  coordinates: {
    x: number;
    y: number;
    latitude: number;
    longitude: number;
  };
  ratings: MarketRatingProfile;
  offerings: MarketOffering[];
};

export type MarketplaceSnapshot = {
  source: "mongodb" | "fallback";
  fetchedAt: string;
  center: { latitude: number; longitude: number };
  farms: MarketFarm[];
};

export async function fetchMarketplaceSnapshot(): Promise<MarketplaceSnapshot> {
  return apiFetch<MarketplaceSnapshot>("/api/marketplace/farms");
}

export type ShopOfferingSnapshotItem = MarketOffering & {
  status: "on shelf" | "back stock" | "barter preferred";
  tradeValueCents: number;
  visible: boolean;
};

export async function fetchShopOfferings(userUuid: string): Promise<{ offerings: ShopOfferingSnapshotItem[] }> {
  return apiFetch<{ offerings: Array<Partial<ShopOfferingSnapshotItem> & { name: string; id: string }> }>(
    `/api/shop/offerings?userUuid=${encodeURIComponent(userUuid)}`,
  ).then((data) => ({
    offerings: data.offerings.map((item) => ({
      id: item.id,
      listingId: item.listingId ?? item.id,
      userUuid,
      name: item.name,
      category: normalizeMarketCategory(item.category),
      amount: Number(item.amount ?? 0),
      unit: item.unit ?? "unit",
      priceCents: Number(item.priceCents ?? 0),
      tradeValueCents: Number(item.tradeValueCents ?? item.priceCents ?? 0),
      signText: item.signText ?? "",
      icon: item.icon ?? iconForOffering(item.name),
      color: item.color ?? "#4e9f5d",
      status: item.status ?? (item.visible === false ? "back stock" : "on shelf"),
      visible: item.visible ?? true,
    })),
  }));
}

export type OfferNotification = {
  id: string;
  type: "offer";
  status: "pending" | "accepted" | "declined";
  listingId: string;
  offeringName: string;
  farmName?: string;
  recipientUserUuid: string;
  actorUserUuid: string;
  actorName: string;
  mode: "cash" | "barter";
  cashOfferCents?: number;
  barterListingIds: string[];
  note: string;
  createdAt: string;
  updatedAt: string;
};

export async function fetchOffers(userUuid: string): Promise<{ offers: OfferNotification[] }> {
  return apiFetch<{ offers: OfferNotification[] }>(`/api/offers?userUuid=${encodeURIComponent(userUuid)}`);
}

export async function createOffer(payload: {
  listingId: string;
  farmId?: string;
  farmName?: string;
  actorUserUuid: string;
  actorName: string;
  mode: "cash" | "barter";
  cashOfferCents?: number;
  barterListingIds?: string[];
  note?: string;
}): Promise<{ offer: OfferNotification }> {
  return apiFetch<{ offer: OfferNotification }>("/api/offers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function normalizeMarketCategory(category: unknown): MarketCategory {
  if (
    category === "harvest" ||
    category === "preserves" ||
    category === "livestock" ||
    category === "eggs" ||
    category === "dairy" ||
    category === "starts"
  ) {
    return category;
  }

  return "harvest";
}

function iconForOffering(name: string): MarketIcon {
  const normalized = name.toLowerCase();
  if (normalized.includes("tomato")) return "tomato";
  if (normalized.includes("corn")) return "corn";
  if (normalized.includes("potato")) return "potato";
  if (normalized.includes("straw") || normalized.includes("berry")) return "strawberry";
  if (normalized.includes("pea")) return "pea";
  if (normalized.includes("egg")) return "egg";
  if (normalized.includes("mushroom") || normalized.includes("compost")) return "mushroom";
  return "lettuce";
}
