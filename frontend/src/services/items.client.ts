import { request } from "@/services/http/client";
import type { ItemsApi } from "@/services/contracts";
import type { Paginated } from "@/types/api";
import type { Item, ItemImage } from "@/types/item";

export const itemsClient: ItemsApi = {
  list: (query) =>
    request<Paginated<Item>>("/items", { params: { ...query } }),
  get: (id) => request<Item>(`/items/${id}`),
  create: (payload) => request<Item>("/items", { method: "POST", body: payload }),
  update: (id, payload) =>
    request<Item>(`/items/${id}`, { method: "PATCH", body: payload }),
  withdraw: (id) => request<void>(`/items/${id}`, { method: "DELETE" }),
  resolve: (id) => request<Item>(`/items/${id}/resolve`, { method: "POST" }),

  uploadImages: (id, files) => {
    const form = new FormData();
    // The endpoint takes a repeated `files` field, not `files[]`.
    for (const file of files) form.append("files", file);
    return request<ItemImage[]>(`/items/${id}/images`, {
      method: "POST",
      body: form,
      // Photos on a slow mobile connection need far longer than the 12s default.
      timeoutMs: 60_000,
    });
  },
  deleteImage: (id, imageId) =>
    request<void>(`/items/${id}/images/${imageId}`, { method: "DELETE" }),
};
