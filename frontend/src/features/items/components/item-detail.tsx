"use client";

import Link from "next/link";
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
              Back to search
            </Link>
          </Button>

          {isOwner && !isClosed ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={withdraw.isPending}>
                  {withdraw.isPending ? <Spinner /> : <Trash2 className="h-4 w-4" />}
                  Withdraw
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Withdraw this report?</DialogTitle>
                  <DialogDescription>
                    The report will be closed and hidden from browsing. This
                    can&apos;t be undone, but your report history is preserved.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="destructive"
                    onClick={() => withdraw.mutate(item.id)}
                    disabled={withdraw.isPending}
                  >
                    {withdraw.isPending ? <Spinner /> : null}
                    Withdraw report
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
                Closed — {item.closed_reason}
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
            label={item.type === "lost" ? "Date lost" : "Date found"}
            value={formatDate(item.lost_or_found_at)}
          />
          <Fact
            icon={MapPin}
            label="Wilaya"
            value={wilayaName(item.wilaya_code) ?? "Not specified"}
          />
          {item.location_text ? (
            <Fact icon={MapPin} label="Where exactly" value={item.location_text} />
          ) : null}
          <Fact icon={Tag} label="Category" value={item.category?.name ?? "Uncategorised"} />
          {item.color ? (
            <Fact icon={Palette} label="Color" value={item.color} />
          ) : null}
          {item.brand ? <Fact icon={Tag} label="Brand" value={item.brand} /> : null}
          <Fact
            icon={Clock}
            label="Reported"
            value={`${formatRelative(item.created_at)} · updated ${formatRelative(item.updated_at)}`}
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
                  Potential matches
                </CardTitle>
                <CardDescription>
                  When the matching engine ships, ranked candidates appear here —
                  each with a confidence score and a plain-language explanation
                  of why it might be{" "}
                  {item.type === "lost" ? "your item" : "the owner's item"}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 p-4 text-body-sm text-muted-foreground">
                  <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-processing" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-processing" />
                  </span>
                  This report is queued for matching. You&apos;ll be notified the
                  moment a likely match appears.
                </div>
              </CardContent>
            </Card>
          </div>
        </m.div>
      </m.div>
    </div>
  );
}
