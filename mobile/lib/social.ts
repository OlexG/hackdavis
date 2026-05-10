import { apiFetch } from "./api";
import type { ShopSnapshot } from "./shop";

export type SocialFarmReview = {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string;
  tags: string[];
  createdAt: string;
};

export type SocialFarmCard = {
  userId: string;
  farmName: string;
  displayName: string;
  bio: string;
  distanceLabel: string;
  rating: number;
  reviewCount: number;
  availablePreview: string[];
  tags: string[];
  snapshot: ShopSnapshot;
  reviews: SocialFarmReview[];
};

export type SocialSnapshot = {
  farms: SocialFarmCard[];
  lastUpdated: string;
};

export type SocialOffer = {
  id: string;
  farmUserId: string;
  senderUserId: string;
  senderName: string;
  inventoryItemId?: string;
  itemName: string;
  quantity: string;
  priceCents?: number;
  message: string;
  status: string;
  createdAt: string;
};

export type SocialOffersSnapshot = {
  offers: SocialOffer[];
  box: "inbox" | "sent";
  lastUpdated: string;
};

export async function fetchSocialSnapshot() {
  return apiFetch<SocialSnapshot>("/api/social");
}

export async function fetchSocialOffers(box: "inbox" | "sent" = "inbox") {
  return apiFetch<SocialOffersSnapshot>(`/api/social/offers?box=${box}`);
}

export async function postFarmReview(input: {
  farmUserId: string;
  reviewerName: string;
  rating: number;
  comment: string;
}) {
  return apiFetch<{ review: SocialFarmReview; created: boolean }>("/api/social/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function postSocialOffer(input: {
  farmUserId: string;
  inventoryItemId?: string;
  itemName: string;
  quantity: string;
  priceCents?: number;
  message: string;
}) {
  return apiFetch<{ offer: SocialOffer; notificationSent: boolean }>("/api/social/offers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
