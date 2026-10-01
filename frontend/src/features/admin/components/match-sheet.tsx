"use client";

import * as React from "react";
import Image from "next/image";
import { Check, ImageOff, Undo2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { imageUrl } from "@/features/items/components/item-image";
import { useMatchReason } from "@/features/matches/use-match-reason";
import { Link } from "@/i18n/navigation";
import { isRtl } from "@/i18n/routing";
import { formatConfidence, formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { AdminMatch, AdminMatchItem } from "@/types/admin";

import { useRetractMatch } from "../hooks/use-admin-commands";
import { ReasonDialog } from "./reason-dialog";
import { ItemStatusLabel, ItemTypeTag, MatchStatusLabel } from "./status";

const RETRACTABLE = new Set(["suggested", "pending"]);

export function canRetract(match: AdminMatch): boolean {
  return RETRACTABLE.has(match.status);
}

function Side({ item }: { item: AdminMatchItem }) {
  const url = imageUrl(item.primary_image_url);
  return (
    <Link
      href={ROUTES.adminItem(item.id)}
      className="group block overflow-hidden rounded-lg border transition-colors hover:border-foreground/20"
    >
      <div className="relative aspect-[4/3] bg-muted">
        {url ? (
          <Image src={url} alt="" fill sizes="200px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center" aria-hidden>
            <ImageOff className="h-5 w-5 text-muted-foreground/45" />
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <ItemTypeTag type={item.type} />
        <p className="line-clamp-2 text-body-sm font-medium group-hover:underline">{item.title}</p>
        <p className="text-caption font-normal">
          <ItemStatusLabel status={item.status} />
        </p>
      </div>
    </Link>
  );
}

function Score({ label, value }: { label: string; value: number | null }) {
  const locale = useLocale();
  const t = useTranslations("admin.matches");
  return (
    <div>
      <dt className="text-caption font-normal text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-body font-semibold tabular-nums">
        {value === null ? (
          <span className="text-body-sm font-normal text-muted-foreground">{t("noImageScore")}</span>
        ) : (
          formatConfidence(value, locale)
        )}
      </dd>
    </div>
  );
}

/**
 * Everything the engine and the owners said about one pair.
 *
 * Unredacted: the paywall hides these features from owners who have not paid,
 * but a moderator judging whether the engine is right needs exactly them.
 */
export function MatchSheet({
  match,
  onOpenChange,
}: {
  match: AdminMatch | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.matches");
  const locale = useLocale();
  const reason = useMatchReason();
  const retract = useRetractMatch();
  const [confirming, setConfirming] = React.useState(false);

  //  Keep the last match on screen while the sheet animates closed.
  const [shown, setShown] = React.useState(match);
  React.useEffect(() => {
    if (match) setShown(match);
  }, [match]);

  const reasons = shown ? shown.explanation.map(reason).filter(Boolean) : [];

  return (
    <>
      <Sheet open={Boolean(match)} onOpenChange={onOpenChange}>
        <SheetContent
          side={isRtl(locale) ? "left" : "right"}
          className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
        >
          {shown ? (
            <>
              <SheetHeader className="border-b px-6 py-5">
                <SheetTitle>{t("sheetTitle")}</SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <MatchStatusLabel status={shown.status} />
                  <span>{formatDateTime(shown.created_at, locale)}</span>
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-6 px-6 py-5">
                <div className="grid grid-cols-2 gap-3">
                  <Side item={shown.lost_item} />
                  <Side item={shown.found_item} />
                </div>

                <section className="space-y-3">
                  <h3 className="text-body-sm font-semibold">{t("scores")}</h3>
                  <dl className="grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-4">
                    <Score label={t("confidence")} value={shown.confidence} />
                    <Score label={t("textScore")} value={shown.text_score} />
                    <Score label={t("imageScore")} value={shown.image_score} />
                    <Score label={t("combinedScore")} value={shown.combined_score} />
                  </dl>
                </section>

                <section className="space-y-2">
                  <h3 className="text-body-sm font-semibold">{t("why")}</h3>
                  {reasons.length ? (
                    <ul className="space-y-1.5">
                      {reasons.map((text, i) => (
                        <li key={i} className="flex gap-2 text-body-sm text-muted-foreground">
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden />
                          {text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-body-sm text-muted-foreground">{t("noReasons")}</p>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-body-sm font-semibold">{t("verdicts")}</h3>
                  {shown.feedback.length ? (
                    <ul className="space-y-2">
                      {shown.feedback.map((f) => (
                        <li key={`${f.user_id}-${f.created_at}`} className="flex gap-2 text-body-sm">
                          {f.is_correct ? (
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                          ) : (
                            <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                          )}
                          <span>
                            {f.is_correct ? t("verdictCorrect") : t("verdictWrong")}
                            {f.comment ? (
                              <span className="block text-muted-foreground">“{f.comment}”</span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-body-sm text-muted-foreground">{t("noVerdicts")}</p>
                  )}
                </section>
              </div>

              {canRetract(shown) ? (
                <div className="border-t px-6 py-4">
                  <Button variant="outline" className="w-full" onClick={() => setConfirming(true)}>
                    <Undo2 className="h-4 w-4" />
                    {t("retract")}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {shown ? (
        <ReasonDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t("retractTitle")}
          description={t("retractBody")}
          confirmLabel={t("retractConfirm")}
          pending={retract.isPending}
          onConfirm={async (note) => {
            await retract.mutateAsync({ matchId: shown.id, note });
            onOpenChange(false);
          }}
        />
      ) : null}
    </>
  );
}
