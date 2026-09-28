"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import type { Item } from "@/types/item";

/**
 * Resolve a displayable URL. Mock data stores absolute URLs directly; the
 * backend stores opaque storage keys, which resolve against the media host.
 */
export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // Already absolute (http:, https:, blob:, data:) — mock mode and object URLs.
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return path;
  return `${env.mediaUrl.replace(/\/+$/, "")}/media/${path.replace(/^\/+/, "")}`;
}

/**
 * Item photo, or a quiet placeholder when there is none. The placeholder is
 * deliberately plain: in a grid of real photos, a decorated empty slot draws
 * more attention than the photos do.
 */
export function ItemImage({
  item,
  className,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
}: {
  item: Item;
  className?: string;
  sizes?: string;
}) {
  const t = useTranslations("item");
  const url = imageUrl(item.images[0]?.image_path);

  if (!url) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden bg-muted",
          className,
        )}
        role="img"
        aria-label={t("noPhoto")}
      >
        <ImageOff className="h-5 w-5 text-muted-foreground/45" aria-hidden />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <Image
        src={url}
        alt={item.title}
        fill
        sizes={sizes}
        className="object-cover"
      />
    </div>
  );
}
