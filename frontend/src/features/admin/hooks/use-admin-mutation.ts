"use client";

import {
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { adminKeys, itemKeys } from "@/lib/query-keys";

/**
 * Shared shape of every admin write: run it, put the fresh record where the
 * page reads it, refresh the rest of the console, confirm in a toast.
 *
 * `detailKey` receives the server's response directly, so the page the admin
 * is looking at updates in the same paint as the toast. Everything else under
 * `adminKeys.all` is then invalidated — a moderation action can move a figure
 * on the overview, a row in two tables and an entry in the activity log, and a
 * console whose numbers disagree with each other is worse than a slow one.
 *
 * The public item caches are refreshed too: closing a report must also take it
 * out of the browse grid the admin may open in the next tab.
 */
export function useAdminMutation<TData, TVariables = void>({
  mutationFn,
  detailKey,
  successMessage,
}: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  detailKey?: (data: TData, variables: TVariables) => QueryKey;
  successMessage: string | ((data: TData) => string);
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      if (detailKey) queryClient.setQueryData(detailKey(data, variables), data);
      void queryClient.invalidateQueries({ queryKey: adminKeys.all });
      void queryClient.invalidateQueries({ queryKey: itemKeys.all });
      toast.success(typeof successMessage === "function" ? successMessage(data) : successMessage);
    },
    onError: (error) => toast.error(error.message),
  });
}
