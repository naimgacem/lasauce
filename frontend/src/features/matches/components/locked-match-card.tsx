"use client";

import { useTranslations } from "next-intl";
import { m } from "framer-motion";
import { Lock, Sparkles, X } from "lucide-react";

import { listItem } from "@/animations";
import { Spinner } from "@/components/feedback/loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfidenceRing } from "@/features/matches/components/confidence-ring";
import { useMatchReason } from "@/features/matches/use-match-reason";
import type { Entitlements } from "@/types/billing";
import type { MatchSuggestion } from "@/types/match";

/**
 * A match the viewer has not paid to see.
 *
 * Everything on this card is real. The confidence figure is the true score, the
 * blurred photo is the actual candidate's photo, and the visible reasons are
 * reasons the engine genuinely recorded. What is missing is missing from the
 * HTTP response — `candidate_item` is null — so nothing here is theatre and
 * nothing can be recovered by a curious visitor with devtools open.
 *
 * That constraint is also what makes the design work. The card has to sell
 * something it cannot show, so it leans on the two signals it legitimately
 * holds: a precise number, and a shape you can almost make out.
 */
export function LockedMatchCard({
  match,
  entitlements,
  onUnlock,
  onReject,
  pending = false,
}: {
  match: MatchSuggestion;
  entitlements: Entitlements;
  onUnlock: (matchId: string) => void;
  onReject?: (matchId: string) => void;
  pending?: boolean;
}) {
  const t = useTranslations("matches");
  const tb = useTranslations("billing");
  const renderReason = useMatchReason();

  const preview = match.preview;
  const isFree = entitlements.free_unlocks_remaining > 0;
  const canAfford = entitlements.balance >= entitlements.unlock_cost;

  // The strength reasons that survived redaction. Codes without a translation
  // render empty and drop out, so a backend shipping a new code degrades to a
  // shorter list rather than a blank bullet.
  const reasons = match.explanation
    .map((reason) => ({ code: reason.code, text: renderReason(reason) }))
    .filter((r) => r.text);

  return (
    <m.div variants={listItem}>
      <div className="ring-premium shadow-premium rounded-xl">
        <Card className="overflow-hidden rounded-[calc(1rem-1px)] border-0">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <Badge variant="premium">
                <Lock className="h-3 w-3" aria-hidden />
                {t("lockedBadge")}
              </Badge>
              {/* The score is shown in full. It identifies nothing on its own,
                  and withholding it would leave the card with no evidence that
                  the thing behind the wall is worth anything. */}
              <ConfidenceRing value={match.confidence} size={56} />
            </div>

            <div className="mt-4 flex gap-4">
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-32 sm:w-32">
                {preview?.blur_preview ? (
                  <>
                    {/*
                      A 16px source stretched to 128px. Native <img>, not
                      next/image: the payload is a data URI that is already
                      smaller than the request to optimise it would be, and
                      routing it through the image pipeline would fetch and
                      re-encode a file that is 135 bytes long.
                    */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview.blur_preview}
                      alt=""
                      aria-hidden
                      className="blur-locked h-full w-full object-cover"
                    />
                    <div className="veil-locked absolute inset-0" />
                  </>
                ) : null}
                {/* Drawn either way. With no preview, the lock is the image. */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-background/85 p-2 shadow-sm">
                    <Lock className="h-4 w-4 text-premium-ink" aria-hidden />
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-2">
                {/* Redaction bars where the title and metadata would sit.
                    Deliberately not a skeleton: a skeleton promises that
                    content is on its way, and this content is not coming until
                    the user decides it should. */}
                <div aria-label={t("lockedTitleAria")} role="img">
                  <span className="bar-redacted block h-3.5 w-4/5 rounded-full" />
                  <span className="bar-redacted mt-2 block h-3.5 w-2/5 rounded-full" />
                </div>

                <ul className="space-y-1.5 pt-1.5" aria-label={t("whyMatchAria")}>
                  {reasons.map(({ code, text }) => (
                    <li
                      key={code}
                      className="flex items-start gap-2 text-xs text-foreground/75"
                    >
                      <span
                        className="mt-[0.45rem] h-px w-2.5 shrink-0 bg-premium-ink/60"
                        aria-hidden
                      />
                      {text}
                    </li>
                  ))}
                  {preview?.hidden_reason_count ? (
                    <li className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span
                        className="mt-[0.45rem] h-px w-2.5 shrink-0 bg-muted-foreground/40"
                        aria-hidden
                      />
                      {/* A count, not a hint. Saying how much is withheld is
                          honest; hinting at what it says would be giving it
                          away one adjective at a time. */}
                      {t("moreSignals", { count: preview.hidden_reason_count })}
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
              <Button
                size="sm"
                variant={isFree || canAfford ? "premium" : "default"}
                onClick={() => onUnlock(match.match_id)}
                disabled={pending}
              >
                {pending ? (
                  <Spinner />
                ) : isFree ? (
                  <Sparkles className="h-4 w-4" aria-hidden />
                ) : (
                  <Lock className="h-4 w-4" aria-hidden />
                )}
                {/* Three states, three different asks. "Unlock free" is the
                    one that converts, so it never hides behind a generic verb. */}
                {isFree
                  ? tb("unlockFree")
                  : canAfford
                    ? tb("unlockForCredit", { count: entitlements.unlock_cost })
                    : tb("getCredits")}
              </Button>

              {onReject ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onReject(match.match_id)}
                  disabled={pending}
                >
                  <X className="h-4 w-4" aria-hidden />
                  {t("reject")}
                </Button>
              ) : null}

              <span className="ms-auto text-caption text-muted-foreground">
                {isFree
                  ? tb("freeUnlockNote")
                  : tb("balanceNote", { count: entitlements.balance })}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </m.div>
  );
}
