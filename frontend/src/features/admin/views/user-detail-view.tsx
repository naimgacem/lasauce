"use client";

import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatDate, formatDateTime, formatNumber, formatPrice, formatRelative } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { AdminUserDetail } from "@/types/admin";

import { AuditTrail } from "../components/audit-trail";
import { AdminPageHeader } from "../components/page-header";
import { CopyableId, Fact, FigureStrip, Panel, PersonCell } from "../components/primitives";
import { AdminQueryError } from "../components/query-states";
import {
  ItemStatusLabel,
  ItemTypeTag,
  PaymentStatusLabel,
  RoleBadge,
  UserStatusLabel,
  VerifiedMark,
} from "../components/status";
import { UserActions } from "../components/user-actions";
import { useAdminItems, useAdminUser } from "../hooks/use-admin-queries";

const REPORTS_SHOWN = 8;

function UserReports({ userId }: { userId: string }) {
  const t = useTranslations("admin.userDetail");
  const locale = useLocale();
  const { data, isPending } = useAdminItems({ user_id: userId, page_size: REPORTS_SHOWN });
  const rows = data?.items ?? [];

  return (
    <Panel
      title={t("reports")}
      bodyClassName="p-0"
      action={
        (data?.total ?? 0) > rows.length ? (
          <Link
            href={`${ROUTES.adminItems}?user_id=${userId}`}
            className="group inline-flex items-center gap-1 text-caption text-muted-foreground hover:text-foreground"
          >
            {t("allReports", { count: data?.total ?? 0 })}
            <ArrowRight
              className="h-3 w-3 transition-transform ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
              aria-hidden
            />
          </Link>
        ) : undefined
      }
    >
      {isPending ? (
        <div className="space-y-3 p-5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-4 text-body-sm text-muted-foreground">{t("noReports")}</p>
      ) : (
        <ul className="divide-y">
          {rows.map((item) => (
            <li key={item.id}>
              <Link
                href={ROUTES.adminItem(item.id)}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/40 focus-visible:ring-inset focus-visible:ring-offset-0"
              >
                <ItemTypeTag type={item.type} />
                <span className="min-w-0 flex-1 truncate text-body-sm font-medium">
                  {item.title}
                </span>
                <span className="hidden text-caption font-normal sm:inline">
                  <ItemStatusLabel status={item.status} closedReason={item.closed_reason} />
                </span>
                <span className="w-24 shrink-0 text-end text-caption font-normal text-muted-foreground">
                  {formatDate(item.created_at, locale)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function CreditsPanel({ user }: { user: AdminUserDetail }) {
  const t = useTranslations("admin.userDetail");
  const tl = useTranslations("admin.ledger");
  const locale = useLocale();

  return (
    <Panel title={t("credits")} description={t("creditsDescription")} bodyClassName="p-0">
      {user.ledger.length === 0 && user.payments.length === 0 ? (
        <p className="px-5 py-4 text-body-sm text-muted-foreground">{t("noCredits")}</p>
      ) : (
        <div className="divide-y">
          {user.ledger.length > 0 ? (
            <ul className="divide-y">
              {user.ledger.map((entry) => (
                <li key={entry.id} className="flex items-start gap-4 px-5 py-3">
                  <span
                    className={cn(
                      "w-10 shrink-0 text-body-sm font-semibold tabular-nums",
                      entry.delta > 0 ? "text-foreground" : "text-muted-foreground",
                    )}
                    dir="ltr"
                  >
                    {entry.delta > 0 ? `+${entry.delta}` : entry.delta}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body-sm">{tl(entry.reason)}</span>
                    {entry.note ? (
                      <span className="block truncate text-caption font-normal text-muted-foreground">
                        {entry.note}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-caption font-normal text-muted-foreground">
                    {formatDate(entry.created_at, locale)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {user.payments.length > 0 ? (
            <div className="px-5 py-4">
              <h3 className="mb-2 text-caption font-medium text-muted-foreground">{t("payments")}</h3>
              <ul className="space-y-2">
                {user.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-4 text-body-sm">
                    <Link
                      href={`${ROUTES.adminPayments}?payment=${payment.id}`}
                      className="tabular-nums hover:underline"
                    >
                      {formatPrice(payment.amount, payment.currency, locale)}
                    </Link>
                    <PaymentStatusLabel status={payment.status} />
                    <span className="text-caption font-normal text-muted-foreground">
                      {formatDate(payment.created_at, locale)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

export function UserDetailView({ userId }: { userId: string }) {
  const t = useTranslations("admin.userDetail");
  const tc = useTranslations("admin.common");
  const tn = useTranslations("admin.nav");
  const locale = useLocale();
  const { data: user, isPending, isError, error, refetch } = useAdminUser(userId);

  const back = { href: ROUTES.adminUsers, label: tn("users") };

  if (isError && !user) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title={t("notFound")} back={back} />
        <AdminQueryError error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  if (isPending || !user) {
    return (
      <div className="space-y-6" aria-busy>
        <Skeleton className="h-4 w-20" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  const { stats } = user;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        back={back}
        title={<PersonCell name={user.full_name} email={user.email} avatarUrl={user.avatar_url} size="lg" />}
        actions={<UserActions user={user} />}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-body-sm">
          <RoleBadge role={user.role} />
          <UserStatusLabel status={user.status} />
          <VerifiedMark verified={user.is_verified} />
          <CopyableId value={user.id} />
        </div>
      </AdminPageHeader>

      <FigureStrip
        figures={[
          {
            label: t("figReports"),
            value: formatNumber(stats.items_total, locale),
            hint: t("figReportsHint", { open: stats.items_open, recovered: stats.items_recovered }),
          },
          {
            label: t("figClaims"),
            value: formatNumber(stats.claims_submitted, locale),
          },
          {
            label: t("figBalance"),
            value: formatNumber(stats.credit_balance, locale),
            hint: t("figBalanceHint", { count: stats.free_unlocks_used }),
          },
          {
            label: t("figPaid"),
            //  Payments carry their own currency; an account with none has paid nothing.
            value: formatPrice(stats.amount_paid, user.payments[0]?.currency, locale),
            hint: t("figPaidHint", { count: stats.payments_paid }),
          },
          {
            label: t("figSessions"),
            value: formatNumber(stats.active_sessions, locale),
            hint: user.last_active_at
              ? t("figSessionsHint", { relative: formatRelative(user.last_active_at, locale) })
              : tc("never"),
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <UserReports userId={user.id} />
          <CreditsPanel user={user} />
        </div>
        <div className="min-w-0 space-y-6">
          <Panel title={t("account")}>
            <dl className="-my-2.5 divide-y">
              <Fact label={t("email")}>
                <span dir="ltr">{user.email}</span>
              </Fact>
              <Fact label={t("phone")}>
                {user.phone ? <span dir="ltr">{user.phone}</span> : <span className="text-muted-foreground">—</span>}
              </Fact>
              <Fact label={t("joined")}>{formatDate(user.created_at, locale)}</Fact>
              <Fact label={t("lastActive")}>
                {user.last_active_at ? formatDateTime(user.last_active_at, locale) : tc("never")}
              </Fact>
            </dl>
          </Panel>
          <AuditTrail title={t("history")} target={{ type: "user", id: user.id }} />
        </div>
      </div>
    </div>
  );
}
