"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import { Pagination } from "@/components/shared/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatConfidence, formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminMatch } from "@/types/admin";
import type { MatchStatus } from "@/types/match";

import { FilterBar, FilterSelect } from "../components/filter-bar";
import { MatchSheet } from "../components/match-sheet";
import { AdminPageHeader } from "../components/page-header";
import { ConfidenceBar } from "../components/primitives";
import { AdminQueryError, NoResults } from "../components/query-states";
import { ItemTypeTag, MatchStatusLabel } from "../components/status";
import { pick, SkeletonRows } from "../components/table-parts";
import { useAdminMatches, useAdminStats } from "../hooks/use-admin-queries";
import { useUrlFilters } from "../hooks/use-url-filters";

const STATUSES = ["suggested", "confirmed", "rejected", "expired"] as const satisfies readonly MatchStatus[];
/** The engine's own thresholds (persist 55%, notify 70%, strong 85%) as filter steps. */
const FLOORS = ["0.85", "0.7", "0.55"] as const;
const PAGE_SIZE = 25;

function StatusTabs({
  value,
  onChange,
  counts,
}: {
  value: MatchStatus | undefined;
  onChange: (value: MatchStatus | undefined) => void;
  counts: Partial<Record<MatchStatus | "all", number>>;
}) {
  const t = useTranslations("admin.matches");
  const ts = useTranslations("admin.status.match");
  const locale = useLocale();
  const tabs: { id: MatchStatus | undefined; label: string; count?: number }[] = [
    { id: undefined, label: t("all"), count: counts.all },
    ...STATUSES.map((status) => ({ id: status, label: ts(status), count: counts[status] })),
  ];

  return (
    <div role="group" aria-label={t("statusTabs")} className="flex flex-wrap gap-1 border-b">
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id ?? "all"}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative -mb-px inline-flex h-10 items-center gap-2 border-b-2 px-3 text-body-sm font-medium transition-colors",
              "focus-visible:ring-inset focus-visible:ring-offset-0",
              selected
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="rounded-full bg-muted px-1.5 text-caption font-normal tabular-nums text-muted-foreground">
                {formatNumber(tab.count, locale)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function MatchesView() {
  const t = useTranslations("admin.matches");
  const locale = useLocale();
  const filters = useUrlFilters();
  const { data: stats } = useAdminStats();
  const [open, setOpen] = React.useState<AdminMatch | null>(null);

  const status = pick(filters.get("status"), STATUSES);
  const floor = pick(filters.get("min_confidence"), FLOORS);
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useAdminMatches({
    status,
    min_confidence: floor ? Number(floor) : undefined,
    page: filters.page,
    page_size: PAGE_SIZE,
  });
  const rows = data?.items ?? [];

  return (
    <div className="space-y-5">
      <AdminPageHeader title={t("title")} description={t("description")} />

      <StatusTabs
        value={status}
        onChange={(next) => filters.set({ status: next })}
        counts={
          stats
            ? {
                all: stats.matches.total,
                suggested: stats.matches.suggested,
                confirmed: stats.matches.confirmed,
                rejected: stats.matches.rejected,
                expired: stats.matches.expired,
              }
            : {}
        }
      />

      <FilterBar>
        <FilterSelect
          label={t("filterConfidence")}
          value={floor}
          onChange={(min_confidence) => filters.set({ min_confidence })}
          allLabel={t("anyConfidence")}
          options={FLOORS.map((value) => ({
            value,
            label: t("atLeast", { value: formatConfidence(Number(value), locale) }),
          }))}
        />
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
                <TableHead>{t("colLost")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("colFound")}</TableHead>
                <TableHead>{t("colConfidence")}</TableHead>
                <TableHead className="hidden text-end lg:table-cell">{t("colText")}</TableHead>
                <TableHead className="hidden text-end lg:table-cell">{t("colImage")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("colCreated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <SkeletonRows columns={7} />
              ) : (
                rows.map((match) => (
                  <TableRow
                    key={match.id}
                    className="cursor-pointer hover:bg-accent/40"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("button")) return;
                      setOpen(match);
                    }}
                  >
                    <TableCell className="max-w-[16rem]">
                      <button
                        type="button"
                        onClick={() => setOpen(match)}
                        className="flex min-w-0 max-w-full items-center gap-2 rounded-md text-start focus-visible:ring-offset-0"
                      >
                        <ItemTypeTag type="lost" />
                        <span className="truncate font-medium">{match.lost_item.title}</span>
                      </button>
                      {/* On narrow screens the found side folds under the lost one. */}
                      <span className="mt-1 flex min-w-0 items-center gap-2 md:hidden">
                        <ItemTypeTag type="found" />
                        <span className="truncate text-muted-foreground">{match.found_item.title}</span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden max-w-[16rem] md:table-cell">
                      <span className="flex min-w-0 items-center gap-2">
                        <ItemTypeTag type="found" />
                        <span className="truncate">{match.found_item.title}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <ConfidenceBar value={match.confidence} />
                    </TableCell>
                    <TableCell className="hidden text-end tabular-nums text-muted-foreground lg:table-cell">
                      {formatConfidence(match.text_score, locale)}
                    </TableCell>
                    <TableCell className="hidden text-end tabular-nums text-muted-foreground lg:table-cell">
                      {match.image_score === null ? "—" : formatConfidence(match.image_score, locale)}
                    </TableCell>
                    <TableCell>
                      <MatchStatusLabel status={match.status} />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {formatDate(match.created_at, locale)}
                    </TableCell>
                  </TableRow>
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

      <MatchSheet match={open} onOpenChange={(next) => !next && setOpen(null)} />
    </div>
  );
}
