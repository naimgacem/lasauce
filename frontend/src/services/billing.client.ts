import { request } from "@/services/http/client";
import type { BillingApi } from "@/services/contracts";
import type {
  Checkout,
  CreditPack,
  Entitlements,
  Payment,
} from "@/types/billing";

export const billingClient: BillingApi = {
  packs: () => request<CreditPack[]>("/billing/packs"),
  entitlements: () => request<Entitlements>("/billing/entitlements"),
  checkout: (payload) =>
    request<Checkout>("/billing/checkout", { method: "POST", body: payload }),
  payments: () => request<Payment[]>("/billing/payments"),
  payment: (id) => request<Payment>(`/billing/payments/${id}`),
  simulate: (id) =>
    request<Payment>(`/billing/payments/${id}/simulate`, { method: "POST" }),
};
