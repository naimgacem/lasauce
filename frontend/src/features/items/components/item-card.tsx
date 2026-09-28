"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { m } from "framer-motion";

import { listItem } from "@/animations";
import {
  ItemStatusBadge,
  ItemTypeBadge,
} from "@/features/items/components/item-badges";
import { ItemImage } from "@/features/items/components/item-image";
import { wilayaName } from "@/lib/algeria-wilayas";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { Item } from "@/types/item";

/**
 * Grid card — the photo does the work. The type chip sits on the image so the
 * text below is only what a scanner needs: what it is, where, when. One hover
 * response (a slow push into the photo); the border tint covers devices that
 * can't hover-zoom smoothly.
 */
export function ItemCard({ item }: { item: Item }) {
  const t = useTranslations("item");
  const locale = useLocale();
  const place = wilayaName(item.wilaya_code, locale) ?? item.location_text;
  const typeLabel = item.type === "lost" ? t("lostBadge") : t("foundBadge");

  return (
    <m.div variants={listItem} className="h-full">
      <Link
        href={ROUTES.item(item.id)}
        className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={t("typeTitleAria", { type: typeLabel, title: item.title })}
      >
        <article className="flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-colors duration-200 group-hover:border-foreground/20">
          <div className="relative overflow-hidden">
            <ItemImage
              item={item}
              className="aspect-[4/3] w-full transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transform-none"
            />
            <div className="absolute start-2 top-2 flex flex-wrap gap-1">
              <ItemTypeBadge type={item.type} />
              <ItemStatusBadge
                status={item.status}
                className="border-transparent bg-background/90 text-foreground"
              />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-0.5 p-3 sm:p-4">
            <h3 className="line-clamp-2 text-body-sm font-medium leading-snug sm:line-clamp-1 sm:text-body sm:leading-snug">
              {item.title}
            </h3>
            <p className="mt-auto truncate pt-0.5 text-caption font-normal text-muted-foreground">
              {place ? (
                <>
                  {place}
                  <span aria-hidden className="mx-1.5">
                    ·
                  </span>
                </>
              ) : null}
              {formatDate(item.lost_or_found_at, locale)}
            </p>
          </div>
        </article>
      </Link>
    </m.div>
  );
}
