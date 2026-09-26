"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { m } from "framer-motion";
import { Check, Gem, Receipt, Sparkles, X } from "lucide-react";

import { listContainer, listItem } from "@/animations";
import { EmptyState } from "@/components/feedback/empty-state";
import { Spinner } from "@/components/feedback/loading";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PackCard } from "@/features/billing/components/pack-card";
import {
  useCheckout,
  useEntitlements,
  usePacks,
  usePayments,
} from "@/features/billing/hooks/use-billing";
import { formatDate, formatPrice } from "@/lib/format";
import type { PaymentStatus } from "@/types/billing";

const STATUS_VARIANT: Record<PaymentStatus, "found-soft" | "secondary" | "destructive"> = {
  paid: "found-soft",
  pending: "secondary",
  failed: "destructive",
  canceled: "secondary",
  expired: "secondary",
};

/**
 * Pricing and purchase history.
 *
 * Reachable from the credit chip in the header and from the paywall's footer,
 * but deliberately *not* from the main nav: a lost-and-found platform whose
 * primary navigation advertises a shop reads as a shop. The page exists for
 * people who went looking for it.
 */
export default function BillingPage() {
  const t = useTranslations("billing");
  const locale = useLocale();

  const { data: packs, isPending: packsPending } = usePacks();
  const { data: entitlements } = useEntitlements();
  const { data: payments, isPending: paymentsPending } = usePayments();
  const checkout = useCheckout();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selected && packs?.length) {
      setSelected((packs.find((p) => p.highlighted) ?? packs[0]).id);
    }
  }, [packs, selected]);

  const hasFree = (entitlements?.free_unlocks_remaining ?? 0) > 0;

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} description={t("subtitle")} />

      {/* Balance first. Someone arriving from the header chip came to check a
          number, and making them read a pricing table to find it would be
          answering a question they did not ask. */}
      <Card className="ring-premium shadow-premium border-0 p-px">
        <div className="rounded-[calc(1rem-1px)] bg-card">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div className="space-y-1">
              <CardDescription className="text-overline uppercase">
                {t("yourBalance")}
              </CardDescription>
              <div className="flex items-baseline gap-2">
                <span className="text-display tabular-nums leading-none">
                  {entitlements ? entitlements.balance : "—"}
                </span>
                <span className="text-body-sm text-muted-foreground">
                  {t("creditsLabel", { count: entitlements?.balance ?? 0 })}
                </span>
              </div>
              {hasFree ? (
                <p className="flex items-center gap-1.5 pt-1 text-body-sm text-premium-ink">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  {t("freeRemaining", {
                    count: entitlements?.free_unlocks_remaining ?? 0,
                  })}
                </p>
              ) : null}
            </div>
            <Gem className="h-8 w-8 text-premium-ink/50" aria-hidden />
          </CardHeader>
        </div>
      </Card>

      {/* Pricing */}
      <section aria-labelledby="packs-heading" className="space-y-3">
        <div>
          <h2 id="packs-heading" className="text-lg font-semibold">
            {t("buyCredits")}
          </h2>
          <p className="text-body-sm text-muted-foreground">
            {t("creditsNeverExpire")}
          </p>
        </div>

        {packsPending || !packs ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[7rem] w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <fieldset>
            <legend className="sr-only">{t("choosePack")}</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {packs.map((pack) => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  selected={selected === pack.id}
                  onSelect={setSelected}
                  name="billing-page-pack"
                />
              ))}
            </div>
          </fieldset>
        )}

        <Button
          size="lg"
          className="w-full bg-premium-gradient text-premium-foreground hover:opacity-90 sm:w-auto"
          disabled={!selected || checkout.isPending}
          onClick={() => selected && checkout.mutate(selected)}
        >
          {checkout.isPending ? <Spinner /> : null}
          {t("continueToPayment")}
        </Button>
      </section>

      {/* History */}
      <section aria-labelledby="history-heading" className="space-y-3">
        <h2 id="history-heading" className="text-lg font-semibold">
          {t("history")}
        </h2>

        {paymentsPending ? (
          <div className="space-y-2.5" aria-busy>
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : !payments?.length ? (
          <EmptyState
            icon={Receipt}
            title={t("noPayments")}
            description={t("noPaymentsBody")}
          />
        ) : (
          <m.ul
            variants={listContainer}
            initial="initial"
            animate="enter"
            className="space-y-2.5"
          >
            {payments.map((payment) => (
              <m.li key={payment.id} variants={listItem}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      {/* Described by credit count, not by `packs.<id>`: a pack
                          retired from the catalogue still has receipts, and
                          keying an old purchase to a translation that no longer
                          exists would render the key path to the customer. */}
                      <CardTitle className="text-body-sm font-medium">
                        {t("creditsPurchased", { count: payment.credits })}
                      </CardTitle>
                      <p className="text-caption text-muted-foreground">
                        {formatDate(payment.created_at, locale)}
                      </p>
                      {payment.failure_reason ? (
                        <p className="text-caption text-destructive">
                          {payment.failure_reason}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="tabular-nums">
                        {formatPrice(payment.amount, payment.currency, locale)}
                      </span>
                      <Badge variant={STATUS_VARIANT[payment.status]}>
                        {payment.status === "paid" ? (
                          <Check className="h-3 w-3" aria-hidden />
                        ) : payment.status === "failed" ? (
                          <X className="h-3 w-3" aria-hidden />
                        ) : null}
                        {t(`status.${payment.status}`)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </m.li>
            ))}
          </m.ul>
        )}
      </section>
    </div>
  );
}
