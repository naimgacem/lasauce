"use client";

import * as React from "react";
import { ArrowRight, RefreshCw, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Spinner } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatConfidence, formatNumber, formatPrice, formatRelative } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { AdminStats } from "@/types/admin";

import { ActivityChart } from "../components/activity-chart";
import { AuditTrail } from "../components/audit-trail";
import { AdminPageHeader } from "../components/page-header";
import { FigureStrip, Panel } from "../components/primitives";
import { AdminQueryError } from "../components/query-states";
import { useRetryFailed } from "../hooks/use-admin-commands";
import { useAdminStats } from "../hooks/use-admin-queries";

/** A label, a value, and optionally the list that value came from. */
function Row({
  label,
  value,
  href,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
  emphasis?: boolean;
}) {
  const content = (
    <>
      <span className="text-body-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-body-sm font-semibold tabular-nums",
          emphasis ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </span>
    </>
  );
  return href ? (
    <Link
      href={href}
      className="-mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-2 transition-colors hover:bg-accent/60"
    >
      {content}
    </Link>
  ) : (
    <div className="flex items-center justify-between gap-4 py-2">{content}</div>
  );
}

function PipelinePanel({ stats }: { stats: AdminStats }) {
  const t = useTranslations("admin.overview.pipeline");
  const locale = useLocale();
  const retry = useRetryFailed();
  const { pipeline } = stats;
  const inFlight = pipeline.embedding + pipeline.matching;

  return (
    <Panel title={t("title")} description={t("description")}>
      <div className="divide-y">
        <Row
          label={t("waiting")}
          value={formatNumber(pipeline.pending, locale)}
          href={pipeline.pending ? `${ROUTES.adminItems}?processing_status=pending` : undefined}
        />
        <Row label={t("working")} value={formatNumber(inFlight, locale)} />
        <Row
          label={t("failed")}
          value={formatNumber(pipeline.failed, locale)}
          href={pipeline.failed ? `${ROUTES.adminItems}?processing_status=failed` : undefined}
          emphasis={pipeline.failed > 0}
        />
        <Row
          label={t("queue")}
          value={
            pipeline.queue_depth === null ? (
              <span className="font-normal text-muted-foreground">{t("queueUnknown")}</span>
            ) : (
              formatNumber(pipeline.queue_depth, locale)
            )
          }
        />
      </div>
      <div className="mt-4 space-y-2 border-t pt-4">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          disabled={pipeline.failed === 0 || retry.isPending}
          onClick={() => retry.mutate()}
        >
          {retry.isPending ? <Spinner /> : <RotateCcw className="h-4 w-4" />}
          {t("retry", { count: pipeline.failed })}
        </Button>
        <p className="text-caption font-normal text-muted-foreground">{t("retryHint")}</p>
      </div>
    </Panel>
  );
}

function MatchQualityPanel({ stats }: { stats: AdminStats }) {
  const t = useTranslations("admin.overview.quality");
  const ts = useTranslations("admin.status.match");
  const locale = useLocale();
  const { matches } = stats;
  const judged = matches.confirmed + matches.rejected;
  const rows = (["suggested", "confirmed", "rejected", "expired"] as const).map((status) => ({
    status,
    count: matches[status],
  }));
  const peak = Math.max(1, ...rows.map((r) => r.count));

  return (
    <Panel
      title={t("title")}
      description={t("description")}
      action={
        <Link
          href={ROUTES.adminMatches}
          className="group inline-flex items-center gap-1 text-caption text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("review")}
          <ArrowRight
            className="h-3 w-3 transition-transform ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
            aria-hidden
          />
        </Link>
      }
    >
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-body-sm text-muted-foreground">{t("confirmRate")}</span>
          <span className="text-heading-3">
            {matches.confirm_rate === null ? "—" : formatConfidence(matches.confirm_rate, locale)}
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-primary/15"
          role="meter"
          aria-label={t("confirmRate")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((matches.confirm_rate ?? 0) * 100)}
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.round((matches.confirm_rate ?? 0) * 100)}%` }}
          />
        </div>
        <p className="text-caption font-normal text-muted-foreground">
          {judged === 0 ? t("noVerdicts") : t("judged", { confirmed: matches.confirmed, judged })}
        </p>
      </div>

      <ul className="mt-5 space-y-2.5 border-t pt-4">
        {rows.map((row) => (
          <li key={row.status} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2.5rem] items-center gap-3">
            <Link
              href={`${ROUTES.adminMatches}?status=${row.status}`}
              className="truncate text-body-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {ts(row.status)}
            </Link>
            <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span
                className="block h-full rounded-full bg-primary/70"
                style={{ width: `${(row.count / peak) * 100}%` }}
              />
            </span>
            <span className="text-end text-body-sm font-medium tabular-nums">
              {formatNumber(row.count, locale)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">
        {(
          [
            ["avgConfirmed", matches.avg_confidence_confirmed],
            ["avgRejected", matches.avg_confidence_rejected],
          ] as const
        ).map(([key, value]) => (
          <div key={key}>
            <dt className="text-caption font-normal text-muted-foreground">{t(key)}</dt>
            <dd className="mt-0.5 text-body font-semibold tabular-nums">
              {value === null ? "—" : formatConfidence(value, locale)}
            </dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function CommunityPanel({ stats }: { stats: AdminStats }) {
  const t = useTranslations("admin.overview.community");
  const locale = useLocale();
  const unverified = stats.users.total - stats.users.verified;
  return (
    <Panel title={t("title")} description={t("description")}>
      <div className="divide-y">
        <Row label={t("pendingClaims")} value={formatNumber(stats.claims.pending, locale)} />
        <Row label={t("approvedClaims")} value={formatNumber(stats.claims.approved, locale)} />
        <Row
          label={t("suspended")}
          value={formatNumber(stats.users.suspended, locale)}
          href={`${ROUTES.adminUsers}?status=suspended`}
        />
        <Row
          label={t("unverified")}
          value={formatNumber(unverified, locale)}
          href={`${ROUTES.adminUsers}?verified=false`}
        />
        <Row
          label={t("admins")}
          value={formatNumber(stats.users.admins, locale)}
          href={`${ROUTES.adminUsers}?role=admin`}
        />
      </div>
    </Panel>
  );
}

function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 rounded-xl border bg-card p-5", className)} aria-busy>
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function OverviewView() {
  const t = useTranslations("admin.overview");
  const locale = useLocale();
  const { data: stats, isPending, isError, error, refetch, isFetching } = useAdminStats();

  if (isError && !stats) return <AdminQueryError error={error} onRetry={() => refetch()} />;

  const judged = stats ? stats.matches.confirmed + stats.matches.rejected : 0;
  const signups = stats?.activity.reduce((sum, day) => sum + day.signups, 0) ?? 0;
  const reports = stats?.activity.reduce((sum, day) => sum + day.lost + day.found, 0) ?? 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <>
            {stats ? (
              <span className="text-caption font-normal text-muted-foreground">
                {t("updated", { relative: formatRelative(stats.generated_at, locale) })}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label={t("refresh")}
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </>
        }
      />

      <FigureStrip
        loading={isPending}
        figures={[
          {
            label: t("figures.users"),
            value: formatNumber(stats?.users.total ?? 0, locale),
            hint: t("figures.usersHint", { count: stats?.users.new_7d ?? 0 }),
          },
          {
            label: t("figures.openReports"),
            value: formatNumber((stats?.items.open_lost ?? 0) + (stats?.items.open_found ?? 0), locale),
            hint: t("figures.openReportsHint", {
              lost: stats?.items.open_lost ?? 0,
              found: stats?.items.open_found ?? 0,
            }),
          },
          {
            label: t("figures.recovered"),
            value: formatNumber(stats?.items.recovered ?? 0, locale),
            hint: t("figures.recoveredHint"),
          },
          {
            label: t("figures.confirmRate"),
            value:
              stats?.matches.confirm_rate == null
                ? "—"
                : formatConfidence(stats.matches.confirm_rate, locale),
            hint: t("figures.confirmRateHint", {
              confirmed: stats?.matches.confirmed ?? 0,
              judged,
            }),
          },
          {
            label: t("figures.revenue"),
            value: formatPrice(stats?.revenue.last_30d ?? 0, stats?.revenue.currency, locale),
            hint: t("figures.revenueHint", {
              total: formatPrice(stats?.revenue.total ?? 0, stats?.revenue.currency, locale),
            }),
          },
        ]}
      />

      {isPending || !stats ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <PanelSkeleton className="lg:col-span-2" />
          <PanelSkeleton />
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel
              className="min-w-0 lg:col-span-2"
              title={t("chart.title")}
              description={t("chart.description", { count: reports })}
              action={
                <span className="text-caption font-normal text-muted-foreground">
                  {t("chart.signupsTotal", { count: signups })}
                </span>
              }
            >
              <ActivityChart data={stats.activity} refreshing={isFetching} />
            </Panel>
            <PipelinePanel stats={stats} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <MatchQualityPanel stats={stats} />
            <CommunityPanel stats={stats} />
            <AuditTrail title={t("recentActivity")} limit={5} />
          </div>
        </>
      )}
    </div>
  );
}
