"use client";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import type { AdminTargetType } from "@/types/admin";

import { useAdminActions } from "../hooks/use-admin-queries";
import { AuditEntry } from "./audit-entry";
import { Panel } from "./primitives";

/**
 * The most recent audit entries — for one record, or for the whole platform.
 *
 * On a record's own page the entries do not link back to it, and the panel
 * title says "moderation history" rather than "recent activity": same data,
 * different question being asked of it.
 */
export function AuditTrail({
  target,
  limit = 8,
  title,
}: {
  target?: { type: AdminTargetType; id: string };
  limit?: number;
  title: string;
}) {
  const t = useTranslations("admin.audit");
  const { data, isPending, isError } = useAdminActions({
    target_type: target?.type,
    target_id: target?.id,
    page_size: limit,
  });

  const entries = data?.items ?? [];
  const more = (data?.total ?? 0) > entries.length;

  return (
    <Panel
      title={title}
      bodyClassName="py-0"
      action={
        !target || more ? (
          <Link
            href={
              target
                ? `${ROUTES.adminActivity}?target_type=${target.type}&target_id=${target.id}`
                : ROUTES.adminActivity
            }
            className="group inline-flex items-center gap-1 text-caption text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("viewAll")}
            <ArrowRight
              className="h-3 w-3 transition-transform ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
              aria-hidden
            />
          </Link>
        ) : undefined
      }
    >
      {isPending ? (
        <div className="space-y-3 py-4" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <p className="py-4 text-body-sm text-muted-foreground">{t("loadError")}</p>
      ) : entries.length === 0 ? (
        <p className="py-4 text-body-sm text-muted-foreground">
          {target ? t("emptyForTarget") : t("empty")}
        </p>
      ) : (
        <ul className="divide-y">
          {entries.map((action) => (
            <li key={action.id} className="py-3.5">
              <AuditEntry action={action} linkTarget={!target} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
