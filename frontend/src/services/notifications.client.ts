import { request } from "@/services/http/client";
import type { NotificationsApi } from "@/services/contracts";
import type { Paginated } from "@/types/api";
import type { AppNotification } from "@/types/notification";

export const notificationsClient: NotificationsApi = {
  list: (query = {}) =>
    request<Paginated<AppNotification>>("/notifications", { params: { ...query } }),
  unreadCount: () => request<{ count: number }>("/notifications/unread-count"),
  markRead: (id) => request<void>(`/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => request<void>("/notifications/read-all", { method: "POST" }),
};
