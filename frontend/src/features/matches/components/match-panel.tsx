"use client";

import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/feedback/loading";
import { PotentialMatchCard } from "@/features/matches/components/potential-match-card";
import {
  useConfirmMatch,
  useItemMatches,
  useRejectMatch,
  useRematch,
} from "@/features/matches/hooks/use-matches";
import type { Item } from "@/types/item";

/**
 * Ranked suggestions for one item — the product's flagship surface.
 *
 * Owner-only: the API restricts suggestions to the two people involved, so this
 * renders nothing for anyone else rather than showing an error. A stranger has
 * no business knowing which lost report resembles a found one.
 */
export function MatchPanel({ item, isOwner }: { item: Item; isOwner: boolean }) {
  const t = useTranslations("matches");
  const { data, isPending } = useItemMatches(item.id, { enabled: isOwner });
  const confirm = useConfirmMatch(item.id);
  const reject = useRejectMatch(item.id);
  const rematch = useRematch(item.id);

  if (!isOwner) return null;

  const matches = data?.matches ?? [];
  // The engine is still working — either freshly reported, or re-running after
  // an edit. Distinct from "finished and found nothing".
  const searching =
    isPending ||
    ["pending", "embedding", "matching"].includes(data?.processing_status ?? "");

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
            matches.map((match) => (
              <PotentialMatchCard
                key={match.match_id}
                match={match}
                onConfirm={() => confirm.mutate(match.match_id)}
                onReject={() => reject.mutate(match.match_id)}
                //  Scoped to the card actually being submitted. A shared flag
                //  would freeze every other suggestion while one request is in
                //  flight, which reads as the whole panel breaking.
                pending={
                  (confirm.isPending && confirm.variables === match.match_id) ||
                  (reject.isPending && reject.variables === match.match_id)
                }
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
