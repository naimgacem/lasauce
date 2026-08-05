"use client";

import { Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";
import { m } from "framer-motion";
import { CalendarDays, MapPin } from "lucide-react";

import { cardHover, cardTap, listItem } from "@/animations";
import { Card, CardContent } from "@/components/ui/card";
import {
  ItemStatusBadge,
  ItemTypeBadge,
} from "@/features/items/components/item-badges";
import { ItemImage } from "@/features/items/components/item-image";
import { formatLocation } from "@/lib/algeria-wilayas";
import { formatDate, formatRelative } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { Item } from "@/types/item";

/** Grid card — photo-led, hover lift per the animation system. */
export function ItemCard({ item }: { item: Item }) {
  const locale = useLocale();
  const location = formatLocation(item.wilaya_code, item.location_text, locale);

  return (
    <m.div variants={listItem} whileHover={cardHover} whileTap={cardTap}>
      <Link
        href={ROUTES.item(item.id)}
        className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`${item.type === "lost" ? "Lost" : "Found"}: ${item.title}`}
      >
        <Card interactive className="h-full overflow-hidden">
          <div className="relative overflow-hidden">
            <ItemImage
              item={item}
              className="aspect-[4/3] w-full transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transform-none"
            />
            {/* Bottom scrim keeps the badges legible over busy photos. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          </div>
          <CardContent className="space-y-2.5 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <ItemTypeBadge type={item.type} />
                <ItemStatusBadge status={item.status} />
              </div>
              <span className="whitespace-nowrap text-caption text-muted-foreground">
                {formatRelative(item.created_at, locale)}
              </span>
            </div>
            <h3 className="line-clamp-1 text-heading-4 transition-colors group-hover:text-primary">
              {item.title}
            </h3>
            <div className="space-y-1 text-caption text-muted-foreground">
              {location ? (
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="line-clamp-1">{location}</span>
                </p>
              ) : null}
              <p className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {item.type === "lost" ? "Lost" : "Found"}{" "}
                {formatDate(item.lost_or_found_at, locale)}
              </p>
            </div>
          </CardContent>
        </Card>
      </Link>
    </m.div>
  );
}
