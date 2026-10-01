"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * A row that opens its record when clicked anywhere.
 *
 * Mouse convenience only: the row's primary cell must still contain a real
 * `<Link>`, which is what keyboard users tab to and what middle-click and
 * "open in new tab" act on. Clicks that land on another control, or that end a
 * text selection, are left alone — copying an email out of a table must not
 * navigate away from it.
 */
export function LinkRow({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <TableRow
      className={cn("cursor-pointer hover:bg-accent/40", className)}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("a, button, input, [role='menuitem']")) return;
        if (window.getSelection()?.toString()) return;
        router.push(href);
      }}
    >
      {children}
    </TableRow>
  );
}

/** Placeholder rows that keep the table's shape while the first page loads. */
export function SkeletonRows({ columns, rows = 8 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} aria-hidden>
          {Array.from({ length: columns }).map((_, c) => (
            <TableCell key={c}>
              <Skeleton className={cn("h-4", c === 0 ? "w-40" : "w-16")} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Narrow a URL value to one of the values an endpoint accepts — or nothing. */
export function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export function pickBoolean(value: string | undefined): boolean | undefined {
  return value === "true" ? true : value === "false" ? false : undefined;
}
