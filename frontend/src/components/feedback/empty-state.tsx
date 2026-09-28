import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Empty state: what's missing, why, and the one thing to do about it. The icon
 * is a label, not an illustration — an empty list should read as calm, not as
 * a decorated dead end.
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
        "flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <span
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </span>
      ) : null}

      <h3 className="text-heading-4">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-balance text-body-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
