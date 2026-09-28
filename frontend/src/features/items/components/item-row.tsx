"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { m } from "framer-motion";
import { ChevronRight } from "lucide-react";

import { listItem } from "@/animations";
import {
  ItemStatusBadge,
  ItemTypeBadge,
} from "@/features/items/components/item-badges";
import { ItemImage } from "@/features/items/components/item-image";
import { formatLocation } from "@/lib/algeria-wilayas";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { Item } from "@/types/item";

/** Compact list row — scannable alternative to the photo grid. */
export function ItemRow({ item }: { item: Item }) {
  const t = useTranslations("item");
  const locale = useLocale();
  const location = formatLocation(item.wilaya_code, item.location_text, locale);
  const typeLabel = item.type === "lost" ? t("lostBadge") : t("foundBadge");

  return (
    <m.div variants={listItem}>
      <Link
        href={ROUTES.item(item.id)}
        className="group flex items-center gap-3 rounded-xl border bg-card p-2.5 transition-colors duration-200 hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:gap-4 sm:p-3"
        aria-label={t("typeTitleAria", { type: typeLabel, title: item.title })}
      >
        <ItemImage
          item={item}
          className="h-14 w-14 shrink-0 rounded-lg"
          sizes="56px"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-body-sm font-medium">{item.title}</h3>
          <p className="mt-0.5 truncate text-caption font-normal text-muted-foreground">
            {formatDate(item.lost_or_found_at, locale)}
            {location ? (
              <>
                <span aria-hidden className="mx-1.5">
                  ·
                </span>
                {location}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden sm:inline-flex">
            <ItemStatusBadge status={item.status} />
          </span>
          <ItemTypeBadge type={item.type} />
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200 ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
          aria-hidden
        />
      </Link>
    </m.div>
  );
}
