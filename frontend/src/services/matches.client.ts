import { request } from "@/services/http/client";
import type { MatchesApi } from "@/services/contracts";
import type { UnlockResult } from "@/types/billing";
import type { MatchSuggestion, MatchSuggestions } from "@/types/match";

export const matchesClient: MatchesApi = {
  forItem: (itemId) => request<MatchSuggestions>(`/items/${itemId}/matches`),
  get: (id) => request<MatchSuggestion>(`/matches/${id}`),
  unlock: (id) => request<UnlockResult>(`/matches/${id}/unlock`, { method: "POST" }),
  confirm: (id) => request<MatchSuggestion>(`/matches/${id}/confirm`, { method: "POST" }),
  reject: (id) => request<MatchSuggestion>(`/matches/${id}/reject`, { method: "POST" }),
  feedback: (id, payload) =>
    request<void>(`/matches/${id}/feedback`, { method: "POST", body: payload }),
  rematch: (itemId) => request<void>(`/items/${itemId}/rematch`, { method: "POST" }),
};
