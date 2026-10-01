"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowRight, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { imageUrl } from "@/features/items/components/item-image";
import { Link } from "@/i18n/navigation";
import { formatLocation } from "@/lib/algeria-wilayas";
import { formatDate, formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { AdminItemDetail, AdminMatch } from "@/types/admin";

import { AuditTrail } from "../components/audit-trail";
import { ItemActions, REOPENABLE } from "../components/item-actions";
import { MatchSheet } from "../components/match-sheet";
import { AdminPageHeader } from "../components/page-header";
import { ConfidenceBar, CopyableId, Fact, Panel, PersonCell } from "../components/primitives";
import { AdminQueryError } from "../components/query-states";
import { ReasonDialog } from "../components/reason-dialog";
import {
  ClaimStatusLabel,
  ItemStatusLabel,
  ItemTypeTag,
  MatchStatusLabel,
  ProcessingLabel,
} from "../components/status";
import { useDeleteItemImage } from "../hooks/use-admin-commands";
import { useAdminItem } from "../hooks/use-admin-queries";

function Photos({ item }: { item: AdminItemDetail }) {
  const t = useTranslations("admin.itemDetail");
  const remove = useDeleteItemImage(item.id);
  const [target, setTarget] = React.useState<string | null>(null);

  if (item.images.length === 0) return null;

  return (
    <Panel title={t("photos", { count: item.images.length })}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {item.images.map((image, i) => {
          const url = imageUrl(image.image_path);
          return (
            <li key={image.id} className="group relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
              {url ? (
                <Image
                  src={url}
                  alt={t("photoAlt", { n: i + 1, title: item.title })}
                  fill
                  sizes="(max-width: 640px) 50vw, 240px"
                  className="object-cover"
                />
              ) : null}
              <Button
                variant="secondary"
                size="icon-sm"
                className="absolute end-2 top-2 h-8 w-8 bg-background/90 opacity-100 shadow-sm transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                onClick={() => setTarget(image.id)}
                aria-label={t("removePhotoAria", { n: i + 1 })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>
      <ReasonDialog
        open={target !== null}
        onOpenChange={(open) => !open && setTarget(null)}
        title={t("removePhotoTitle")}
        description={t("removePhotoBody")}
        confirmLabel={t("removePhotoConfirm")}
        destructive
        pending={remove.isPending}
        onConfirm={(reason) => remove.mutateAsync({ imageId: target as string, reason })}
      />
    </Panel>
  );
}

function ReportFacts({ item }: { item: AdminItemDetail }) {
  const t = useTranslations("admin.itemDetail");
  const ti = useTranslations("item");
  const locale = useLocale();
  const location = formatLocation(item.wilaya_code, item.location_text, locale);

  return (
    <Panel title={t("report")}>
      <p className="whitespace-pre-line text-body-sm">{item.description}</p>
      <dl className="mt-4 divide-y border-t">
        <Fact label={ti("category")}>{item.category?.name ?? ti("uncategorised")}</Fact>
        {item.color ? <Fact label={ti("colour")}>{item.color}</Fact> : null}
        {item.brand ? <Fact label={ti("brand")}>{item.brand}</Fact> : null}
        <Fact label={ti("location")}>{location ?? ti("notSpecified")}</Fact>
        <Fact label={item.type === "lost" ? ti("dateLostLabel") : ti("dateFoundLabel")}>
          {formatDate(item.lost_or_found_at, locale)}
        </Fact>
        <Fact label={t("reported")}>{formatDateTime(item.created_at, locale)}</Fact>
        <Fact label={t("updated")}>{formatDateTime(item.updated_at, locale)}</Fact>
        {item.closed_at ? <Fact label={t("closedAt")}>{formatDateTime(item.closed_at, locale)}</Fact> : null}
      </dl>
      {item.claim_questions.length ? (
        <div className="mt-4 border-t pt-4">
          <h3 className="text-caption font-medium text-muted-foreground">{t("claimQuestions")}</h3>
          <ol className="mt-2 list-decimal space-y-1 ps-5 text-body-sm">
            {item.claim_questions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </Panel>
  );
}

function Matches({ item, onOpen }: { item: AdminItemDetail; onOpen: (match: AdminMatch) => void }) {
  const t = useTranslations("admin.itemDetail");
  return (
    <Panel title={t("matches", { count: item.matches.length })} bodyClassName="p-0">
      {item.matches.length === 0 ? (
        <p className="px-5 py-4 text-body-sm text-muted-foreground">{t("noMatches")}</p>
      ) : (
        <ul className="divide-y">
          {item.matches.map((match) => {
            const other = match.lost_item.id === item.id ? match.found_item : match.lost_item;
            return (
              <li key={match.id}>
                <button
                  type="button"
                  onClick={() => onOpen(match)}
                  className="flex w-full items-center gap-4 px-5 py-3 text-start transition-colors hover:bg-accent/40 focus-visible:ring-inset focus-visible:ring-offset-0"
                >
                  <span className="min-w-0 flex-1 truncate text-body-sm font-medium">{other.title}</span>
                  <span className="hidden text-caption font-normal sm:inline">
                    <MatchStatusLabel status={match.status} />
                  </span>
                  <span className="text-body-sm">
                    <ConfidenceBar value={match.confidence} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function Claims({ item }: { item: AdminItemDetail }) {
  const t = useTranslations("admin.itemDetail");
  const locale = useLocale();
  return (
    <Panel title={t("claims", { count: item.claims.length })} bodyClassName="p-0">
      {item.claims.length === 0 ? (
        <p className="px-5 py-4 text-body-sm text-muted-foreground">{t("noClaims")}</p>
      ) : (
        <ul className="divide-y">
          {item.claims.map((claim) => (
            <li key={claim.id} className="space-y-3 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href={ROUTES.adminUser(claim.claimant.id)} className="min-w-0 rounded-md">
                  <PersonCell name={claim.claimant.full_name} email={claim.claimant.email} />
                </Link>
                <span className="flex items-center gap-3 text-caption font-normal">
                  <ClaimStatusLabel status={claim.status} />
                  <span className="text-muted-foreground">{formatDate(claim.created_at, locale)}</span>
                </span>
              </div>
              {claim.message ? <p className="text-body-sm">{claim.message}</p> : null}
              {claim.answers.length ? (
                <dl className="space-y-2 rounded-lg bg-muted/50 p-3">
                  {claim.answers.map((answer) => (
                    <div key={answer.question}>
                      <dt className="text-caption font-normal text-muted-foreground">{answer.question}</dt>
                      <dd className="text-body-sm">{answer.answer}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function ItemDetailView({ itemId }: { itemId: string }) {
  const t = useTranslations("admin.itemDetail");
  const tn = useTranslations("admin.nav");
  const { data: item, isPending, isError, error, refetch } = useAdminItem(itemId);
  const [openMatch, setOpenMatch] = React.useState<AdminMatch | null>(null);

  const back = { href: ROUTES.adminItems, label: tn("items") };

  if (isError && !item) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title={t("notFound")} back={back} />
        <AdminQueryError error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  if (isPending || !item) {
    return (
      <div className="space-y-6" aria-busy>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-2/3" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  const closedByReporter =
    item.status === "closed" && item.closed_reason !== null && !REOPENABLE.has(item.closed_reason);

  return (
    <div className="space-y-6">
      <AdminPageHeader back={back} title={item.title} actions={<ItemActions item={item} />}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-body-sm">
          <ItemTypeTag type={item.type} />
          <ItemStatusLabel status={item.status} closedReason={item.closed_reason} />
          <ProcessingLabel status={item.processing_status} />
          <CopyableId value={item.id} />
        </div>
      </AdminPageHeader>

      {closedByReporter ? (
        <p className="rounded-lg border bg-muted/40 px-4 py-3 text-body-sm text-muted-foreground">
          {t("closedByReporter")}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Photos item={item} />
          <ReportFacts item={item} />
          <Matches item={item} onOpen={setOpenMatch} />
          <Claims item={item} />
        </div>
        <div className="min-w-0 space-y-6">
          <Panel title={t("reporter")}>
            <Link href={ROUTES.adminUser(item.reporter.id)} className="block rounded-md">
              <PersonCell name={item.reporter.full_name} email={item.reporter.email} />
            </Link>
            <Link
              href={`${ROUTES.adminItems}?user_id=${item.reporter.id}`}
              className="group mt-4 inline-flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"
            >
              {t("reporterReports")}
              <ArrowRight
                className="h-3 w-3 transition-transform ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                aria-hidden
              />
            </Link>
          </Panel>
          <Panel title={t("processing")}>
            <ProcessingLabel status={item.processing_status} />
            <p className="mt-2 text-caption font-normal text-muted-foreground">
              {t(`processingHint.${item.processing_status}`)}
            </p>
          </Panel>
          <AuditTrail title={t("history")} target={{ type: "item", id: item.id }} />
        </div>
      </div>

      <MatchSheet match={openMatch} onOpenChange={(open) => !open && setOpenMatch(null)} />
    </div>
  );
}
