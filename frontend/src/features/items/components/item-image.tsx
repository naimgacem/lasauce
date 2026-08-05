"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
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

/** Item photo with a designed placeholder when no image exists. */
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
          "relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-secondary to-muted",
          className,
        )}
        role="img"
        aria-label={t("noPhoto")}
      >
        <div className="bg-dotted absolute inset-0 opacity-40" />
        <ImageIcon className="relative h-8 w-8 text-muted-foreground/50" aria-hidden />
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
