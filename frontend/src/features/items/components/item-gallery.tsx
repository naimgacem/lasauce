"use client";

import * as React from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";

import { imageUrl } from "@/features/items/components/item-image";
import { cn } from "@/lib/utils";
import type { Item } from "@/types/item";

/** Image gallery: main stage + thumbnail strip. Designed placeholder when empty. */
export function ItemGallery({ item }: { item: Item }) {
  const urls = item.images
    .map((img) => imageUrl(img.image_path))
    .filter((u): u is string => Boolean(u));
  const [active, setActive] = React.useState(0);

  if (urls.length === 0) {
    return (
      <div
        className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden rounded-2xl border bg-gradient-to-br from-secondary to-muted"
        role="img"
        aria-label="No photos for this item yet"
      >
        <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:14px_14px]" />
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImageIcon className="h-10 w-10" aria-hidden />
          <p className="text-sm">No photos yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border bg-muted">
        <Image
          src={urls[active]}
          alt={`${item.title} — photo ${active + 1} of ${urls.length}`}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
          priority
        />
      </div>
      {urls.length > 1 ? (
        <div className="flex gap-2" role="tablist" aria-label="Photos">
          {urls.map((url, i) => (
            <button
              key={url}
              role="tab"
              aria-selected={i === active}
              aria-label={`Photo ${i + 1}`}
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
