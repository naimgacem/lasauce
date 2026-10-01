"use client";

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
import { Link } from "@/i18n/navigation";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { UserRole, UserStatus } from "@/types/auth";

import { ClearFilters, FilterBar, FilterSelect, SearchField } from "../components/filter-bar";
import { AdminPageHeader } from "../components/page-header";
import { PersonCell } from "../components/primitives";
import { AdminQueryError, NoResults } from "../components/query-states";
import { RoleBadge, UserStatusLabel, VerifiedMark } from "../components/status";
import { LinkRow, pick, pickBoolean, SkeletonRows } from "../components/table-parts";
import { useAdminUsers } from "../hooks/use-admin-queries";
import { useUrlFilters } from "../hooks/use-url-filters";

const ROLES = ["user", "admin"] as const satisfies readonly UserRole[];
const STATUSES = ["active", "suspended", "deleted"] as const satisfies readonly UserStatus[];
const PAGE_SIZE = 25;

export function UsersView() {
  const t = useTranslations("admin.users");
  const ts = useTranslations("admin.status");
  const tc = useTranslations("admin.common");
  const locale = useLocale();
  const filters = useUrlFilters();

  const query = {
    q: filters.get("q"),
    role: pick(filters.get("role"), ROLES),
    status: pick(filters.get("status"), STATUSES),
    verified: pickBoolean(filters.get("verified")),
    page: filters.page,
    page_size: PAGE_SIZE,
  };
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useAdminUsers(query);
  const rows = data?.items ?? [];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={t("title")}
        description={
          data ? t("description", { count: data.total }) : t("descriptionLoading")
        }
      />

      <FilterBar>
        <SearchField
          value={query.q}
          onCommit={(q) => filters.set({ q })}
          placeholder={t("searchPlaceholder")}
        />
        <FilterSelect
          label={t("filterRole")}
          value={query.role}
          onChange={(role) => filters.set({ role })}
          allLabel={t("allRoles")}
          options={ROLES.map((role) => ({ value: role, label: ts(`role.${role}`) }))}
        />
        <FilterSelect
          label={t("filterStatus")}
          value={query.status}
          onChange={(status) => filters.set({ status })}
          allLabel={t("allStatuses")}
          options={STATUSES.map((status) => ({ value: status, label: ts(`user.${status}`) }))}
        />
        <FilterSelect
          label={t("filterVerified")}
          value={query.verified === undefined ? undefined : query.verified ? "true" : "false"}
          onChange={(verified) => filters.set({ verified })}
          allLabel={t("anyVerification")}
          options={[
            { value: "true", label: ts("verified") },
            { value: "false", label: ts("unverified") },
          ]}
        />
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
                <TableHead>{t("colUser")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("colVerified")}</TableHead>
                <TableHead className="hidden text-end md:table-cell">{t("colReports")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("colJoined")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("colLastActive")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <SkeletonRows columns={6} />
              ) : (
                rows.map((user) => (
                  <LinkRow key={user.id} href={ROUTES.adminUser(user.id)}>
                    <TableCell className="max-w-[18rem]">
                      <div className="flex items-center gap-2">
                        <Link
                          href={ROUTES.adminUser(user.id)}
                          className="min-w-0 rounded-md focus-visible:ring-offset-0"
                        >
                          <PersonCell
                            name={user.full_name}
                            email={user.email}
                            avatarUrl={user.avatar_url}
                          />
                        </Link>
                        <RoleBadge role={user.role} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <UserStatusLabel status={user.status} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <VerifiedMark verified={user.is_verified} />
                    </TableCell>
                    <TableCell className="hidden text-end tabular-nums md:table-cell">
                      {formatNumber(user.item_count, locale)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                      {formatDate(user.created_at, locale)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                      {user.last_active_at ? formatRelative(user.last_active_at, locale) : tc("never")}
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
