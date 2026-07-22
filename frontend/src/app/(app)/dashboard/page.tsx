"use client";

import Link from "next/link";
import { m } from "framer-motion";
import {
  ArrowRight,
  Bell,
  PackageOpen,
  PackageSearch,
  Plus,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { listContainer, listItem } from "@/animations";
import { EmptyState } from "@/components/feedback/empty-state";
import {
  ItemRowSkeleton,
  NotificationSkeleton,
  StatCardSkeleton,
} from "@/components/feedback/skeletons";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSession } from "@/features/auth/hooks/use-session";
import { ItemRow } from "@/features/items/components/item-row";
import { useItems } from "@/features/items/hooks/use-items";
import { PotentialMatchCard } from "@/features/matches/components/potential-match-card";
import { SAMPLE_MATCH } from "@/features/matches/sample";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";
import { formatRelative } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  accent?: "lost" | "found" | "primary";
}) {
  return (
    <m.div variants={listItem}>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <Icon
            className={
              accent === "lost"
                ? "h-4 w-4 text-lost"
                : accent === "found"
                  ? "h-4 w-4 text-found"
                  : "h-4 w-4 text-muted-foreground"
            }
            aria-hidden
          />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums">{value}</p>
        </CardContent>
      </Card>
    </m.div>
  );
}

export default function DashboardPage() {
  const { user } = useSession();
  const firstName = user?.full_name.split(" ")[0];

  const myItems = useItems({ user_id: user?.id, page_size: 100 });
  const notifications = useNotifications();

  const items = myItems.data?.items ?? [];
  const stats = {
    total: myItems.data?.total ?? 0,
    lost: items.filter((i) => i.type === "lost").length,
    found: items.filter((i) => i.type === "found").length,
    matched: items.filter((i) => i.status === "matched").length,
  };
  const recent = items.slice(0, 3);
  const recentNotifications = (notifications.data?.items ?? []).slice(0, 3);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back${firstName ? `, ${firstName}` : ""}`}
        description="Here's where your reports stand."
      >
        <Button asChild>
          <Link href={ROUTES.report}>
            <Plus className="h-4 w-4" />
            Report item
          </Link>
        </Button>
      </PageHeader>

      {/* Quick stats */}
      {myItems.isLoading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <m.div
          variants={listContainer}
          initial="initial"
          animate="enter"
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          <StatCard label="Active reports" value={stats.total} icon={PackageOpen} />
          <StatCard label="Lost" value={stats.lost} icon={Search} accent="lost" />
          <StatCard
            label="Found"
            value={stats.found}
            icon={PackageSearch}
            accent="found"
          />
          <StatCard label="With matches" value={stats.matched} icon={Sparkles} />
        </m.div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          {/* Recent reports */}
          <section aria-labelledby="recent-reports">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="recent-reports" className="text-lg font-semibold">
                Your recent reports
              </h2>
              {recent.length > 0 ? (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={ROUTES.search}>
                    Browse all
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
            </div>

            {myItems.isLoading ? (
              <div className="space-y-3" aria-busy>
                {Array.from({ length: 3 }).map((_, i) => (
                  <ItemRowSkeleton key={i} />
                ))}
              </div>
            ) : recent.length === 0 ? (
              <EmptyState
                icon={PackageOpen}
                title="No reports yet"
                description="Lost or found something? Reporting takes about two minutes — the matching engine handles the searching."
                action={
                  <Button asChild>
                    <Link href={ROUTES.report}>Report an item</Link>
                  </Button>
                }
              />
            ) : (
              <m.div
                variants={listContainer}
                initial="initial"
                animate="enter"
                className="space-y-3"
              >
                {recent.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </m.div>
            )}
          </section>

          {/* AI matching preview — flagship surface */}
          <section aria-labelledby="ai-preview">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="ai-preview" className="flex items-center gap-2 text-lg font-semibold">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
                AI matching
              </h2>
              <Badge variant="secondary">Example preview</Badge>
            </div>
            <div className="space-y-3">
              <PotentialMatchCard match={SAMPLE_MATCH} preview />
              <p className="px-1 text-xs text-muted-foreground">
                This is what a real suggestion will look like. The engine
                launches soon — your existing reports are matched
                retroactively, and you&apos;ll be notified here and by email.
              </p>
            </div>
          </section>
        </div>

        {/* Notifications preview rail */}
        <aside aria-labelledby="recent-activity" className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="recent-activity" className="text-lg font-semibold">
              Activity
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href={ROUTES.notifications}>
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {notifications.isLoading ? (
            <div className="space-y-3" aria-busy>
              {Array.from({ length: 3 }).map((_, i) => (
                <NotificationSkeleton key={i} />
              ))}
            </div>
          ) : recentNotifications.length === 0 ? (
            <Card>
              <CardHeader>
                <Bell className="h-5 w-5 text-muted-foreground" aria-hidden />
                <CardTitle className="text-sm">All quiet</CardTitle>
                <CardDescription className="text-xs">
                  Match alerts and report activity will appear here.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <m.ul
              variants={listContainer}
              initial="initial"
              animate="enter"
              className="space-y-2.5"
            >
              {recentNotifications.map((n) => (
                <m.li key={n.id} variants={listItem}>
                  <Link
                    href={n.item_id ? ROUTES.item(n.item_id) : ROUTES.notifications}
                    className="block rounded-xl border p-3.5 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-center gap-2">
                      {!n.is_read ? (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      ) : null}
                      <p className="truncate text-sm font-medium">{n.title}</p>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {n.body}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      {formatRelative(n.created_at)}
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
