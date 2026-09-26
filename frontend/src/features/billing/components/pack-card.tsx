"use client";

import { useLocale, useTranslations } from "next-intl";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CreditPack } from "@/types/billing";

/**
 * Catalogue ids the message files carry a label for.
 *
 * The catalogue lives on the server, so `pack.id` is a plain string here and an
 * id we have no label for is a real possibility — the backend can ship a new
 * pack before this app redeploys. Rather than rendering a raw key path at a
 * customer, an unrecognised pack falls back to describing itself by credit
 * count, which is true of every pack that will ever exist.
 */
const PACK_LABEL_KEYS = {
  single: "packs.single",
  trio: "packs.trio",
  ten: "packs.ten",
} as const;

function packLabelKey(id: string): (typeof PACK_LABEL_KEYS)[keyof typeof PACK_LABEL_KEYS] | null {
  return id in PACK_LABEL_KEYS
    ? PACK_LABEL_KEYS[id as keyof typeof PACK_LABEL_KEYS]
    : null;
}

/**
 * One pack in the ladder, as a radio option.
 *
 * A `<label>` wrapping a visually-hidden `<input type="radio">` rather than a
 * div with an onClick: this is a single-choice group, and using the real
 * control means arrow keys move between packs, the selection is announced as
 * "2 of 3", and the whole card is a click target — none of which a div can be
 * argued into doing correctly.
 */
export function PackCard({
  pack,
  selected,
  onSelect,
  name = "credit-pack",
}: {
  pack: CreditPack;
  selected: boolean;
  onSelect: (packId: string) => void;
  name?: string;
}) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const labelKey = packLabelKey(pack.id);

  return (
    <label
      className={cn(
        "relative flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-all",
        "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        selected
          ? "border-premium-ink/50 bg-premium-muted/60 shadow-sm"
          : "border-border hover:border-premium-ink/30 hover:bg-accent/40",
      )}
    >
      <input
        type="radio"
        name={name}
        value={pack.id}
        checked={selected}
        onChange={() => onSelect(pack.id)}
        className="sr-only"
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold leading-snug">
            {labelKey
              ? t(labelKey)
              : t("creditsPurchased", { count: pack.credits })}
          </p>
          <p className="text-caption text-muted-foreground">
            {t("perUnlock", {
              price: formatPrice(
                Math.round(pack.unit_amount),
                pack.currency,
                locale,
              ),
            })}
          </p>
        </div>
        {selected ? (
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-premium-gradient">
            <Check
              className="h-3 w-3 text-premium-foreground"
              strokeWidth={3}
              aria-hidden
            />
          </span>
        ) : (
          <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-border" />
        )}
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-heading-3 tabular-nums">
          {formatPrice(pack.amount, pack.currency, locale)}
        </span>
        {/* The saving is stated as a percentage against buying singles — the
            comparison the buyer would otherwise have to do in their head. */}
        {pack.savings_percent > 0 ? (
          <Badge variant="premium">
            {t("savePercent", { percent: pack.savings_percent })}
          </Badge>
        ) : null}
      </div>

      {pack.highlighted ? (
        <span className="absolute -top-2 end-3 rounded-full bg-premium-gradient px-2 py-0.5 text-[0.625rem] font-medium uppercase tracking-[0.08em] text-premium-foreground">
          {t("bestValue")}
        </span>
      ) : null}
    </label>
  );
}
