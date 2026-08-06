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

        /* Reserved for the paid matching feature.
           Outlined rather than filled: a solid gold pill shouts, and shouting
           is what cheap looks like. A hairline rule with letter-spaced small
           caps is how a premium tier labels itself. */
        premium: [
          "border-premium-ink/35 bg-premium-muted text-premium-ink",
          "dark:border-premium-ink/30 dark:bg-premium-muted dark:text-premium-ink",
          "text-[0.6875rem] font-medium uppercase tracking-[0.08em]",
        ].join(" "),
        /* Solid foil. For the one place that has to read as a seal. */
        "premium-solid":
          "border-transparent bg-premium-gradient text-premium-foreground font-medium",
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
