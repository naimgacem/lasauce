import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * The mark is the "s" of sabtou ("I found it") drawn as one winding trail that
 * ends at a mint point: the search, and the moment it finds something.
 * Colours are fixed rather than themed — a logo that inverts with the theme
 * stops being recognisable. Keep in sync with app/icon.svg and apple-icon.png.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-6 w-6 shrink-0", className)}
      aria-hidden
      focusable="false"
    >
      <rect width="32" height="32" rx="8" fill="#1F4C36" />
      <path
        d="M9 23.5H18.5A3.5 3.5 0 0 0 18.5 16.5H13.5A3.5 3.5 0 0 1 13.5 9.5H17"
        fill="none"
        stroke="#F7F7F2"
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22.8" cy="9.5" r="2.5" fill="#7FD3A8" />
    </svg>
  );
}

export function Logo({
  href = "/",
  withWordmark = true,
  className,
}: {
  href?: string;
  withWordmark?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");

  return (
    <Link
      href={href}
      // The wordmark is Latin in every locale, so it keeps LTR order even on
      // the Arabic page.
      dir="ltr"
      aria-label={withWordmark ? undefined : t("appName")}
      className={cn(
        // Pinned to Geist: the wordmark is a logo, so it stays the same shape
        // on the Arabic pages, where the body face changes.
        "flex shrink-0 items-center gap-2 rounded-md text-[1.0625rem] font-semibold tracking-[-0.02em] [font-family:var(--font-geist-sans)]",
        className,
      )}
    >
      <LogoMark />
      {withWordmark ? <span>{t("appName")}</span> : null}
    </Link>
  );
}
