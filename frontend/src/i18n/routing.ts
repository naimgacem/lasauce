import { defineRouting } from "next-intl/routing";

export const LOCALES = ["fr", "ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Right-to-left locales — drives `dir` on <html> and the logical-property CSS. */
const RTL_LOCALES = new Set<Locale>(["ar"]);

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.has(locale as Locale);
}

export function dirFor(locale: string): "rtl" | "ltr" {
  return isRtl(locale) ? "rtl" : "ltr";
}

/** Human labels for the language switcher, each written in its own language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  fr: "Français",
  ar: "العربية",
  en: "English",
};

export const routing = defineRouting({
  locales: LOCALES,
  // French is the working language of Algerian administration and the most
  // common written language online here — it is the safest default for a
  // first-time visitor with no stored preference.
  defaultLocale: "fr",
  // Always prefix, including the default. Ambiguous URLs (/lost meaning "some
  // locale") would undo the canonical-URL work: every page must have exactly
  // one address per language.
  localePrefix: "always",
});

/**
 * Narrow a route param to a known locale.
 *
 * Next's generated route validator types `params.locale` as `string`, but the
 * layout has already rejected unknown locales via `notFound()`, so by the time
 * any page runs the value is always valid. This makes that fact type-level.
 */
export function asLocale(value: string): Locale {
  return (LOCALES as readonly string[]).includes(value)
    ? (value as Locale)
    : routing.defaultLocale;
}
