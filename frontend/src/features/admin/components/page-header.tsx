import * as React from "react";
import { ArrowLeft } from "lucide-react";

import { Link } from "@/i18n/navigation";

/**
 * Console page heading. One step smaller than the product's `PageHeader`: here
 * the title labels a working surface rather than welcoming anyone, and the
 * table below it is the content.
 */
export function AdminPageHeader({
  title,
  description,
  back,
  actions,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
  /** Rendered under the title — badges, identifiers. */
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {back ? (
        <Link
          href={back.href}
          className="group inline-flex items-center gap-1.5 text-body-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft
            className="h-3.5 w-3.5 transition-transform ltr:group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5"
            aria-hidden
          />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="break-words text-heading-2">{title}</h1>
          {description ? (
            <p className="max-w-2xl text-body-sm text-muted-foreground">{description}</p>
          ) : null}
          {children}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
