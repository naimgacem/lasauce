"use client";

import { useTranslations } from "next-intl";

import { adminKeys } from "@/lib/query-keys";
import { api } from "@/services";
import type { AdminUserPatch, CreditGrantPayload, ItemClosePayload } from "@/types/admin";

import { useAdminMutation } from "./use-admin-mutation";

/** Write side of the console. Every call here lands in the audit log server-side. */

export function useUpdateUser(userId: string) {
  const t = useTranslations("admin.toasts");
  return useAdminMutation({
    mutationFn: (patch: AdminUserPatch) => api.admin.updateUser(userId, patch),
    detailKey: () => adminKeys.user(userId),
    successMessage: t("userUpdated"),
  });
}

export function useGrantCredits(userId: string) {
  const t = useTranslations("admin.toasts");
  return useAdminMutation({
    mutationFn: (payload: CreditGrantPayload) => api.admin.grantCredits(userId, payload),
    detailKey: () => adminKeys.user(userId),
    successMessage: t("creditsGranted"),
  });
}

export function useCloseItem(itemId: string) {
  const t = useTranslations("admin.toasts");
  return useAdminMutation({
    mutationFn: (payload: ItemClosePayload) => api.admin.closeItem(itemId, payload),
    detailKey: () => adminKeys.item(itemId),
    successMessage: t("itemClosed"),
  });
}

export function useReopenItem(itemId: string) {
  const t = useTranslations("admin.toasts");
  return useAdminMutation({
    mutationFn: (note?: string) => api.admin.reopenItem(itemId, note),
    detailKey: () => adminKeys.item(itemId),
    successMessage: t("itemReopened"),
  });
}

export function useReprocessItem(itemId: string) {
  const t = useTranslations("admin.toasts");
  return useAdminMutation({
    mutationFn: () => api.admin.reprocessItem(itemId),
    detailKey: () => adminKeys.item(itemId),
    successMessage: t("itemRequeued"),
  });
}

export function useDeleteItemImage(itemId: string) {
  const t = useTranslations("admin.toasts");
  return useAdminMutation({
    mutationFn: ({ imageId, reason }: { imageId: string; reason?: string }) =>
      api.admin.deleteImage(itemId, imageId, reason),
    detailKey: () => adminKeys.item(itemId),
    successMessage: t("photoRemoved"),
  });
}

export function useRetractMatch() {
  const t = useTranslations("admin.toasts");
  return useAdminMutation({
    mutationFn: ({ matchId, note }: { matchId: string; note?: string }) =>
      api.admin.retractMatch(matchId, note),
    successMessage: t("matchRetracted"),
  });
}

export function useRetryFailed() {
  const t = useTranslations("admin.toasts");
  return useAdminMutation({
    mutationFn: () => api.admin.retryFailed(),
    successMessage: (result) => t("failedRequeued", { count: result.requeued }),
  });
}
