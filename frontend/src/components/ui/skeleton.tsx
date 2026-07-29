import { cn } from "@/lib/utils";

/**
 * Loading placeholder with a travelling sheen. A sweep reads as "content is on
 * its way" far better than a whole block blinking on and off — and it stays
 * legible against both the warm canvas and dark mode.
 *
 * The CSS guard in globals.css neutralises the sweep under
 * `prefers-reduced-motion`, leaving a calm static block.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-md bg-muted",
        "before:absolute before:inset-0 before:-translate-x-full",
        "before:animate-shimmer before:bg-gradient-to-r",
        "before:from-transparent before:via-foreground/[0.06] before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
