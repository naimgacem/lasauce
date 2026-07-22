import type { MatchSuggestion } from "@/types/match";

/**
 * Illustrative suggestion for preview surfaces (dashboard) while the matching
 * engine is pre-launch. Clearly labelled as an example wherever rendered.
 */
export const SAMPLE_MATCH: MatchSuggestion = {
  match_id: "sample-match",
  candidate_item: {
    id: "sample-candidate",
    type: "found",
    title: "Dark bifold wallet, found at bus stop",
    primary_image_url: "https://picsum.photos/seed/lf-wallet-found/800/600",
    location_text: "Main St bus stop",
    event_date: new Date(Date.now() - 86_400_000).toISOString(),
  },
  text_score: 0.83,
  image_score: 0.91,
  combined_score: 0.88,
  confidence: 0.86,
  status: "suggested",
  explanation: [
    "Same category — wallets & purses",
    "Image strongly similar",
    "Found 1 day after it was lost",
    "300 m from the reported location",
  ],
};
