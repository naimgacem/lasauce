"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Gem, Sparkles } from "lucide-react";

import { useEntitlements } from "@/features/billing/hooks/use-billing";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * The credit chip — a link to the billing page showing what the viewer holds.
 *
 * Renders nothing at all when the paywall is off (flag disabled, or the viewer
 * is an admin) and nothing while loading. A balance that pops in a beat after
 * the header paints is worse than one that was never there: it shifts the nav
 * sideways on every page load.
 */
export function CreditBalance({ className }: { className?: string }) {
  const t = useTranslations("billing");
  const { data } = useEntitlements();

  if (!data?.paywall_enabled) return null;

  // The free unlock is the more useful thing to advertise while it lasts — it
  // is the offer, whereas "0 credits" is just an absence.
  const showFree = data.free_unlocks_remaining > 0;

  return (
    <Link
      href={ROUTES.billing}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        showFree
          ? "border-premium-ink/35 bg-premium-muted text-premium-ink hover:bg-premium-muted/70"
          : "border-border text-muted-foreground hover:bg-accent",
        className,
      )}
      aria-label={
        showFree
          ? t("freeUnlocksAria", { count: data.free_unlocks_remaining })
          : t("balanceAria", { count: data.balance })
      }
    >
      {showFree ? (
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Gem className="h-3.5 w-3.5" aria-hidden />
      )}
      <span className="tabular-nums">
        {showFree
          ? t("freeChip", { count: data.free_unlocks_remaining })
          : data.balance}
      </span>
    </Link>
  );
}
