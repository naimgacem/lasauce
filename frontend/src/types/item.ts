import type { CategorySummary } from "@/types/category";

export type ItemType = "lost" | "found";
export type ItemStatus = "open" | "matched" | "claimed" | "closed";
export type ItemClosedReason =
  | "recovered"
  | "expired"
  | "withdrawn"
  | "duplicate";

/** ML pipeline state — orthogonal to the business `status`. */
export type ProcessingStatus =
  | "pending"
  | "embedding"
  | "matching"
  | "ready"
  | "failed";

export interface ItemImage {
  id: string;
  item_id: string;
  image_path: string;
  created_at: string;
}

export interface Item {
  id: string;
  user_id: string;
  type: ItemType;
  status: ItemStatus;
  processing_status: ProcessingStatus;
  title: string;
  description: string;
  category_id: string | null;
  category: CategorySummary | null;
  color: string | null;
  brand: string | null;
  location_text: string | null;
  latitude: number | null;
  longitude: number | null;
  lost_or_found_at: string;
  closed_reason: ItemClosedReason | null;
  closed_at: string | null;
  images: ItemImage[];
  created_at: string;
  updated_at: string;
}

/** Filters + pagination accepted by `GET /items`. */
export interface ItemQuery {
  type?: ItemType;
  status?: ItemStatus;
  category_id?: string;
  q?: string;
  date_from?: string;
  date_to?: string;
  user_id?: string;
  page?: number;
  page_size?: number;
}

export interface CreateItemPayload {
  type: ItemType;
  title: string;
  description: string;
  category_id?: string | null;
  color?: string | null;
  brand?: string | null;
  location_text?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  lost_or_found_at: string;
}

export type UpdateItemPayload = Partial<Omit<CreateItemPayload, "type">>;
