import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * The mark is the wordmark's own "l’": a stem, and an apostrophe that doubles
 * as a dropped pin. Colours are fixed rather than themed — a logo that inverts
 * with the theme stops being recognisable. Keep in sync with app/icon.svg.
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
      <rect x="9.2" y="6.5" width="4.6" height="19" rx="2.3" fill="#F7F7F2" />
      <circle cx="20.2" cy="10" r="2.75" fill="#7FD3A8" />
      <path
        d="M22.95 10C22.95 13.3 21.3 15.5 18.6 16.7L17.9 15.55C19.5 14.65 20.4 13.45 20.55 12.2Z"
        fill="#7FD3A8"
      />
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
