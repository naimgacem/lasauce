import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5 rounded-full border",
    "px-2.5 py-0.5 text-caption",
    "transition-colors focus:outline-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground",
        outline: "border-border text-foreground",

        /* Semantic — meaning, never decoration. Solid reads as a status chip. */
        lost: "border-transparent bg-lost text-lost-foreground",
        found: "border-transparent bg-found text-found-foreground",
        processing:
          "border-transparent bg-processing text-processing-foreground",

        /* Soft variants: same meaning, quieter. For dense surfaces where a row
           of solid chips would shout. */
        "lost-soft":
          "border-lost/20 bg-lost-muted text-lost dark:text-lost dark:border-lost/30",
        "found-soft":
          "border-found/20 bg-found-muted text-found dark:text-found dark:border-found/30",
        "processing-soft":
          "border-processing/25 bg-processing-muted text-processing dark:text-processing dark:border-processing/30",

        /* Reserved for AI surfaces only. */
        ai: "border-transparent bg-ai-gradient text-ai-foreground",
        "ai-soft": "border-ai-from/25 bg-ai-muted text-ai-from",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
