"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CheckCircle2, Clock, Gem, XCircle } from "lucide-react";

import { Spinner } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  usePayment,
  useSimulatePayment,
} from "@/features/billing/hooks/use-billing";
import { ROUTES } from "@/lib/routes";

/**
 * Where the payment gateway sends the customer back.
 *
 * **This page never decides whether a payment succeeded.** It reads the answer
 * from our own API and polls until the status is terminal. The URL it was
 * reached by carries no authority: `success_url` and `failure_url` are just
 * links, and a link can be retyped, bookmarked, shared, or reached with the
 * Back button. Credits appear when a signed webhook says money moved — which
 * may also be a second or two *after* the redirect, since the gateway sends the
 * customer home and calls us on a separate connection. Hence the polling, and
 * hence the honest "confirming…" state instead of a premature tick.
 *
 * The `failed=1` parameter is treated as a hint about what to expect, never as
 * a verdict: a customer who paid and then hit a flaky redirect must not be told
 * their payment failed.
 */
export default function BillingReturnPage() {
  const t = useTranslations("billing");
  const params = useSearchParams();
  const paymentId = params.get("payment");
  //  `manual` provider only — the dev loop that lets the whole purchase flow be
  //  exercised without a gateway account. The endpoint behind it is refused in
  //  production, so a stray link here can never mint real credits.
  const simulated = params.get("simulated") === "1";

  const { data: payment, isPending } = usePayment(paymentId);
  const simulate = useSimulatePayment();

  const status = payment?.status;
  const settling = isPending || status === "pending";

  return (
    <div className="mx-auto flex max-w-container-form flex-col justify-center py-12">
      <Card className="ring-premium shadow-premium border-0 p-px">
        <div className="rounded-[calc(1rem-1px)] bg-card">
          <CardHeader className="items-center text-center">
            <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-premium-muted">
              {status === "paid" ? (
                <CheckCircle2 className="h-6 w-6 text-found" aria-hidden />
              ) : status && status !== "pending" ? (
                <XCircle className="h-6 w-6 text-muted-foreground" aria-hidden />
              ) : (
                <Clock className="h-6 w-6 text-premium-ink" aria-hidden />
              )}
            </span>
            <CardTitle>
              {!paymentId
                ? t("returnMissingTitle")
                : status === "paid"
                  ? t("returnPaidTitle")
                  : settling
                    ? t("returnPendingTitle")
                    : t("returnFailedTitle")}
            </CardTitle>
            <CardDescription>
              {!paymentId
                ? t("returnMissingBody")
                : status === "paid"
                  ? t("returnPaidBody", { count: payment?.credits ?? 0 })
                  : settling
                    ? t("returnPendingBody")
                    : (payment?.failure_reason ?? t("returnFailedBody"))}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {settling && paymentId ? (
              <div className="flex items-center justify-center gap-2 text-body-sm text-muted-foreground">
                <Spinner />
                {t("returnChecking")}
              </div>
            ) : null}

            {/* Dev-only settlement control. Rendered from the payment's own
                `provider` field rather than from an env var, so it cannot
                appear next to a real Chargily checkout. */}
            {simulated && payment?.provider === "manual" && status === "pending" ? (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => simulate.mutate(payment.id)}
                disabled={simulate.isPending}
              >
                {simulate.isPending ? <Spinner /> : <Gem className="h-4 w-4" />}
                {t("simulatePayment")}
              </Button>
            ) : null}

            <Button
              asChild
              className={
                status === "paid"
                  ? "w-full bg-premium-gradient text-premium-foreground hover:opacity-90"
                  : "w-full"
              }
              variant={status === "paid" ? "default" : "outline"}
            >
              <Link href={status === "paid" ? ROUTES.myItems : ROUTES.billing}>
                {status === "paid" ? t("returnToMatches") : t("backToBilling")}
              </Link>
            </Button>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}
