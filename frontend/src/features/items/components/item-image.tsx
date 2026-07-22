"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Item } from "@/types/item";

/** Resolve a displayable URL (mock mode stores URLs directly). */
export function imageUrl(path: string | undefined): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : null;
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
  const url = imageUrl(item.images[0]?.image_path);

  if (!url) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-secondary to-muted",
          className,
        )}
        role="img"
        aria-label={`No photo yet for ${item.title}`}
      >
        <div className="absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:14px_14px]" />
        <ImageIcon className="h-8 w-8 text-muted-foreground/60" />
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
