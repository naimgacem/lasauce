"use client";

import { ScrollText, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/feedback/empty-state";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { AdminActionType, AdminTargetType } from "@/types/admin";

import { AuditEntry } from "../components/audit-entry";
import { ClearFilters, FilterBar, FilterSelect } from "../components/filter-bar";
import { AdminPageHeader } from "../components/page-header";
import { AdminQueryError, NoResults } from "../components/query-states";
import { pick } from "../components/table-parts";
import { useAdminActions } from "../hooks/use-admin-queries";
import { useUrlFilters } from "../hooks/use-url-filters";

const ACTIONS = [
  "suspend_user",
  "reactivate_user",
  "change_role",
  "verify_user",
  "grant_credits",
  "close_item",
  "reopen_item",
  "reprocess_item",
  "delete_image",
  "retract_match",
  "retry_failed_items",
] as const satisfies readonly AdminActionType[];
const TARGETS = ["user", "item", "match", "system"] as const satisfies readonly AdminTargetType[];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 30;

export function ActivityView() {
  const t = useTranslations("admin.activity");
  const filters = useUrlFilters();

  const targetId = filters.get("target_id");
  const query = {
    action: pick(filters.get("action"), ACTIONS),
    target_type: pick(filters.get("target_type"), TARGETS),
    target_id: targetId && UUID.test(targetId) ? targetId : undefined,
    page: filters.page,
    page_size: PAGE_SIZE,
  };
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useAdminActions(query);
  const rows = data?.items ?? [];

  return (
    <div className="space-y-5">
      <AdminPageHeader title={t("title")} description={t("description")} />

      <FilterBar>
        <FilterSelect
          label={t("filterAction")}
          value={query.action}
          onChange={(action) => filters.set({ action })}
          allLabel={t("allActions")}
          className="min-w-[12rem]"
          options={ACTIONS.map((action) => ({ value: action, label: t(`actions.${action}`) }))}
        />
        <FilterSelect
          label={t("filterTarget")}
          value={query.target_type}
          onChange={(target_type) => filters.set({ target_type, target_id: undefined })}
          allLabel={t("allTargets")}
          options={TARGETS.map((target) => ({ value: target, label: t(`targets.${target}`) }))}
        />
        {query.target_id ? (
          <Button variant="secondary" size="sm" onClick={() => filters.set({ target_id: undefined })}>
            {t("oneRecord")}
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {filters.hasFilters ? <ClearFilters onClear={filters.clear} /> : null}
      </FilterBar>

      {isError && !data ? (
        <AdminQueryError error={error} onRetry={() => refetch()} />
      ) : isPending ? (
        <div className="space-y-4 rounded-xl border bg-card p-5" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        filters.hasFilters ? (
          <NoResults onClear={filters.clear} />
        ) : (
          <EmptyState icon={ScrollText} title={t("emptyTitle")} description={t("emptyBody")} />
        )
      ) : (
        <ul
          className={cn(
            "divide-y rounded-xl border bg-card transition-opacity",
            isPlaceholderData && "opacity-60",
          )}
        >
          {rows.map((action) => (
            <li key={action.id} className="px-5 py-4">
              <AuditEntry action={action} />
            </li>
          ))}
        </ul>
      )}

      {data ? (
        <Pagination
          page={data.page}
          totalPages={data.total_pages}
          total={data.total}
          onPageChange={filters.setPage}
        />
      ) : null}
    </div>
  );
}
