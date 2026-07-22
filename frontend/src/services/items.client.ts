import { request } from "@/services/http/client";
import type { ItemsApi } from "@/services/contracts";
import type { Paginated } from "@/types/api";
import type { Item } from "@/types/item";

export const itemsClient: ItemsApi = {
  list: (query) =>
    request<Paginated<Item>>("/items", { params: { ...query } }),
  get: (id) => request<Item>(`/items/${id}`),
  create: (payload) => request<Item>("/items", { method: "POST", body: payload }),
  update: (id, payload) =>
    request<Item>(`/items/${id}`, { method: "PATCH", body: payload }),
  withdraw: (id) => request<void>(`/items/${id}`, { method: "DELETE" }),
  resolve: (id) => request<Item>(`/items/${id}/resolve`, { method: "POST" }),
};
