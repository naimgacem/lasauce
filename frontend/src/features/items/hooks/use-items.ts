"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { itemKeys } from "@/lib/query-keys";
import { ROUTES } from "@/lib/routes";
import { api } from "@/services";
import type { CreateItemPayload, ItemQuery } from "@/types/item";

export function useItems(query: ItemQuery) {
  return useQuery({
    queryKey: itemKeys.list(query),
    queryFn: () => api.items.list(query),
    placeholderData: keepPreviousData, // previous page stays visible while fetching
  });
}

export function useItem(id: string) {
  return useQuery({
    queryKey: itemKeys.detail(id),
    queryFn: () => api.items.get(id),
    enabled: Boolean(id),
  });
}

export function useCreateItem() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateItemPayload) => api.items.create(payload),
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
      queryClient.setQueryData(itemKeys.detail(item.id), item);
      toast.success("Report published", {
        description: "Our matching engine will start looking right away.",
      });
      router.push(ROUTES.item(item.id));
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
