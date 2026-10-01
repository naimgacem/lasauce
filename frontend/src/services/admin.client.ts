import { request } from "@/services/http/client";
import type { AdminApi } from "@/services/contracts";
import type { Paginated } from "@/types/api";
import type {
  AdminAction,
  AdminItem,
  AdminItemDetail,
  AdminMatch,
  AdminPayment,
  AdminPaymentDetail,
  AdminStats,
  AdminUser,
  AdminUserDetail,
} from "@/types/admin";

export const adminClient: AdminApi = {
  stats: () => request<AdminStats>("/admin/stats"),
  retryFailed: () =>
    request<{ requeued: number }>("/admin/pipeline/retry-failed", { method: "POST" }),

  users: (query) => request<Paginated<AdminUser>>("/admin/users", { params: { ...query } }),
  user: (id) => request<AdminUserDetail>(`/admin/users/${id}`),
  updateUser: (id, patch) =>
    request<AdminUserDetail>(`/admin/users/${id}`, { method: "PATCH", body: patch }),
  grantCredits: (id, payload) =>
    request<AdminUserDetail>(`/admin/users/${id}/credits`, { method: "POST", body: payload }),

  items: (query) => request<Paginated<AdminItem>>("/admin/items", { params: { ...query } }),
  item: (id) => request<AdminItemDetail>(`/admin/items/${id}`),
  closeItem: (id, payload) =>
    request<AdminItemDetail>(`/admin/items/${id}/close`, { method: "POST", body: payload }),
  reopenItem: (id, note) =>
    request<AdminItemDetail>(`/admin/items/${id}/reopen`, { method: "POST", body: { note } }),
  reprocessItem: (id) =>
    request<AdminItemDetail>(`/admin/items/${id}/reprocess`, { method: "POST" }),
  deleteImage: (itemId, imageId, reason) =>
    request<AdminItemDetail>(`/admin/items/${itemId}/images/${imageId}`, {
      method: "DELETE",
      params: { reason },
    }),

  matches: (query) => request<Paginated<AdminMatch>>("/admin/matches", { params: { ...query } }),
  retractMatch: (id, note) =>
    request<AdminMatch>(`/admin/matches/${id}/retract`, { method: "POST", body: { note } }),

  payments: (query) =>
    request<Paginated<AdminPayment>>("/admin/payments", { params: { ...query } }),
  payment: (id) => request<AdminPaymentDetail>(`/admin/payments/${id}`),

  actions: (query) => request<Paginated<AdminAction>>("/admin/actions", { params: { ...query } }),
};
