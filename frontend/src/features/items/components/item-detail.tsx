"use client";

import Link from "next/link";
import { m } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Lock,
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
import {
  ItemStatusBadge,
  ItemTypeBadge,
  ProcessingBadge,
} from "@/features/items/components/item-badges";
import { ItemGallery } from "@/features/items/components/item-gallery";
import { useWithdrawItem } from "@/features/items/hooks/use-items";
import { formatDate, formatRelative } from "@/lib/format";
import { loginWithNext, ROUTES } from "@/lib/routes";
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
  const { user, isAuthed } = useSession();
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
              Back to browse
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
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {item.title}
          </h1>
          <p className="max-w-prose whitespace-pre-line leading-relaxed text-foreground/85">
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
            label="Location"
            value={item.location_text ?? "Not specified"}
          />
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

        {/* Contact gate */}
        {!isAuthed ? (
          <m.div variants={listItem}>
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left">
                <Lock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                <p className="flex-1 text-sm text-muted-foreground">
                  Sign in to contact the reporter and see match suggestions for
                  your own items.
                </p>
                <Button asChild size="sm">
                  <Link href={loginWithNext(ROUTES.item(item.id))}>Sign in</Link>
                </Button>
              </CardContent>
            </Card>
          </m.div>
        ) : null}

        {/* Potential Matches — future placeholder, flagship slot */}
        <m.div variants={listItem}>
          <div className="rounded-2xl bg-ai-gradient p-px">
            <Card className="rounded-[calc(1rem-1px)] border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-ai-gradient text-white"
                    aria-hidden
                  >
                    <Sparkles className="h-4 w-4" />
                  </span>
                  Potential matches
                </CardTitle>
                <CardDescription>
                  When the matching engine ships, AI-ranked candidates appear
                  here — each with a confidence score and a plain-language
                  explanation of why it might be{" "}
                  {item.type === "lost" ? "your item" : "the owner's item"}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-processing/60 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-processing" />
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
