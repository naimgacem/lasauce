"use client";

import * as React from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { imageUrl } from "@/features/items/components/item-image";
import { cn } from "@/lib/utils";
import type { Item } from "@/types/item";

/** Image gallery: main stage + thumbnail strip. Designed placeholder when empty. */
export function ItemGallery({ item }: { item: Item }) {
  const t = useTranslations("item");
  const urls = item.images
    .map((img) => imageUrl(img.image_path))
    .filter((u): u is string => Boolean(u));
  const [active, setActive] = React.useState(0);

  if (urls.length === 0) {
    return (
      <div
        className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-2xl border bg-gradient-to-br from-secondary to-muted"
        role="img"
        aria-label={t("noPhotosAria")}
      >
        <div className="bg-dotted absolute inset-0 opacity-40" />
        <div className="relative flex flex-col items-center gap-2 text-muted-foreground">
          <ImageIcon className="h-10 w-10" aria-hidden />
          <p className="text-body-sm">{t("noPhotosYet")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border bg-muted">
        <Image
          src={urls[active]}
          alt={t("photoAlt", { title: item.title, n: active + 1, total: urls.length })}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
          priority
        />
      </div>
      {urls.length > 1 ? (
        <div className="flex gap-2" role="tablist" aria-label={t("photosTabListAria")}>
          {urls.map((url, i) => (
            <button
              key={url}
              role="tab"
              aria-selected={i === active}
              aria-label={t("photoTabAria", { n: i + 1 })}
              onClick={() => setActive(i)}
              className={cn(
                "relative h-16 w-16 overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === active ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <Image src={url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
