import { LOCALES } from "@/i18n/routing";

/**
 * Canonical + hreflang block for a page.
 *
 * Next REPLACES the parent's `alternates` when a child sets one, so a page that
 * declares only a canonical silently drops the hreflang links inherited from
 * the layout. Building both together here makes that impossible to forget.
 */
export function localeAlternates(locale: string, path = "") {
  return {
    canonical: `/${locale}${path}`,
    languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}${path}`])),
  };
}
