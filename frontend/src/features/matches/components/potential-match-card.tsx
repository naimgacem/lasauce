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
  Sparkles,
  X,
} from "lucide-react";

import { cardHover, listItem } from "@/animations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfidenceRing } from "@/features/matches/components/confidence-ring";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { MatchSuggestion } from "@/types/match";

/**
 * PotentialMatchCard — the product's flagship surface.
 * AI-gradient hairline, animated confidence ring, photo, and plain-language
 * explanation bullets for why the engine believes these belong together.
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
  const { candidate_item: candidate } = match;

  const photo = (
    <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-32 sm:w-32">
      {candidate.primary_image_url ? (
        <Image
          src={candidate.primary_image_url}
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
      {/* AI-gradient hairline frame — reserved exclusively for AI surfaces */}
      <div className="ring-ai-gradient rounded-2xl shadow-md transition-shadow duration-200 hover:shadow-lg">
        <Card className="rounded-[calc(1rem-1px)] border-0">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <Badge variant="ai">
                <Sparkles className="h-3 w-3" aria-hidden />
                {t("potentialMatch")}
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

                {/* Why the AI thinks so — plain language, always visible */}
                <ul className="space-y-1 pt-1" aria-label={t("whyMatchAria")}>
                  {match.explanation.map((reason) => (
                    <li
                      key={reason}
                      className="flex items-start gap-1.5 text-xs text-foreground/80"
                    >
                      <Sparkles
                        className="mt-0.5 h-3 w-3 shrink-0 text-ai-from"
                        aria-hidden
                      />
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {!preview && (onConfirm || onReject) ? (
              <div className="mt-4 flex items-center gap-2 border-t pt-4">
                {onConfirm ? (
                  <Button
                    size="sm"
                    onClick={() => onConfirm(match.match_id)}
                    disabled={pending}
                  >
                    <Check className="h-4 w-4" />
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
