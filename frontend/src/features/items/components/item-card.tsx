"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { CalendarDays, MapPin } from "lucide-react";

import { cardHover, cardTap, listItem } from "@/animations";
import { Card, CardContent } from "@/components/ui/card";
import {
  ItemStatusBadge,
  ItemTypeBadge,
} from "@/features/items/components/item-badges";
import { ItemImage } from "@/features/items/components/item-image";
import { formatDate, formatRelative } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { Item } from "@/types/item";

/** Grid card — photo-led, hover lift per the animation system. */
export function ItemCard({ item }: { item: Item }) {
  return (
    <m.div variants={listItem} whileHover={cardHover} whileTap={cardTap}>
      <Link
        href={ROUTES.item(item.id)}
        className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`${item.type === "lost" ? "Lost" : "Found"}: ${item.title}`}
      >
        <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
          <ItemImage item={item} className="aspect-[4/3] w-full" />
          <CardContent className="space-y-2.5 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <ItemTypeBadge type={item.type} />
                <ItemStatusBadge status={item.status} />
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {formatRelative(item.created_at)}
              </span>
            </div>
            <h3 className="line-clamp-1 font-semibold leading-snug">
              {item.title}
            </h3>
            <div className="space-y-1 text-xs text-muted-foreground">
              {item.location_text ? (
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="line-clamp-1">{item.location_text}</span>
                </p>
              ) : null}
              <p className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {item.type === "lost" ? "Lost" : "Found"}{" "}
                {formatDate(item.lost_or_found_at)}
              </p>
            </div>
          </CardContent>
        </Card>
      </Link>
    </m.div>
  );
}
