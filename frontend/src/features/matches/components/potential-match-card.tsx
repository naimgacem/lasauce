"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { m } from "framer-motion";
import {
  CalendarDays,
  Check,
  ImageIcon,
  MapPin,
  X,
} from "lucide-react";

import { cardHover, listItem } from "@/animations";
import { Spinner } from "@/components/feedback/loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfidenceRing } from "@/features/matches/components/confidence-ring";
import { useMatchReason } from "@/features/matches/use-match-reason";
import { imageUrl } from "@/features/items/components/item-image";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { MatchSuggestion } from "@/types/match";

/**
 * PotentialMatchCard — the product's flagship surface, and the one the paid
 * tier is sold on. Foil hairline, confidence dial, photo, and plain-language
 * reasons for why the engine believes these belong together.
 */
export function PotentialMatchCard({
  match,
  onConfirm,
  onReject,
  pending = false,
  preview = false,
}: {
  match: MatchSuggestion;
  onConfirm?: (matchId: string) => void;
  onReject?: (matchId: string) => void;
  /** Mutation in flight — disables actions. */
  pending?: boolean;
  /** Example rendering (dashboard preview) — actions hidden, links disabled. */
  preview?: boolean;
}) {
  const t = useTranslations("matches");
  const ti = useTranslations("item");
  const locale = useLocale();
  const renderReason = useMatchReason();
  const { candidate_item: candidate } = match;

  // Codes the client has no translation for render empty and are dropped, so a
  // backend that ships a new reason first degrades to a shorter list.
  const reasons = match.explanation
    .map((reason) => ({ code: reason.code, text: renderReason(reason) }))
    .filter((r) => r.text);

  // The user has already answered — the card reports that answer instead of
  // asking again. Driven by the match's own status, so it survives a reload
  // rather than living in component state.
  const confirmed = match.status === "confirmed";
  const settled = confirmed || match.status === "rejected";

  // The API sends a storage key; the same resolver every other item photo uses
  // turns it into a same-origin `/media/...` path.
  const photoUrl = imageUrl(candidate.primary_image_url);

  const photo = (
    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-32 sm:w-32">
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={candidate.title}
          fill
          sizes="128px"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary to-muted">
          <ImageIcon className="h-7 w-7 text-muted-foreground/60" aria-hidden />
        </div>
      )}
    </div>
  );

  return (
    <m.div variants={listItem} whileHover={preview ? undefined : cardHover}>
      {/* A settled card drops the foil edge: gold marks a decision you still
          have to make, and keeping it on an answered card spends the cue on
          nothing. */}
      <div
        className={cn(
          "rounded-2xl transition-shadow duration-200",
          settled
            ? "bg-border p-px"
            : "ring-premium shadow-premium hover:shadow-lg",
        )}
      >
        <Card className="rounded-[calc(1rem-1px)] border-0">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <Badge variant={settled ? "secondary" : "premium"}>
                {settled ? (
                  confirmed ? (
                    <Check className="h-3 w-3" aria-hidden />
                  ) : (
                    <X className="h-3 w-3" aria-hidden />
                  )
                ) : null}
                {settled
                  ? t(confirmed ? "confirmedBadge" : "rejectedBadge")
                  : t("potentialMatch")}
              </Badge>
              <ConfidenceRing value={match.confidence} size={56} />
            </div>

            <div className="mt-4 flex gap-4">
              {photo}
              <div className="min-w-0 flex-1 space-y-2">
                {preview ? (
                  <h3 className="font-semibold leading-snug">{candidate.title}</h3>
                ) : (
                  <Link
                    href={ROUTES.item(candidate.id)}
                    className="font-semibold leading-snug underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {candidate.title}
                  </Link>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {candidate.location_text ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {candidate.location_text}
                    </span>
                  ) : null}
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" aria-hidden />
                    {candidate.type === "found" ? ti("foundBadge") : ti("lostBadge")}{" "}
                    {formatDate(candidate.event_date, locale)}
                  </span>
                </div>

                {/* Why the engine thinks so — plain language, always visible */}
                <ul className="space-y-1.5 pt-1.5" aria-label={t("whyMatchAria")}>
                  {reasons.map(({ code, text }) => (
                    <li
                      key={code}
                      className="flex items-start gap-2 text-xs text-foreground/75"
                    >
                      {/* A rule, not a glyph. Repeating a sparkle down a list
                          is the tell of a generated interface; a hairline tick
                          just marks the item and gets out of the way. */}
                      <span
                        className="mt-[0.45rem] h-px w-2.5 shrink-0 bg-premium-ink/60"
                        aria-hidden
                      />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Once the user has answered, the answer IS the state of this
                card. Showing the same buttons again invites a second click that
                can only ever fail on the server. */}
            {!preview && settled ? (
              <div className="mt-4 flex items-start gap-2 border-t pt-4 text-body-sm">
                {confirmed ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-found" aria-hidden />
                ) : (
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <p className="text-muted-foreground">
                  {t(confirmed ? "confirmedNote" : "rejectedNote")}
                </p>
              </div>
            ) : !preview && (onConfirm || onReject) ? (
              <div className="mt-4 flex items-center gap-2 border-t pt-4">
                {onConfirm ? (
                  <Button
                    size="sm"
                    onClick={() => onConfirm(match.match_id)}
                    disabled={pending}
                  >
                    {pending ? <Spinner /> : <Check className="h-4 w-4" />}
                    {t("confirm")}
                  </Button>
                ) : null}
                {onReject ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onReject(match.match_id)}
                    disabled={pending}
                  >
                    <X className="h-4 w-4" />
                    {t("reject")}
                  </Button>
                ) : null}
                <span className="ms-auto text-caption text-muted-foreground">
                  {t("feedbackNote")}
                </span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </m.div>
  );
}
