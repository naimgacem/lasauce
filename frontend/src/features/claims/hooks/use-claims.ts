"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { claimKeys, itemKeys, notificationKeys } from "@/lib/query-keys";
import { api } from "@/services";
import type { CreateClaimPayload } from "@/types/claim";

/** Claims on an item I reported. Owner-only server-side; 403 for anyone else. */
export function useItemClaims(itemId: string, enabled: boolean) {
  return useQuery({
    queryKey: claimKeys.forItem(itemId),
    queryFn: () => api.claims.forItem(itemId),
    enabled: enabled && Boolean(itemId),
  });
}

/** Claims I have submitted on other people's items. */
export function useMyClaims(enabled = true) {
  return useQuery({
    queryKey: claimKeys.mine(),
    queryFn: () => api.claims.mine(),
    enabled,
  });
}

/** Invalidate everything a claim transition can affect. */
function useClaimInvalidator() {
  const queryClient = useQueryClient();
  return (itemId?: string) => {
    queryClient.invalidateQueries({ queryKey: claimKeys.all });
    queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    if (itemId) {
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(itemId) });
      queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
    }
  };
}

export function useSubmitClaim(itemId: string) {
  const invalidate = useClaimInvalidator();

  return useMutation({
    mutationFn: (payload: CreateClaimPayload) => api.claims.submit(itemId, payload),
    onSuccess: () => {
      invalidate(itemId);
      toast.success("Claim sent", {
        description:
          "The reporter will review your answers. We'll notify you either way.",
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useApproveClaim(itemId: string) {
  const invalidate = useClaimInvalidator();

  return useMutation({
    mutationFn: (claimId: string) => api.claims.approve(claimId),
    onSuccess: () => {
      invalidate(itemId);
      toast.success("Claim approved", {
        description: "Contact details are now shared with both of you.",
      });
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useRejectClaim(itemId: string) {
  const invalidate = useClaimInvalidator();

  return useMutation({
    mutationFn: (claimId: string) => api.claims.reject(claimId),
    onSuccess: () => {
      invalidate(itemId);
      toast.success("Claim rejected.");
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useWithdrawClaim(itemId: string) {
  const invalidate = useClaimInvalidator();

  return useMutation({
    mutationFn: (claimId: string) => api.claims.withdraw(claimId),
    onSuccess: () => {
      invalidate(itemId);
      toast.success("Claim withdrawn.");
    },
    onError: (error) => toast.error(error.message),
  });
}
