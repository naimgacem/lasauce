"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { m } from "framer-motion";
import { ArrowRight, Bell, PackageOpen } from "lucide-react";

import { listContainer, listItem } from "@/animations";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  ItemRowSkeleton,
  NotificationSkeleton,
} from "@/components/feedback/skeletons";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { ItemRow } from "@/features/items/components/item-row";
import { useItems } from "@/features/items/hooks/use-items";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";
import { formatRelative } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

/** "Title ······ Link →" row that opens each dashboard section. */
function SectionHeading({
  id,
  title,
  href,
  linkLabel,
}: {
  id: string;
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-4">
      <h2 id={id} className="text-heading-4">
        {title}
      </h2>
      {href && linkLabel ? (
        <Link
          href={href}
          className="group inline-flex items-center gap-1 text-body-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground"
        >
          {linkLabel}
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform duration-200 ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
            aria-hidden
          />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * One strip of figures instead of four cards. The numbers are a summary to
 * glance at, not destinations, so they get the weight of a table row rather
 * than of four competing boxes. Lost and found carry their semantic colour as
 * a small key, the way a chart legend would.
 */
function StatStrip({
  stats,
  loading,
}: {
  stats: { label: string; value: number; tone?: "lost" | "found" }[];
  loading: boolean;
}) {
  return (
    <dl className="grid grid-cols-4 divide-x rounded-xl border bg-card rtl:divide-x-reverse">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0 px-3 py-3 sm:px-5 sm:py-4">
          <dt className="flex items-center gap-1.5 truncate text-caption font-normal text-muted-foreground">
            {stat.tone ? (
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-[2px]",
                  stat.tone === "lost" ? "bg-lost" : "bg-found",
                )}
                aria-hidden
              />
            ) : null}
            {stat.label}
          </dt>
          <dd className="mt-1 text-heading-2 tabular-nums">
            {loading ? <Skeleton className="h-7 w-8" /> : stat.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tn = useTranslations("notifications");
  const locale = useLocale();
  const { user } = useSession();
  const firstName = user?.full_name.split(" ")[0];

  // Gated on the user id: an undefined `user_id` is dropped from the request,
  // which would turn these personal stats into a count of the whole database.
  const myItems = useItems(
    { user_id: user?.id, page_size: 100 },
    { enabled: Boolean(user?.id) },
  );
  const notifications = useNotifications();

  const items = myItems.data?.items ?? [];
  const recent = items.slice(0, 4);
  const recentNotifications = (notifications.data?.items ?? []).slice(0, 4);

  return (
    <div className="space-y-8">
      {/* No "Report an item" button here: the header (desktop) and the raised
          tab-bar button (mobile) already put it one tap away on every screen. */}
      <PageHeader
        title={firstName ? t("welcomeNamed", { name: firstName }) : t("welcome")}
        description={t("subtitle")}
      />

      <StatStrip
        loading={myItems.isLoading}
        stats={[
          { label: t("statTotal"), value: myItems.data?.total ?? 0 },
          {
            label: t("statLost"),
            value: items.filter((i) => i.type === "lost").length,
            tone: "lost",
          },
          {
            label: t("statFound"),
            value: items.filter((i) => i.type === "found").length,
            tone: "found",
          },
          {
            label: t("statMatched"),
            value: items.filter((i) => i.status === "matched").length,
          },
        ]}
      />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
        <section aria-labelledby="recent-reports" className="min-w-0">
          <SectionHeading
            id="recent-reports"
            title={t("recentReports")}
            href={recent.length > 0 ? ROUTES.myItems : undefined}
            linkLabel={t("viewAll")}
          />

          {myItems.isLoading ? (
            <div className="space-y-2" aria-busy>
              {Array.from({ length: 3 }).map((_, i) => (
                <ItemRowSkeleton key={i} />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title={t("emptyTitle")}
              description={t("emptyBody")}
              action={
                <Button asChild>
                  <Link href={ROUTES.report}>{tc("reportItem")}</Link>
                </Button>
              }
            />
          ) : (
            <m.div
              variants={listContainer}
              initial="initial"
              animate="enter"
              className="space-y-2"
            >
              {recent.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </m.div>
          )}
        </section>

        <aside aria-labelledby="recent-activity" className="min-w-0">
          <SectionHeading
            id="recent-activity"
            title={t("activity")}
            href={ROUTES.notifications}
            linkLabel={t("viewAll")}
          />

          {notifications.isLoading ? (
            <div className="space-y-2" aria-busy>
              {Array.from({ length: 3 }).map((_, i) => (
                <NotificationSkeleton key={i} />
              ))}
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-dashed p-4">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-body-sm font-medium">{t("allQuiet")}</p>
                <p className="mt-0.5 text-caption font-normal text-muted-foreground">
                  {t("activityBody")}
                </p>
              </div>
            </div>
          ) : (
            <m.ul
              variants={listContainer}
              initial="initial"
              animate="enter"
              className="divide-y overflow-hidden rounded-xl border bg-card"
            >
              {recentNotifications.map((n) => (
                <m.li key={n.id} variants={listItem}>
                  <Link
                    href={n.item_id ? ROUTES.item(n.item_id) : ROUTES.notifications}
                    className="block p-3.5 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring focus-visible:ring-offset-0"
                  >
                    <div className="flex items-center gap-2">
                      {!n.is_read ? (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                          role="img"
                          aria-label={tn("unread")}
                        />
                      ) : null}
                      <p className="truncate text-body-sm font-medium">{n.title}</p>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-caption font-normal text-muted-foreground">
                      {n.body}
                    </p>
                    <p className="mt-1.5 text-caption font-normal text-muted-foreground/80">
                      {formatRelative(n.created_at, locale)}
                    </p>
                  </Link>
                </m.li>
              ))}
            </m.ul>
          )}
        </aside>
      </div>
    </div>
  );
}
