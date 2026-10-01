"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatConfidence, initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Name over email, with initials. The identity cell of every people column. */
export function PersonCell({
  name,
  email,
  avatarUrl,
  size = "sm",
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
  size?: "sm" | "lg";
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      {/* Decorative: the name beside it is the accessible text, and read
          aloud the initials would prefix every heading and row ("YD Yacine…"). */}
      <Avatar className={size === "lg" ? "h-12 w-12" : "h-8 w-8"} aria-hidden>
        <AvatarImage src={avatarUrl ?? undefined} alt="" />
        <AvatarFallback className={size === "lg" ? "text-body" : "text-caption"}>
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{name}</span>
        <span className="block truncate text-caption font-normal text-muted-foreground">
          {email}
        </span>
      </span>
    </span>
  );
}

/**
 * A long identifier, shortened, that copies in full. Support conversations
 * quote ids; nobody should have to select one out of a table by hand.
 */
export function CopyableId({ value, className }: { value: string; className?: string }) {
  const t = useTranslations("admin.common");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          //  Clipboard access denied (insecure origin, permissions). The id is
          //  still in the title attribute and selectable in the detail view.
        }
      }}
      title={value}
      aria-label={t("copyIdAria", { id: value })}
      className={cn(
        "inline-flex items-center gap-1.5 rounded font-mono text-caption font-normal text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <span dir="ltr">{value.slice(0, 8)}</span>
      {copied ? (
        <Check className="h-3 w-3 text-primary" aria-hidden />
      ) : (
        <Copy className="h-3 w-3" aria-hidden />
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? t("copied") : ""}
      </span>
    </button>
  );
}

/**
 * Match confidence as a figure plus a short track. One hue (brand) for
 * magnitude — it is a value on a scale, not a category, so it gets no second
 * colour for "high" and "low".
 */
export function ConfidenceBar({ value }: { value: number }) {
  const locale = useLocale();
  return (
    <span className="flex items-center gap-2.5">
      <span className="w-10 text-end tabular-nums">{formatConfidence(value, locale)}</span>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-primary/15" aria-hidden>
        <span
          className="block h-full rounded-full bg-primary"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </span>
    </span>
  );
}

export interface Figure {
  label: string;
  value: React.ReactNode;
  /** A short second line: the breakdown or comparison that makes the number mean something. */
  hint?: React.ReactNode;
}

/**
 * Headline figures as one strip rather than a wall of cards: they are read
 * together, left to right, and separate boxes would make each compete.
 */
export function FigureStrip({ figures, loading }: { figures: Figure[]; loading?: boolean }) {
  return (
    <dl
      className={cn(
        "grid overflow-hidden rounded-xl border bg-card",
        "grid-cols-2 sm:grid-cols-3",
        figures.length >= 5 ? "xl:grid-cols-5" : "lg:grid-cols-4",
      )}
    >
      {figures.map((figure) => (
        <div
          key={figure.label}
          //  Hairlines between cells in any column count: each cell draws its
          //  own top and start edge, and the frame's overflow clips the outer ones.
          className="-ms-px -mt-px min-w-0 border-s border-t px-4 py-4 sm:px-5"
        >
          <dt className="truncate text-caption font-normal text-muted-foreground">
            {figure.label}
          </dt>
          <dd className="mt-1.5">
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <span className="block truncate text-heading-2">{figure.value}</span>
            )}
          </dd>
          {figure.hint && !loading ? (
            <dd className="mt-1 truncate text-caption font-normal text-muted-foreground">
              {figure.hint}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

/** A labelled pair in a definition list. */
export function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5">
      <dt className="shrink-0 text-body-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-end text-body-sm font-medium">{children}</dd>
    </div>
  );
}

/** A bordered section with a heading row. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className={cn("rounded-xl border bg-card", className)}>
      <div className="flex items-start justify-between gap-4 border-b px-5 py-3.5">
        <div className="min-w-0">
          <h2 id={id} className="text-body font-semibold">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-caption font-normal text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("px-5 py-4", bodyClassName)}>{children}</div>
    </section>
  );
}
