"use client";

import { useLocale, useTranslations } from "next-intl";

import { wilayaName } from "@/lib/algeria-wilayas";
import type { MatchReason } from "@/types/match";

/**
 * Renders a backend reason code as a sentence in the reader's language.
 *
 * Two codes need local knowledge the backend deliberately does not have:
 * `same_wilaya` arrives as a numeric code because wilaya names are localised
 * here, and `same_category` falls back to a generic phrase when the category was
 * unnamed, since "Same category — undefined" is worse than saying less.
 */
export function useMatchReason(): (reason: MatchReason) => string {
  const t = useTranslations("matches.reasons");
  const locale = useLocale();

  return (reason: MatchReason) => {
    const params = reason.params ?? {};

    if (reason.code === "same_wilaya") {
      const name = wilayaName(Number(params.wilaya_code), locale);
      // An unknown code has no sensible generic phrasing — "same wilaya" with
      // no wilaya says nothing, so drop the bullet.
      return name ? t("same_wilaya", { wilaya: name }) : "";
    }

    if (reason.code === "same_category" && !params.name) {
      return t("same_category_generic");
    }

    // An unrecognised code means the backend shipped a new reason ahead of the
    // translations. Dropping the bullet is better than rendering a raw key.
    try {
      return t(reason.code as never, params as never);
    } catch {
      return "";
    }
  };
}
