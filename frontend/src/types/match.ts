/** AI matching contracts. */
import type { Entitlements } from "@/types/billing";
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

/**
 * The teaser on a locked card — everything a non-paying viewer receives about
 * the candidate item.
 *
 * Note what is *not* here: title, location, wilaya, date, category. Those are
 * absent from the HTTP response, not merely hidden in the UI. A card blurred
 * with CSS would still have shipped the answer to the browser, where anyone can
 * read it out of the network tab.
 */
export interface MatchPreview {
  /**
   * A ~16px WebP as a `data:` URI — a real photograph reduced past the point of
   * recognition, server-side. This is genuinely all the client has.
   */
  blur_preview: string | null;
  has_photo: boolean;
  /** Reasons being withheld — rendered as "and N more signals". */
  hidden_reason_count: number;
}

export interface MatchSuggestion {
  match_id: string;
  /**
   * True when this viewer has not unlocked this suggestion. The identifying
   * fields below are null in that case — this flag explains the nulls rather
   * than causing them.
   */
  locked: boolean;
  /** Null while locked. */
  candidate_item: MatchCandidateItem | null;
  /** Present only while locked. */
  preview: MatchPreview | null;
  /** Raw feature values — withheld while locked. */
  text_score: number | null;
  image_score: number | null;
  combined_score: number | null;
  /** 0..1 — rendered as a percentage confidence ring. Visible even while locked. */
  confidence: number;
  status: MatchStatus;
  /** While locked, only the reasons that describe strength, not the item. */
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
  /** How many of `matches` are behind the paywall. Drives the panel's banner. */
  locked_count: number;
  /**
   * The viewer's balance and allowance, sent with the panel so the paywall,
   * the price and the button states render without a second request.
   */
  entitlements: Entitlements;
}

export interface MatchFeedbackPayload {
  is_correct: boolean;
  comment?: string;
}
