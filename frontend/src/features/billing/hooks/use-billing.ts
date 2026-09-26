"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { billingKeys, matchKeys } from "@/lib/query-keys";
import { api } from "@/services";
import { ApiError } from "@/types/api";
import type { Payment } from "@/types/billing";

/** Statuses the gateway may still move away from. */
const PENDING_STATUSES = new Set<Payment["status"]>(["pending"]);

/** The price ladder. Static per deploy, so it caches for the session. */
export function usePacks() {
  return useQuery({
    queryKey: billingKeys.packs(),
    queryFn: () => api.billing.packs(),
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Balance and free allowance.
 *
 * The match panel already receives entitlements inline, so this exists for the
 * surfaces that show a balance *without* loading a panel — the header chip and
 * the billing page.
 */
export function useEntitlements(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: billingKeys.entitlements(),
    queryFn: () => api.billing.entitlements(),
    enabled: options?.enabled ?? true,
  });
}

export function usePayments() {
  return useQuery({
    queryKey: billingKeys.payments(),
    queryFn: () => api.billing.payments(),
  });
}

/**
 * One payment, polled while the gateway has not yet reported a verdict.
 *
 * Polling — rather than trusting the `success_url` we were redirected to — is
 * the whole point of this hook. That URL proves a browser followed a link; it
 * can be retyped, shared, or reached with the Back button. Credits appear only
 * when a signed webhook has told the backend the money moved, and this is how
 * the page finds out that happened.
 */
export function usePayment(paymentId: string | null) {
  return useQuery({
    queryKey: billingKeys.payment(paymentId ?? ""),
    queryFn: () => api.billing.payment(paymentId as string),
    enabled: Boolean(paymentId),
    refetchInterval: (query) => {
      const data = query.state.data as Payment | undefined;
      if (!data) return 2000;
      return PENDING_STATUSES.has(data.status) ? 2000 : false;
    },
  });
}

/** Buy a pack: create the checkout, then hand the browser to the gateway. */
export function useCheckout() {
  const locale = useLocale();
  const t = useTranslations("billing");

  return useMutation({
    mutationFn: (packId: string) =>
      api.billing.checkout({ pack_id: packId, locale }),
    onSuccess: (checkout) => {
      //  `assign`, not `replace`: leaving the app in history means a customer
      //  who abandons the gateway page can press Back and still be where they
      //  started, rather than on a dead entry.
      window.location.assign(checkout.checkout_url);
    },
    onError: (error) => toast.error(t("checkoutFailed"), {
      description: error instanceof ApiError ? error.message : undefined,
    }),
  });
}

/** Dev-only settlement for the `manual` provider. */
export function useSimulatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (paymentId: string) => api.billing.simulate(paymentId),
    onSuccess: (payment) => {
      queryClient.setQueryData(billingKeys.payment(payment.id), payment);
      queryClient.invalidateQueries({ queryKey: billingKeys.entitlements() });
      queryClient.invalidateQueries({ queryKey: billingKeys.payments() });
      //  Credits just landed, so every locked card's button changes state.
      queryClient.invalidateQueries({ queryKey: matchKeys.all });
    },
    onError: (error) => toast.error(error.message),
  });
}

/**
 * Spend a credit to reveal one suggestion.
 *
 * `onInsufficientCredit` is called instead of a toast when the API answers 402.
 * Running out of credits is not an error — it is the moment the product is
 * meant to sell something — so it opens the paywall rather than flashing red.
 */
export function useUnlockMatch(
  itemId: string,
  options?: { onInsufficientCredit?: () => void },
) {
  const queryClient = useQueryClient();
  const t = useTranslations("billing");

  return useMutation({
    mutationFn: (matchId: string) => api.matches.unlock(matchId),
    onSuccess: (result) => {
      //  Written straight into the cache: the header chip must change in the
      //  same paint as the card that just opened.
      queryClient.setQueryData(billingKeys.entitlements(), result.entitlements);
      queryClient.invalidateQueries({ queryKey: matchKeys.forItem(itemId) });
      queryClient.invalidateQueries({ queryKey: billingKeys.entitlements() });

      toast.success(
        result.source === "free_allowance" ? t("unlockedFree") : t("unlocked"),
      );
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 402) {
        options?.onInsufficientCredit?.();
        return;
      }
      toast.error(error.message);
    },
  });
}
