"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Gem, ShieldCheck } from "lucide-react";

import { Spinner } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PackCard } from "@/features/billing/components/pack-card";
import { useCheckout, usePacks } from "@/features/billing/hooks/use-billing";

/**
 * The paywall. Opened when an unlock returns 402 — never on page load.
 *
 * The trigger matters more than the design. A dialog that appears because the
 * user *tried to do something* is answering a question they just asked; the same
 * dialog on arrival is an interruption, and it trains people to dismiss it
 * before reading. So this is mounted by the match panel and opened only from
 * the `onInsufficientCredit` branch of the unlock mutation.
 */
export function PaywallDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("billing");
  const { data: packs, isPending } = usePacks();
  const checkout = useCheckout();
  const [selected, setSelected] = useState<string | null>(null);

  // Default to whichever pack the backend marks as best value, once loaded.
  // Preselecting means the primary button is live on the first frame the user
  // sees it, rather than disabled until they interact.
  useEffect(() => {
    if (!selected && packs?.length) {
      setSelected((packs.find((p) => p.highlighted) ?? packs[0]).id);
    }
  }, [packs, selected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <span className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-premium-muted sm:mx-0">
            <Gem className="h-5 w-5 text-premium-ink" aria-hidden />
          </span>
          <DialogTitle>{t("paywallTitle")}</DialogTitle>
          <DialogDescription>{t("paywallBody")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          {isPending || !packs ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[5.5rem] w-full rounded-xl" />
            ))
          ) : (
            <fieldset className="space-y-2.5">
              <legend className="sr-only">{t("choosePack")}</legend>
              {packs.map((pack) => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  selected={selected === pack.id}
                  onSelect={setSelected}
                />
              ))}
            </fieldset>
          )}
        </div>

        <Button
          size="lg"
          variant="premium"
          className="w-full"
          disabled={!selected || checkout.isPending}
          onClick={() => selected && checkout.mutate(selected)}
        >
          {checkout.isPending ? <Spinner /> : null}
          {t("continueToPayment")}
        </Button>

        {/* Two facts, stated plainly. Both are the objections a first-time
            buyer on a small platform actually has — "will this expire?" and
            "who is taking my card details?" — and answering them here costs
            two lines. */}
        <div className="space-y-1.5 text-caption text-muted-foreground">
          <p className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            {t("securePayment")}
          </p>
          <p className="text-center">{t("creditsNeverExpire")}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
