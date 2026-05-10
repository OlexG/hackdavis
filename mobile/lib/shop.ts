import { apiFetch } from "./api";

export type InventoryCategory =
  | "harvest"
  | "seeds"
  | "starts"
  | "feed"
  | "amendments"
  | "tools"
  | "preserves"
  | "livestock";

export type InventoryViewItem = {
  id: string;
  name: string;
  category: InventoryCategory;
  status: string;
  quantity: {
    amount: number;
    unit: string;
  };
  reorderAt?: number;
  location: string;
  source: string;
  notes: string;
  color: string;
  useBy?: string;
  acquiredAt: string;
  updatedAt: string;
};

export type ShopDisplaySlotView = {
  id: string;
  inventoryItemId: string;
  position: number;
  displayAmount: number;
  displayUnit: string;
  priceCents: number;
  signText: string;
  visible: boolean;
  imageId?: string;
  imageUrl?: string;
  item: InventoryViewItem;
};

export type ShopSnapshot = {
  userEmail: string;
  displayName: string;
  isPublished: boolean;
  theme: "farm-stand";
  layoutMode: "shelves";
  details: {
    shopName: string;
    hours: string;
    pickupLocation: string;
    pickupCoords?: { lat: number; lng: number };
    pickupInstructions: string;
    paymentOptions: string;
    contact: string;
    availabilityNote: string;
  };
  sellableItems: InventoryViewItem[];
  slots: ShopDisplaySlotView[];
  lastUpdated: string;
};

export async function fetchShopSnapshot() {
  return apiFetch<ShopSnapshot>("/api/shop/display");
}
