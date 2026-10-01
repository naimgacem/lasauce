"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { adminKeys } from "@/lib/query-keys";
import { api } from "@/services";
import type {
  AdminActionQuery,
  AdminItemQuery,
  AdminMatchQuery,
  AdminPaymentQuery,
  AdminUserQuery,
} from "@/types/admin";

/**
 * Read side of the console. Lists keep the previous page on screen while the
 * next one loads, so paging and filtering never flash an empty table.
 */

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: () => api.admin.stats(),
    //  The overview is often left open on a second screen; a minute keeps the
    //  pipeline figures honest without polling hard.
    refetchInterval: 60_000,
  });
}

export function useAdminUsers(query: AdminUserQuery) {
  return useQuery({
    queryKey: adminKeys.users(query),
    queryFn: () => api.admin.users(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: adminKeys.user(id),
    queryFn: () => api.admin.user(id),
    enabled: Boolean(id),
  });
}

export function useAdminItems(query: AdminItemQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: adminKeys.items(query),
    queryFn: () => api.admin.items(query),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useAdminItem(id: string) {
  return useQuery({
    queryKey: adminKeys.item(id),
    queryFn: () => api.admin.item(id),
    enabled: Boolean(id),
  });
}

export function useAdminMatches(query: AdminMatchQuery) {
  return useQuery({
    queryKey: adminKeys.matches(query),
    queryFn: () => api.admin.matches(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminPayments(query: AdminPaymentQuery) {
  return useQuery({
    queryKey: adminKeys.payments(query),
    queryFn: () => api.admin.payments(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminPayment(id: string | null) {
  return useQuery({
    queryKey: adminKeys.payment(id ?? ""),
    queryFn: () => api.admin.payment(id as string),
    enabled: Boolean(id),
  });
}

export function useAdminActions(query: AdminActionQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: adminKeys.actions(query),
    queryFn: () => api.admin.actions(query),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}
