"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Trash2 } from "lucide-react";

import { Spinner } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSession } from "@/features/auth/hooks/use-session";
import { ClaimPanel } from "@/features/claims/components/claim-panel";
import { IncomingClaims } from "@/features/claims/components/incoming-claims";
import {
  ItemStatusBadge,
  ItemTypeBadge,
  ProcessingBadge,
} from "@/features/items/components/item-badges";
import { ItemGallery } from "@/features/items/components/item-gallery";
import { useWithdrawItem } from "@/features/items/hooks/use-items";
import { MatchPanel } from "@/features/matches/components/match-panel";
import { wilayaName } from "@/lib/algeria-wilayas";
import { formatDate, formatRelative } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { Item } from "@/types/item";

const CLOSED_REASON_KEY = {
  recovered: "closedRecovered",
  expired: "closedExpired",
  withdrawn: "closedWithdrawn",
} as const;

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5">
      <dt className="shrink-0 text-body-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end text-body-sm font-medium">{value}</dd>
    </div>
  );
}

/**
 * Item page — where a link shared in a WhatsApp group lands, so it has to
 * answer "is this mine, and what do I do?" without scrolling.
 *
 * Desktop: photo on the left, the facts and the one action on the right.
 * Mobile: the same blocks in reading order — photo, what it is, the action.
 * The grid placement below is what lets one DOM order serve both: the owner's
 * panels sit under the photo on desktop, and after everything else on a phone.
 *
 * No entrance animation: the server already rendered this item, and fading it
 * in would only hide that work until JavaScript arrived.
 */
export function ItemDetail({ item }: { item: Item }) {
  const t = useTranslations("item");
  const locale = useLocale();
  const { user } = useSession();
  const withdraw = useWithdrawItem();
  const isOwner = user?.id === item.user_id;
  const isClosed = item.status === "closed";
  const closedReason =
    isClosed && item.closed_reason
      ? t(
          CLOSED_REASON_KEY[item.closed_reason as keyof typeof CLOSED_REASON_KEY] ??
            "statusClosed",
        )
      : null;

  return (
    <div className="container py-6 md:py-8">
      <div className="mb-5 flex min-h-9 items-center justify-between gap-4">
        <Link
          href={item.type === "lost" ? ROUTES.lost : ROUTES.found}
          className="group inline-flex items-center gap-1.5 text-body-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft
            className="h-4 w-4 transition-transform duration-200 ltr:group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5"
            aria-hidden
          />
          {t("backToSearch")}
        </Link>

        {isOwner && !isClosed ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" disabled={withdraw.isPending}>
                {withdraw.isPending ? <Spinner /> : <Trash2 className="h-4 w-4" />}
                {t("withdrawShort")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("withdrawConfirmTitle")}</DialogTitle>
                <DialogDescription>{t("withdrawConfirmBody")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={() => withdraw.mutate(item.id)}
                  disabled={withdraw.isPending}
                >
                  {withdraw.isPending ? <Spinner /> : null}
                  {t("withdraw")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-10 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <ItemGallery item={item} />
        </div>

        <div className="min-w-0 space-y-6 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <ItemTypeBadge type={item.type} />
              <ItemStatusBadge status={item.status} />
              <ProcessingBadge status={item.processing_status} />
            </div>
            {/* A notch below heading-1 on desktop: in a 24rem column the full
                size turns an ordinary title into three stacked lines. */}
            <h1 className="text-heading-1 lg:text-[1.875rem]">{item.title}</h1>
            {closedReason ? (
              <p className="text-body-sm text-muted-foreground">
                {t("closedReasonPrefix", { reason: closedReason })}
              </p>
            ) : null}
            {item.description ? (
              <p className="whitespace-pre-line text-body text-foreground/85">
                {item.description}
              </p>
            ) : null}
          </div>

          <dl className="divide-y border-y">
            <Fact
              label={item.type === "lost" ? t("dateLostLabel") : t("dateFoundLabel")}
              value={formatDate(item.lost_or_found_at, locale)}
            />
            <Fact
              label={t("location")}
              value={wilayaName(item.wilaya_code, locale) ?? t("notSpecified")}
            />
            {item.location_text ? (
              <Fact label={t("whereExactly")} value={item.location_text} />
            ) : null}
            <Fact
              label={t("category")}
              value={item.category?.name ?? t("uncategorised")}
            />
            {item.color ? <Fact label={t("colour")} value={item.color} /> : null}
            {item.brand ? <Fact label={t("brand")} value={item.brand} /> : null}
            <Fact
              label={t("reportedLabel")}
              value={formatRelative(item.created_at, locale)}
            />
          </dl>

          {/* The visitor's one action. The owner's side of the loop lives
              under the photo instead. */}
          {!isOwner ? <ClaimPanel item={item} /> : null}
        </div>

        {isOwner ? (
          <div className="min-w-0 space-y-10 lg:col-start-1 lg:row-start-2">
            <IncomingClaims item={item} />
            <MatchPanel item={item} isOwner />
          </div>
        ) : null}
      </div>
    </div>
  );
}
