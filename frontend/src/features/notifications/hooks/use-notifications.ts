"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { notificationKeys } from "@/lib/query-keys";
import { api } from "@/services";
import type { Paginated } from "@/types/api";
import type { AppNotification } from "@/types/notification";

const LIST_QUERY = { page_size: 50 } as const;

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.list(LIST_QUERY),
    queryFn: () => api.notifications.list(LIST_QUERY),
  });
}

type ListData = Paginated<AppNotification>;

/** Optimistic single mark-read: cache flips instantly, rolls back on error. */
export function useMarkRead() {
  const queryClient = useQueryClient();
  const listKey = notificationKeys.list(LIST_QUERY);

  return useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const previousList = queryClient.getQueryData<ListData>(listKey);
      const previousCount = queryClient.getQueryData<{ count: number }>(
        notificationKeys.unreadCount(),
      );

      queryClient.setQueryData<ListData>(listKey, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((n) =>
                n.id === id ? { ...n, is_read: true } : n,
              ),
            }
          : old,
      );
      queryClient.setQueryData<{ count: number }>(
        notificationKeys.unreadCount(),
        (old) => ({ count: Math.max(0, (old?.count ?? 1) - 1) }),
      );
      return { previousList, previousCount };
    },
    onError: (_error, _id, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(listKey, context.previousList);
      }
      if (context?.previousCount) {
        queryClient.setQueryData(notificationKeys.unreadCount(), context.previousCount);
      }
      toast.error("Couldn't mark as read — try again.");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/** Optimistic mark-all-read. */
export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const listKey = notificationKeys.list(LIST_QUERY);

  return useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const previousList = queryClient.getQueryData<ListData>(listKey);
      const previousCount = queryClient.getQueryData<{ count: number }>(
        notificationKeys.unreadCount(),
      );

      queryClient.setQueryData<ListData>(listKey, (old) =>
        old
          ? { ...old, items: old.items.map((n) => ({ ...n, is_read: true })) }
          : old,
      );
      queryClient.setQueryData(notificationKeys.unreadCount(), { count: 0 });
      return { previousList, previousCount };
    },
    onError: (_error, _vars, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(listKey, context.previousList);
      }
      if (context?.previousCount) {
        queryClient.setQueryData(notificationKeys.unreadCount(), context.previousCount);
      }
      toast.error("Couldn't mark all as read — try again.");
    },
    onSuccess: () => toast.success("All caught up."),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
