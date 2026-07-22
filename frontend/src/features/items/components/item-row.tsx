"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { ChevronRight, MapPin } from "lucide-react";

import { listItem } from "@/animations";
import { Card, CardContent } from "@/components/ui/card";
import {
  ItemStatusBadge,
  ItemTypeBadge,
} from "@/features/items/components/item-badges";
import { ItemImage } from "@/features/items/components/item-image";
import { formatDate, formatRelative } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { Item } from "@/types/item";

/** Compact list row — scannable alternative to the photo grid. */
export function ItemRow({ item }: { item: Item }) {
  return (
    <m.div variants={listItem}>
      <Link
        href={ROUTES.item(item.id)}
        className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`${item.type === "lost" ? "Lost" : "Found"}: ${item.title}`}
      >
        <Card className="transition-colors group-hover:border-primary/40">
          <CardContent className="flex items-center gap-4 p-4">
            <ItemImage
              item={item}
              className="h-16 w-16 shrink-0 rounded-lg"
              sizes="64px"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate font-medium">{item.title}</h3>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {formatRelative(item.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>
                  {item.type === "lost" ? "Lost" : "Found"}{" "}
                  {formatDate(item.lost_or_found_at)}
                </span>
                {item.location_text ? (
                  <span className="hidden items-center gap-1 sm:flex">
                    <MapPin className="h-3 w-3" aria-hidden />
                    <span className="max-w-[200px] truncate">
                      {item.location_text}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <ItemTypeBadge type={item.type} />
              <span className="hidden sm:inline-flex">
                <ItemStatusBadge status={item.status} />
              </span>
              <ChevronRight
                className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </div>
          </CardContent>
        </Card>
      </Link>
    </m.div>
  );
}
