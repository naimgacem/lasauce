"use client";

import * as React from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { imageUrl } from "@/features/items/components/item-image";
import { cn } from "@/lib/utils";
import type { Item } from "@/types/item";

/**
 * Main stage + thumbnail strip.
 *
 * The stage letterboxes (`object-contain`) instead of cropping. Most reports are
 * portrait phone photos, and the detail someone needs to recognise their item —
 * a scratch, a sticker, a keyring — is exactly what a centre crop cuts off.
 */
export function ItemGallery({ item }: { item: Item }) {
  const t = useTranslations("item");
  const urls = item.images
    .map((img) => imageUrl(img.image_path))
    .filter((u): u is string => Boolean(u));
  const [active, setActive] = React.useState(0);

  if (urls.length === 0) {
    return (
      <div
        className="flex aspect-[2/1] w-full flex-col items-center justify-center gap-2 rounded-xl bg-muted text-muted-foreground"
        role="img"
        aria-label={t("noPhotosAria")}
      >
        <ImageOff className="h-5 w-5 opacity-60" aria-hidden />
        <p className="text-body-sm">{t("noPhotosYet")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted lg:aspect-[3/2]">
        <Image
          src={urls[active]}
          alt={t("photoAlt", { title: item.title, n: active + 1, total: urls.length })}
          fill
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-contain"
          priority
        />
      </div>
      {urls.length > 1 ? (
        <div className="flex gap-2" role="tablist" aria-label={t("photosTabListAria")}>
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={t("photoTabAria", { n: i + 1 })}
              onClick={() => setActive(i)}
              className={cn(
                "relative h-16 w-16 overflow-hidden rounded-lg bg-muted ring-offset-2 ring-offset-background transition-[opacity,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === active ? "ring-2 ring-foreground" : "opacity-60 hover:opacity-100",
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
