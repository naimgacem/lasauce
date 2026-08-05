"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { m } from "framer-motion";
import { CheckCircle2, MoreHorizontal, Trash2 } from "lucide-react";

import { listItem } from "@/animations";
import { Spinner } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ItemStatusBadge,
  ItemTypeBadge,
} from "@/features/items/components/item-badges";
import { ItemImage } from "@/features/items/components/item-image";
import { useResolveItem, useWithdrawItem } from "@/features/items/hooks/use-items";
import { formatLocation } from "@/lib/algeria-wilayas";
import { formatDate, formatRelative } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { titleCase } from "@/lib/format";
import type { Item } from "@/types/item";

type PendingAction = "resolve" | "withdraw" | null;

/**
 * A row on /my-items — like ItemRow, but with the owner-only lifecycle actions.
 * Both actions close the report, so both confirm first.
 */
export function MyItemRow({ item }: { item: Item }) {
  const locale = useLocale();
  const [confirming, setConfirming] = React.useState<PendingAction>(null);
  const resolve = useResolveItem();
  const withdraw = useWithdrawItem();

  const busy = resolve.isPending || withdraw.isPending;
  const isClosed = item.status === "closed";
  const location = formatLocation(item.wilaya_code, item.location_text, locale);
  const photos = item.images.length;

  function run() {
    if (confirming === "resolve") resolve.mutate(item.id);
    if (confirming === "withdraw") withdraw.mutate(item.id);
    setConfirming(null);
  }

  return (
    <m.li variants={listItem}>
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <Link
            href={ROUTES.item(item.id)}
            className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Open ${item.title}`}
          >
            <ItemImage
              item={item}
              className="h-16 w-16 rounded-lg"
              sizes="64px"
            />
          </Link>

          <div className="min-w-0 flex-1 space-y-1">
            <Link
              href={ROUTES.item(item.id)}
              className="block truncate font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.title}
            </Link>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
              <span>
                {item.type === "lost" ? "Lost" : "Found"}{" "}
                {formatDate(item.lost_or_found_at, locale)}
              </span>
              {location ? <span className="truncate">{location}</span> : null}
              <span>
                {photos} photo{photos === 1 ? "" : "s"}
              </span>
              {isClosed && item.closed_reason ? (
                <span>Closed — {titleCase(item.closed_reason)}</span>
              ) : (
                <span>Posted {formatRelative(item.created_at, locale)}</span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ItemTypeBadge type={item.type} />
            <span className="hidden sm:inline-flex">
              <ItemStatusBadge status={item.status} />
            </span>

            {!isClosed ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    aria-label={`Actions for ${item.title}`}
                  >
                    {busy ? <Spinner /> : <MoreHorizontal className="h-4 w-4" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setConfirming("resolve")}>
                    <CheckCircle2 className="h-4 w-4" />
                    Mark as recovered
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfirming("withdraw")}>
                    <Trash2 className="h-4 w-4" />
                    Withdraw report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirming !== null} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirming === "resolve"
                ? "Mark this as recovered?"
                : "Withdraw this report?"}
            </DialogTitle>
            <DialogDescription>
              {confirming === "resolve"
                ? "The report closes and stops appearing in browse. Your history is kept."
                : "The report closes and is hidden from browsing. This can't be undone, but your history is kept."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button
              variant={confirming === "withdraw" ? "destructive" : "default"}
              onClick={run}
            >
              {confirming === "resolve" ? "Mark recovered" : "Withdraw report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </m.li>
  );
}
