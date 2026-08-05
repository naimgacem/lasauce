/** AI matching contracts. */
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
  /** Storage key or absolute URL — resolve through `imageUrl()`. */
  primary_image_url: string | null;
  location_text: string | null;
  wilaya_code: number | null;
  event_date: string;
}

/**
 * One explanation bullet, as a translation key plus its values.
 *
 * The backend sends codes rather than sentences: a match is scored once, by a
 * worker that cannot know whether the reader speaks Arabic, French or English.
 * Wording belongs to whoever renders it.
 */
export interface MatchReason {
  code: string;
  params?: Record<string, string | number>;
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
  explanation: MatchReason[];
  created_at: string;
}

export interface MatchSuggestions {
  item: { id: string; type: ItemType; title: string };
  matches: MatchSuggestion[];
  /**
   * Mirrors the item's `processing_status`. Without it an empty list is
   * ambiguous — "nothing matched" and "still looking" render very differently.
   */
  processing_status: string;
}

export interface MatchFeedbackPayload {
  is_correct: boolean;
  comment?: string;
}
