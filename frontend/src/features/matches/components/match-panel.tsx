"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/feedback/loading";
import { PaywallDialog } from "@/features/billing/components/paywall-dialog";
import { useUnlockMatch } from "@/features/billing/hooks/use-billing";
import { LockedMatchCard } from "@/features/matches/components/locked-match-card";
import { PotentialMatchCard } from "@/features/matches/components/potential-match-card";
import {
  useConfirmMatch,
  useItemMatches,
  useRejectMatch,
  useRematch,
} from "@/features/matches/hooks/use-matches";
import type { Item } from "@/types/item";

/**
 * Ranked suggestions for one item — the product's flagship surface, and the
 * one the paid tier is sold on.
 *
 * Owner-only: the API restricts suggestions to the two people involved, so this
 * renders nothing for anyone else rather than showing an error. A stranger has
 * no business knowing which lost report resembles a found one.
 *
 * Two axes decide what a card looks like, and they are independent:
 *   authorisation — may you see this pair at all (enforced above, by the API)
 *   entitlement   — have you paid for this one (the `locked` flag per match)
 *
 * The panel never decides the second for itself. A locked match arrives with
 * its identifying fields already absent, so there is nothing here to hide and
 * no branch that could accidentally reveal it.
 */
export function MatchPanel({ item, isOwner }: { item: Item; isOwner: boolean }) {
  const t = useTranslations("matches");
  const tb = useTranslations("billing");
  const [paywallOpen, setPaywallOpen] = useState(false);

  const { data, isPending } = useItemMatches(item.id, { enabled: isOwner });
  const confirm = useConfirmMatch(item.id);
  const reject = useRejectMatch(item.id);
  const rematch = useRematch(item.id);
  //  Running out of credits opens the paywall rather than raising a toast:
  //  it is not an error, it is the moment the product has something to sell.
  const unlock = useUnlockMatch(item.id, {
    onInsufficientCredit: () => setPaywallOpen(true),
  });

  if (!isOwner) return null;

  const matches = data?.matches ?? [];
  const entitlements = data?.entitlements;
  const lockedCount = data?.locked_count ?? 0;
  // The engine is still working — either freshly reported, or re-running after
  // an edit. Distinct from "finished and found nothing".
  const searching =
    isPending ||
    ["pending", "embedding", "matching"].includes(data?.processing_status ?? "");
  const hasFreeUnlock = (entitlements?.free_unlocks_remaining ?? 0) > 0;

  return (
    <div className="ring-premium shadow-premium rounded-2xl">
      <Card className="rounded-[calc(1rem-1px)] border-0">
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-2">
            {/* Small caps over the title rather than an icon beside it. A
                label states the tier; a glyph decorates it. */}
            <span className="text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-premium-ink">
              {t("tierLabel")}
            </span>
            <CardTitle className="text-heading-4">{t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => rematch.mutate()}
            disabled={rematch.isPending || searching}
          >
            <RefreshCw className="h-4 w-4" />
            {t("rematch")}
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {searching ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 p-4 text-body-sm text-muted-foreground">
              <Spinner />
              {t("searching")}
            </div>
          ) : matches.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 p-4 text-body-sm text-muted-foreground">
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-processing" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-processing" />
              </span>
              {t("empty")}
            </div>
          ) : (
            <>
              {/* One summary line above the cards. The count is the news —
                  "we found something" — and it should land before the reader
                  has to work it out from a stack of blurred tiles. */}
              {lockedCount > 0 && entitlements ? (
                <div className="flex items-start gap-3 rounded-xl border border-premium-ink/25 bg-premium-muted/50 p-4 text-body-sm">
                  {hasFreeUnlock ? (
                    <Sparkles
                      className="mt-0.5 h-4 w-4 shrink-0 text-premium-ink"
                      aria-hidden
                    />
                  ) : (
                    <Lock
                      className="mt-0.5 h-4 w-4 shrink-0 text-premium-ink"
                      aria-hidden
                    />
                  )}
                  <p className="text-foreground/80">
                    {hasFreeUnlock
                      ? tb("panelFreeBanner", { count: lockedCount })
                      : tb("panelLockedBanner", { count: lockedCount })}
                  </p>
                </div>
              ) : null}

              {matches.map((match) =>
                match.locked && entitlements ? (
                  <LockedMatchCard
                    key={match.match_id}
                    match={match}
                    entitlements={entitlements}
                    onUnlock={() => unlock.mutate(match.match_id)}
                    onReject={() => reject.mutate(match.match_id)}
                    //  Scoped to the card actually being submitted. A shared
                    //  flag would freeze every other suggestion while one
                    //  request is in flight, which reads as the whole panel
                    //  breaking.
                    pending={
                      (unlock.isPending && unlock.variables === match.match_id) ||
                      (reject.isPending && reject.variables === match.match_id)
                    }
                  />
                ) : (
                  <PotentialMatchCard
                    key={match.match_id}
                    match={match}
                    onConfirm={() => confirm.mutate(match.match_id)}
                    onReject={() => reject.mutate(match.match_id)}
                    pending={
                      (confirm.isPending && confirm.variables === match.match_id) ||
                      (reject.isPending && reject.variables === match.match_id)
                    }
                  />
                ),
              )}
            </>
          )}
        </CardContent>
      </Card>

      <PaywallDialog open={paywallOpen} onOpenChange={setPaywallOpen} />
    </div>
  );
}
