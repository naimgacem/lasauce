"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { m } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Palette,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";

import { listContainer, listItem } from "@/animations";
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
import { wilayaName } from "@/lib/algeria-wilayas";
import { formatDate, formatRelative } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { Item } from "@/types/item";

const CLOSED_REASON_KEY = {
  recovered: "closedRecovered",
  expired: "closedExpired",
  withdrawn: "closedWithdrawn",
} as const;

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Tag;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-3.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium">{value}</dd>
      </div>
    </div>
  );
}

export function ItemDetail({ item }: { item: Item }) {
  const t = useTranslations("item");
  const locale = useLocale();
  const { user } = useSession();
  const withdraw = useWithdrawItem();
  const isOwner = user?.id === item.user_id;
  const isClosed = item.status === "closed";

  return (
    <div className="container max-w-4xl py-8">
      <m.div
        variants={listContainer}
        initial="initial"
        animate="enter"
        className="space-y-6"
      >
        {/* Top bar */}
        <m.div variants={listItem} className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href={item.type === "lost" ? ROUTES.lost : ROUTES.found}>
              <ArrowLeft className="h-4 w-4" />
              {t("backToSearch")}
            </Link>
          </Button>

          {isOwner && !isClosed ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={withdraw.isPending}>
                  {withdraw.isPending ? <Spinner /> : <Trash2 className="h-4 w-4" />}
                  {t("withdrawShort")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("withdrawConfirmTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("withdrawConfirmBody")}
                  </DialogDescription>
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
        </m.div>

        {/* Gallery */}
        <m.div variants={listItem}>
          <ItemGallery item={item} />
        </m.div>

        {/* Item information */}
        <m.div variants={listItem} className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <ItemTypeBadge type={item.type} />
            <ItemStatusBadge status={item.status} />
            <ProcessingBadge status={item.processing_status} />
            {isClosed && item.closed_reason ? (
              <span className="text-xs text-muted-foreground">
                {t("closedReasonPrefix", {
                  reason: t(CLOSED_REASON_KEY[item.closed_reason as keyof typeof CLOSED_REASON_KEY] ?? "statusClosed"),
                })}
              </span>
            ) : null}
          </div>
          <h1 className="text-heading-1">{item.title}</h1>
          <p className="max-w-prose whitespace-pre-line text-body text-foreground/85">
            {item.description}
          </p>
        </m.div>

        {/* Location + report metadata */}
        <m.dl
          variants={listItem}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <Fact
            icon={CalendarDays}
            label={item.type === "lost" ? t("dateLostLabel") : t("dateFoundLabel")}
            value={formatDate(item.lost_or_found_at, locale)}
          />
          <Fact
            icon={MapPin}
            label={t("location")}
            value={wilayaName(item.wilaya_code, locale) ?? t("notSpecified")}
          />
          {item.location_text ? (
            <Fact icon={MapPin} label={t("whereExactly")} value={item.location_text} />
          ) : null}
          <Fact icon={Tag} label={t("category")} value={item.category?.name ?? t("uncategorised")} />
          {item.color ? (
            <Fact icon={Palette} label={t("colour")} value={item.color} />
          ) : null}
          {item.brand ? <Fact icon={Tag} label={t("brand")} value={item.brand} /> : null}
          <Fact
            icon={Clock}
            label={t("reportedLabel")}
            value={t("reportedRelativeUpdated", {
              relative: formatRelative(item.created_at, locale),
              updatedRelative: formatRelative(item.updated_at, locale),
            })}
          />
        </m.dl>

        {/* The core loop: claim it, or review who's claiming yours. */}
        <m.div variants={listItem}>
          {isOwner ? <IncomingClaims item={item} /> : <ClaimPanel item={item} />}
        </m.div>

        {/* Potential Matches — future placeholder, flagship slot */}
        <m.div variants={listItem}>
          {/* AI-gradient hairline frame — the one gradient in the product. */}
          <div className="ring-ai-gradient rounded-2xl shadow-md">
            <Card className="rounded-[calc(1rem-1px)] border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2.5 text-heading-4">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-ai-gradient text-ai-foreground shadow-sm"
                    aria-hidden
                  >
                    <Sparkles className="h-4 w-4" />
                  </span>
                  {t("potentialMatches")}
                </CardTitle>
                <CardDescription>
                  {t("potentialMatchesBody", {
                    target: item.type === "lost" ? t("yourItem") : t("ownersItem"),
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 p-4 text-body-sm text-muted-foreground">
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-processing" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-processing" />
                  </span>
                  {t("queuedForMatching")}
                </div>
              </CardContent>
            </Card>
          </div>
        </m.div>
      </m.div>
    </div>
  );
}
