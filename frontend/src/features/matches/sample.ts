import { useTranslations } from "next-intl";

import type { MatchSuggestion } from "@/types/match";

/**
 * Illustrative suggestion for preview surfaces (dashboard). Clearly labelled as
 * an example wherever rendered.
 *
 * Uses real reason codes rather than the sample sentences, so the preview
 * exercises the same translation path as a live match — a broken reason key
 * shows up here instead of only in production.
 */
export function useSampleMatch(): MatchSuggestion {
  const t = useTranslations("matches");

  return {
    match_id: "sample-match",
    //  Shown unlocked on purpose: this is the dashboard's advertisement for the
    //  tier, and the job of an advertisement is to show what you get, not what
    //  you are missing. The blurred state has its own home on the item page,
    //  where it is answering a question the user actually asked.
    locked: false,
    preview: null,
    candidate_item: {
      id: "sample-candidate",
      type: "found",
      title: t("sampleTitle"),
      primary_image_url: "https://picsum.photos/seed/lf-wallet-found/800/600",
      location_text: t("sampleLocation"),
      wilaya_code: 16,
      event_date: new Date(Date.now() - 86_400_000).toISOString(),
    },
    text_score: 0.83,
    image_score: 0.91,
    combined_score: 0.88,
    confidence: 0.86,
    status: "suggested",
    created_at: new Date().toISOString(),
    explanation: [
      { code: "same_category", params: { name: "Wallets & Purses" } },
      { code: "text_strong" },
      { code: "time_close", params: { days: 1 } },
      { code: "same_wilaya", params: { wilaya_code: 16 } },
    ],
  };
}
