/** Formatting helpers — locale-aware, SSR-safe. */

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Compact relative time, e.g. "3 days ago". */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return "—";

  const diffSec = Math.round((date - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
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
  return "just now";
}

/** 0.86 → "86%" — for AI match confidence. */
export function formatConfidence(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
