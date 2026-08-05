"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { itemKeys, matchKeys } from "@/lib/query-keys";
import { api } from "@/services";
import type { MatchSuggestions } from "@/types/match";

/** Statuses that mean the engine is still working on this item. */
const IN_FLIGHT = new Set(["pending", "embedding", "matching"]);

/**
 * Suggestions for an item.
 *
 * Polls while the item is mid-pipeline. Matching runs in a worker, so a user who
 * has just filed a report lands on a page with nothing on it — without polling
 * they would have to guess when to reload, and the flagship feature would look
 * absent. Polling stops as soon as the item reaches a terminal state.
 */
export function useItemMatches(itemId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: matchKeys.forItem(itemId),
    queryFn: () => api.matches.forItem(itemId),
    enabled: (options?.enabled ?? true) && Boolean(itemId),
    refetchInterval: (query) => {
      const data = query.state.data as MatchSuggestions | undefined;
      if (!data) return false;
      return IN_FLIGHT.has(data.processing_status) ? 3000 : false;
    },
  });
}

export function useConfirmMatch(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (matchId: string) => api.matches.confirm(matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: matchKeys.forItem(itemId) });
      // Confirming moves both items to `matched`, so the item view is stale too.
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(itemId) });
      toast.success("Match confirmed", {
        description: "We've let the other person know.",
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useRejectMatch(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (matchId: string) => api.matches.reject(matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: matchKeys.forItem(itemId) });
      toast.success("Dismissed", {
        description: "We won't suggest that one again.",
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

/** Force a fresh pass — re-embeds, then re-matches. */
export function useRematch(itemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.matches.rematch(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: matchKeys.forItem(itemId) });
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(itemId) });
    },
    onError: (error) => toast.error(error.message),
  });
}
