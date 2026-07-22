import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Premium empty state: illustration placeholder area + helpful explanation +
 * primary action. The illustration area is a layered token-driven composition
 * (swappable for real artwork later without touching call sites).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      {/* Illustration placeholder area */}
      <div className="relative mb-6" aria-hidden>
        <div className="absolute -inset-4 rounded-full bg-primary/5 blur-xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border bg-card shadow-sm">
          <div className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-secondary" />
          <div className="absolute -bottom-1.5 -left-2.5 h-3 w-3 rounded-full bg-primary/20" />
          {Icon ? <Icon className="h-9 w-9 text-muted-foreground" /> : null}
        </div>
      </div>

      <h3 className="text-lg font-semibold">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-balance text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
