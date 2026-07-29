import { request } from "@/services/http/client";
import type { ClaimsApi } from "@/services/contracts";
import type { Claim } from "@/types/claim";

interface ClaimList {
  items: Claim[];
  total: number;
}

export const claimsClient: ClaimsApi = {
  submit: (itemId, payload) =>
    request<Claim>(`/items/${itemId}/claims`, { method: "POST", body: payload }),
  forItem: async (itemId) =>
    (await request<ClaimList>(`/items/${itemId}/claims`)).items,
  mine: async () => (await request<ClaimList>("/claims/mine")).items,
  get: (id) => request<Claim>(`/claims/${id}`),
  approve: (id) => request<Claim>(`/claims/${id}/approve`, { method: "POST" }),
  reject: (id) => request<Claim>(`/claims/${id}/reject`, { method: "POST" }),
  withdraw: (id) => request<Claim>(`/claims/${id}/withdraw`, { method: "POST" }),
};
