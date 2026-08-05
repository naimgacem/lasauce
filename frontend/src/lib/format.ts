/**
 * Formatting helpers — locale-aware and SSR-safe.
 *
 * Every function takes an explicit `locale`. Passing `undefined` to `Intl` reads
 * the *runtime's* locale, which is the container's on the server and the user's
 * OS on the client — the two disagree and React reports a hydration mismatch.
 * The timezone is pinned for the same reason.
 */

const TIME_ZONE = "Africa/Algiers";

/** Maps an app locale to a BCP-47 tag with the right regional conventions. */
function intlLocale(locale: string): string {
  switch (locale) {
    // Arabic with Western (Latin) digits: Algerian Arabic writing overwhelmingly
    // uses 0-9 rather than the Eastern Arabic numerals `ar` would default to.
    case "ar":
      return "ar-DZ-u-nu-latn";
    case "en":
      return "en-GB";
    default:
      return "fr-DZ";
  }
}

export function formatDate(
  iso: string | null | undefined,
  locale = "fr",
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(intlLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: TIME_ZONE,
  });
}

/** Compact relative time, e.g. "3 days ago" / "il y a 3 jours". */
export function formatRelative(
  iso: string | null | undefined,
  locale = "fr",
): string {
  if (!iso) return "—";
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return "—";

  const diffSec = Math.round((date - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), {
    numeric: "auto",
  });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
    ["second", 1],
  ];
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(diffSec) >= secondsInUnit || unit === "second") {
      return rtf.format(Math.round(diffSec / secondsInUnit), unit);
    }
  }
  return rtf.format(0, "second");
}

export function formatNumber(value: number, locale = "fr"): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

/** 0.86 → "86%" — for AI match confidence. */
export function formatConfidence(score: number, locale = "fr"): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(score);
}

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Initials for an avatar fallback, e.g. "Amina Bouzid" → "AB". */
export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
