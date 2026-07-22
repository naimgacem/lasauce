/**
 * AI matching contracts — typed from docs/api.md today, served by mocks until
 * the matching engine ships (M5). The M5 UI builds against these shapes.
 */
import type { ItemType } from "@/types/item";

export type MatchStatus =
  | "pending"
  | "suggested"
  | "confirmed"
  | "rejected"
  | "expired";

export interface MatchCandidateItem {
  id: string;
  type: ItemType;
  title: string;
  primary_image_url: string | null;
  location_text: string | null;
  event_date: string;
}

export interface MatchSuggestion {
  match_id: string;
  candidate_item: MatchCandidateItem;
  text_score: number;
  image_score: number | null;
  combined_score: number;
  /** 0..1 — rendered as a percentage confidence ring. */
  confidence: number;
  status: MatchStatus;
  /** Human-readable reasons, e.g. "same category", "found 1 day after lost". */
  explanation: string[];
}

export interface MatchSuggestions {
  item: { id: string; type: ItemType; title: string };
  matches: MatchSuggestion[];
}

export interface MatchFeedbackPayload {
  is_correct: boolean;
  comment?: string;
}
