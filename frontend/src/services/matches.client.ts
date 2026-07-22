import { request } from "@/services/http/client";
import type { MatchesApi } from "@/services/contracts";
import type { MatchSuggestion, MatchSuggestions } from "@/types/match";

/** Typed against docs/api.md — the backend ships these endpoints at M5. */
export const matchesClient: MatchesApi = {
  forItem: (itemId) => request<MatchSuggestions>(`/items/${itemId}/matches`),
  get: (id) => request<MatchSuggestion>(`/matches/${id}`),
  confirm: (id) => request<void>(`/matches/${id}/confirm`, { method: "POST" }),
  reject: (id) => request<void>(`/matches/${id}/reject`, { method: "POST" }),
  feedback: (id, payload) =>
    request<void>(`/matches/${id}/feedback`, { method: "POST", body: payload }),
};
