"use client";

import { useLocale, useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/shared/pagination";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { isRtl } from "@/i18n/routing";
import { formatDateTime, formatNumber, formatPrice } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { PaymentStatus } from "@/types/billing";

import { ClearFilters, FilterBar, FilterSelect } from "../components/filter-bar";
import { AdminPageHeader } from "../components/page-header";
import { CopyableId, Fact, FigureStrip, PersonCell } from "../components/primitives";
import { AdminQueryError, NoResults } from "../components/query-states";
import { PaymentStatusLabel } from "../components/status";
import { pick, SkeletonRows } from "../components/table-parts";
import { useAdminPayment, useAdminPayments, useAdminStats } from "../hooks/use-admin-queries";
import { useUrlFilters } from "../hooks/use-url-filters";

const STATUSES = ["pending", "paid", "failed", "canceled", "expired"] as const satisfies readonly PaymentStatus[];
const PROVIDERS = ["chargily", "manual"] as const;
const PAGE_SIZE = 25;

function PaymentSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const t = useTranslations("admin.payments");
  const tp = useTranslations("billing.packs");
  const locale = useLocale();
  const { data: payment, isPending, isError } = useAdminPayment(id);
  //  Packs are named by id in the catalogue. The id arrives from the API as a
  //  plain string, and a pack retired since the purchase still reads as itself.
  type PackId = Parameters<typeof tp>[0];
  const packName = (packId: string) =>
    tp.has(packId as PackId) ? tp(packId as PackId) : packId;

  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isRtl(locale) ? "left" : "right"}
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>
            {payment ? formatPrice(payment.amount, payment.currency, locale) : t("sheetTitle")}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {payment ? (
              <>
                <PaymentStatusLabel status={payment.status} />
                <span>{formatDateTime(payment.created_at, locale)}</span>
              </>
            ) : (
              t("sheetTitle")
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 px-6 py-5">
          {isPending ? (
            <div className="space-y-3" aria-busy>
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : isError || !payment ? (
            <p className="text-body-sm text-muted-foreground">{t("loadError")}</p>
          ) : (
            <>
              <Link href={ROUTES.adminUser(payment.user.id)} className="block rounded-md">
                <PersonCell name={payment.user.full_name} email={payment.user.email} />
              </Link>

              <dl className="divide-y border-y">
                <Fact label={t("pack")}>{t("packLabel", { pack: packName(payment.pack_id), count: payment.credits })}</Fact>
                <Fact label={t("provider")}>{payment.provider}</Fact>
                <Fact label={t("providerRef")}>
                  {payment.provider_ref ? <CopyableId value={payment.provider_ref} /> : "—"}
                </Fact>
                <Fact label={t("paymentId")}>
                  <CopyableId value={payment.id} />
                </Fact>
                <Fact label={t("paidAt")}>{formatDateTime(payment.paid_at, locale)}</Fact>
                {payment.failure_reason ? (
                  <Fact label={t("failureReason")}>{payment.failure_reason}</Fact>
                ) : null}
              </dl>

              <section className="space-y-2">
                <h3 className="text-body-sm font-semibold">{t("payload")}</h3>
                <p className="text-caption font-normal text-muted-foreground">{t("payloadHint")}</p>
                <pre
                  dir="ltr"
                  className="max-h-80 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-[0.75rem] leading-relaxed"
                >
                  {JSON.stringify(payment.provider_payload, null, 2)}
                </pre>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function PaymentsView() {
  const t = useTranslations("admin.payments");
  const ts = useTranslations("admin.status.payment");
  const locale = useLocale();
  const filters = useUrlFilters();
  const { data: stats, isPending: statsPending } = useAdminStats();

  const status = pick(filters.get("status"), STATUSES);
  const provider = pick(filters.get("provider"), PROVIDERS);
  const openId = filters.get("payment") ?? null;
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useAdminPayments({
    status,
    provider,
    page: filters.page,
    page_size: PAGE_SIZE,
  });
  const rows = data?.items ?? [];
  const currency = stats?.revenue.currency ?? "dzd";

  return (
    <div className="space-y-5">
      <AdminPageHeader title={t("title")} description={t("description")} />

      <FigureStrip
        loading={statsPending}
        figures={[
          { label: t("figTotal"), value: formatPrice(stats?.revenue.total ?? 0, currency, locale) },
          { label: t("figMonth"), value: formatPrice(stats?.revenue.last_30d ?? 0, currency, locale) },
          { label: t("figPaid"), value: formatNumber(stats?.revenue.paid_count ?? 0, locale) },
          {
            label: t("figPending"),
            value: formatNumber(stats?.revenue.pending_count ?? 0, locale),
            hint: t("figPendingHint"),
          },
        ]}
      />

      <FilterBar>
        <FilterSelect
          label={t("filterStatus")}
          value={status}
          onChange={(next) => filters.set({ status: next, payment: undefined })}
          allLabel={t("allStatuses")}
          options={STATUSES.map((value) => ({ value, label: ts(value) }))}
        />
        <FilterSelect
          label={t("filterProvider")}
          value={provider}
          onChange={(next) => filters.set({ provider: next, payment: undefined })}
          allLabel={t("allProviders")}
          options={PROVIDERS.map((value) => ({ value, label: value }))}
        />
        {status || provider ? (
          <ClearFilters onClear={() => filters.set({ status: undefined, provider: undefined })} />
        ) : null}
      </FilterBar>

      {isError && !data ? (
        <AdminQueryError error={error} onRetry={() => refetch()} />
      ) : !isPending && rows.length === 0 ? (
        status || provider ? (
          <NoResults onClear={() => filters.set({ status: undefined, provider: undefined })} />
        ) : (
          <p className="rounded-xl border border-dashed px-6 py-12 text-center text-body-sm text-muted-foreground">
            {t("empty")}
          </p>
        )
      ) : (
        <div className={isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colCustomer")}</TableHead>
                <TableHead className="text-end">{t("colAmount")}</TableHead>
                <TableHead className="hidden text-end sm:table-cell">{t("colCredits")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("colProvider")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("colCreated")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPending ? (
                <SkeletonRows columns={6} />
              ) : (
                rows.map((payment) => (
                  <TableRow
                    key={payment.id}
                    className="cursor-pointer hover:bg-accent/40"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("a, button")) return;
                      filters.set({ payment: payment.id }, { keepPage: true });
                    }}
                  >
                    <TableCell className="max-w-[16rem]">
                      <button
                        type="button"
                        onClick={() => filters.set({ payment: payment.id }, { keepPage: true })}
                        className="block min-w-0 max-w-full rounded-md text-start focus-visible:ring-offset-0"
                      >
                        <PersonCell name={payment.user.full_name} email={payment.user.email} />
                      </button>
                    </TableCell>
                    <TableCell className="text-end font-medium tabular-nums">
                      {formatPrice(payment.amount, payment.currency, locale)}
                    </TableCell>
                    <TableCell className="hidden text-end tabular-nums text-muted-foreground sm:table-cell">
                      {payment.credits}
                    </TableCell>
                    <TableCell>
                      <PaymentStatusLabel status={payment.status} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {payment.provider}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                      {formatDateTime(payment.created_at, locale)}
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

      <PaymentSheet
        id={openId}
        onClose={() => filters.set({ payment: undefined }, { keepPage: true })}
      />
    </div>
  );
}
