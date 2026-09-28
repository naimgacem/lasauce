import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge only knows Tailwind's stock scale. Without this, a custom size
 * such as `text-caption` is read as a text *colour*, so `cn("text-caption",
 * "text-muted-foreground")` silently drops the size — which is how badges and
 * nav labels ended up rendering at 16px. Keep in sync with `fontSize` in
 * tailwind.config.ts.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "heading-1",
            "heading-2",
            "heading-3",
            "heading-4",
            "body-lg",
            "body",
            "body-sm",
            "caption",
            "overline",
          ],
        },
      ],
      shadow: [{ shadow: ["hero"] }],
    },
  },
});

/** Merge conditional class names, de-duplicating Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
