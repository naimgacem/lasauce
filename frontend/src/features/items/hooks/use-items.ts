"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";

import { itemKeys } from "@/lib/query-keys";
import { ROUTES } from "@/lib/routes";
import { api } from "@/services";
import type { CreateItemPayload, Item, ItemQuery } from "@/types/item";

/**
 * Browse/search items.
 *
 * `enabled` matters for owner-scoped lists: an undefined `user_id` is dropped
 * from the query string, so firing before the session is known would quietly
 * list *every* user's items under "My items". Callers that scope by user must
 * gate on having the id.
 */
export function useItems(query: ItemQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: itemKeys.list(query),
    queryFn: () => api.items.list(query),
    placeholderData: keepPreviousData, // previous page stays visible while fetching
    enabled: options?.enabled ?? true,
  });
}

/**
 * A single item. `initialData` lets a server-rendered page hand over what it
 * already fetched, so the detail view paints instantly and still refetches in
 * the background to pick up edits made since the server render.
 */
export function useItem(id: string, options?: { initialData?: Item }) {
  return useQuery({
    queryKey: itemKeys.detail(id),
    queryFn: () => api.items.get(id),
    enabled: Boolean(id),
    initialData: options?.initialData,
  });
}

/**
 * Create a report. Deliberately does NOT navigate — the report wizard owns the
 * sequence (create → upload photos → navigate) so a photo upload can't race the
 * route change.
 */
export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateItemPayload) => api.items.create(payload),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
      queryClient.setQueryData(itemKeys.detail(item.id), item);
    },
    onError: (error) => toast.error(error.message),
  });
}

/** Attach photos to an existing item. */
export function useUploadItemImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, files }: { itemId: string; files: File[] }) =>
      api.items.uploadImages(itemId, files),
    onSuccess: (_images, { itemId }) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(itemId) });
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    },
  });
}

/** Remove a photo from an item. */
export function useDeleteItemImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, imageId }: { itemId: string; imageId: string }) =>
      api.items.deleteImage(itemId, imageId),
    onSuccess: (_void, { itemId }) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(itemId) });
      toast.success("Photo removed.");
    },
    onError: (error) => toast.error(error.message),
  });
}

/** Close an item as recovered — the happy ending. */
export function useResolveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.items.resolve(id),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
      queryClient.setQueryData(itemKeys.detail(item.id), item);
      toast.success("Marked as recovered", {
        description: "Glad it found its way back.",
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useWithdrawItem() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.items.withdraw(id),
    onSuccess: (_void, id) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(id) });
      toast.success("Report withdrawn.");
      router.push(ROUTES.dashboard);
    },
    onError: (error) => toast.error(error.message),
  });
}
