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
