"use client";

import { m } from "framer-motion";
import { BellOff, CheckCheck } from "lucide-react";

import { listContainer } from "@/animations";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Spinner } from "@/components/feedback/loading";
import { NotificationSkeleton } from "@/components/feedback/skeletons";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "@/features/notifications/components/notification-item";
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
} from "@/features/notifications/hooks/use-notifications";
import { formatDate } from "@/lib/format";
import type { AppNotification } from "@/types/notification";

/** Group by day with human labels. */
function groupByDay(items: AppNotification[]) {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();

  const groups = new Map<string, AppNotification[]>();
  for (const n of items) {
    const day = new Date(n.created_at).toDateString();
    const label =
      day === today ? "Today" : day === yesterday ? "Yesterday" : formatDate(n.created_at);
    const bucket = groups.get(label) ?? [];
    bucket.push(n);
    groups.set(label, bucket);
  }
  return [...groups.entries()];
}

export default function NotificationsPage() {
  const { data, isLoading, isError, error, refetch } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const items = data?.items ?? [];
  const unread = items.filter((n) => !n.is_read).length;
  const groups = groupByDay(items);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Notifications"
        description={
          unread > 0
            ? `${unread} unread notification${unread === 1 ? "" : "s"}`
            : "You're all caught up."
        }
      >
        {unread > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            {markAllRead.isPending ? <Spinner /> : <CheckCheck className="h-4 w-4" />}
            Mark all read
          </Button>
        ) : null}
      </PageHeader>

      {isLoading ? (
        <div className="space-y-3" aria-busy>
          {Array.from({ length: 4 }).map((_, i) => (
            <NotificationSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Couldn't load notifications"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="No notifications yet"
          description="When the matching engine finds something — or someone interacts with your reports — it shows up here."
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([label, bucket]) => (
            <section key={label} aria-label={label}>
              <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </h2>
              <m.ul
                variants={listContainer}
                initial="initial"
                animate="enter"
                className="space-y-2"
              >
                {bucket.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={(id) => markRead.mutate(id)}
                  />
                ))}
              </m.ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
