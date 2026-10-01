"use client";

import { Link2, MessageSquare, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ItemImage } from "@/features/items/components/item-image";
import { Link } from "@/i18n/navigation";
import { wilayaName } from "@/lib/algeria-wilayas";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { ItemStatus, ItemType, ProcessingStatus } from "@/types/item";

import { ClearFilters, FilterBar, FilterSelect, SearchField } from "../components/filter-bar";
import { AdminPageHeader } from "../components/page-header";
import { AdminQueryError, NoResults } from "../components/query-states";
import { ItemStatusLabel, ItemTypeTag, ProcessingLabel } from "../components/status";
import { LinkRow, pick, SkeletonRows } from "../components/table-parts";
import { useAdminItems } from "../hooks/use-admin-queries";
import { useUrlFilters } from "../hooks/use-url-filters";

const TYPES = ["lost", "found"] as const satisfies readonly ItemType[];
const STATUSES = ["open", "matched", "claimed", "closed"] as const satisfies readonly ItemStatus[];
const PROCESSING = [
  "pending",
  "embedding",
  "matching",
  "ready",
  "failed",
] as const satisfies readonly ProcessingStatus[];
const PAGE_SIZE = 25;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ItemsView() {
  const t = useTranslations("admin.items");
  const ts = useTranslations("admin.status");
  const ti = useTranslations("item");
  const locale = useLocale();
  const filters = useUrlFilters();

  const userId = filters.get("user_id");
  const query = {
    q: filters.get("q"),
    type: pick(filters.get("type"), TYPES),
    status: pick(filters.get("status"), STATUSES),
    processing_status: pick(filters.get("processing_status"), PROCESSING),
    user_id: userId && UUID.test(userId) ? userId : undefined,
    page: filters.page,
    page_size: PAGE_SIZE,
  };
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useAdminItems(query);
  const rows = data?.items ?? [];
  //  The reporter's name, for the scope chip, from any row that has it.
  const scopedTo = query.user_id ? rows[0]?.reporter : undefined;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={t("title")}
        description={data ? t("description", { count: data.total }) : t("descriptionLoading")}
      />

      <FilterBar>
        <SearchField
          value={query.q}
          onCommit={(q) => filters.set({ q })}
          placeholder={t("searchPlaceholder")}
        />
        <FilterSelect
          label={t("filterType")}
          value={query.type}
          onChange={(type) => filters.set({ type })}
          allLabel={t("allTypes")}
          options={[
            { value: "lost", label: ti("lostBadge") },
            { value: "found", label: ti("foundBadge") },
          ]}
        />
        <FilterSelect
          label={t("filterStatus")}
          value={query.status}
          onChange={(status) => filters.set({ status })}
          allLabel={t("allStatuses")}
          options={STATUSES.map((status) => ({ value: status, label: ts(`item.${status}`) }))}
        />
        <FilterSelect
          label={t("filterProcessing")}
          value={query.processing_status}
          onChange={(processing_status) => filters.set({ processing_status })}
          allLabel={t("allProcessing")}
          options={PROCESSING.map((state) => ({ value: state, label: ts(`processing.${state}`) }))}
        />
        {query.user_id ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => filters.set({ user_id: undefined })}
            aria-label={t("clearReporter")}
          >
            {scopedTo ? t("reporterScope", { name: scopedTo.full_name }) : t("reporterScopeUnknown")}
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {filters.hasFilters ? <ClearFilters onClear={filters.clear} /> : null}
      </FilterBar>

      {isError && !data ? (
        <AdminQueryError error={error} onRetry={() => refetch()} />
      ) : !isPending && rows.length === 0 ? (
        <NoResults onClear={filters.hasFilters ? filters.clear : undefined} />
      ) : (
        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colReport")}</TableHead>
                <TableHead>{t("colType")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("colProcessing")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("colReporter")}</TableHead>
                <TableHead className="hidden xl:table-cell">{t("colSignals")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("colReported")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <SkeletonRows columns={7} />
              ) : (
                rows.map((item) => (
                  <LinkRow key={item.id} href={ROUTES.adminItem(item.id)}>
                    <TableCell className="max-w-[22rem]">
                      <Link
                        href={ROUTES.adminItem(item.id)}
                        className="flex min-w-0 items-center gap-3 rounded-md focus-visible:ring-offset-0"
                      >
                        <ItemImage item={item} className="h-10 w-10 shrink-0 rounded-md" sizes="40px" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{item.title}</span>
                          <span className="block truncate text-caption font-normal text-muted-foreground">
                            {[item.category?.name, item.wilaya_code ? wilayaName(item.wilaya_code, locale) : null]
                              .filter(Boolean)
                              .join(" · ") || ti("uncategorised")}
                          </span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <ItemTypeTag type={item.type} />
                    </TableCell>
                    <TableCell>
                      <ItemStatusLabel status={item.status} closedReason={item.closed_reason} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <ProcessingLabel status={item.processing_status} />
                    </TableCell>
                    <TableCell className="hidden max-w-[12rem] lg:table-cell">
                      <span className="block truncate">{item.reporter.full_name}</span>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <span className="flex items-center gap-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1" title={t("matchesTitle")}>
                          <Link2 className="h-3.5 w-3.5" aria-hidden />
                          <span className="tabular-nums">{item.match_count}</span>
                          <span className="sr-only">{t("matchesTitle")}</span>
                        </span>
                        <span className="inline-flex items-center gap-1" title={t("claimsTitle")}>
                          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                          <span className="tabular-nums">{item.pending_claim_count}</span>
                          <span className="sr-only">{t("claimsTitle")}</span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {formatDate(item.created_at, locale)}
                    </TableCell>
                  </LinkRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
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
