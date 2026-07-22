"use client";

import { useQuery } from "@tanstack/react-query";

import { useSession } from "@/features/auth/hooks/use-session";
import { notificationKeys } from "@/lib/query-keys";
import { api } from "@/services";

/** Unread badge count — polled while a session is active. */
export function useUnreadCount() {
  const { isAuthed } = useSession();

  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => api.notifications.unreadCount(),
    enabled: isAuthed,
    refetchInterval: 45_000,
    staleTime: 30_000,
  });
}
