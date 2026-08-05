"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { m } from "framer-motion";
import { Archive, PackageOpen, Plus, Search } from "lucide-react";

import { listContainer } from "@/animations";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ItemRowSkeleton } from "@/components/feedback/skeletons";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/use-session";
import { MyItemRow } from "@/features/items/components/my-item-row";
import { useItems } from "@/features/items/hooks/use-items";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { ItemQuery } from "@/types/item";

type TabId = "lost" | "found" | "closed";

const TAB_QUERIES: Record<TabId, Partial<ItemQuery>> = {
  lost: { type: "lost" },
  found: { type: "found" },
  // The API hides closed items unless a status is named explicitly.
  closed: { status: "closed" },
};

export default function MyItemsPage() {
  const t = useTranslations("myItems");
  const tc = useTranslations("common");
  const { user } = useSession();
  const [tab, setTab] = React.useState<TabId>("lost");

  const TABS: { id: TabId; label: string; query: Partial<ItemQuery> }[] = [
    { id: "lost", label: t("tabLost"), query: TAB_QUERIES.lost },
    { id: "found", label: t("tabFound"), query: TAB_QUERIES.found },
    { id: "closed", label: t("tabClosed"), query: TAB_QUERIES.closed },
  ];

  const EMPTY: Record<TabId, { title: string; description: string }> = {
    lost: { title: t("emptyLostTitle"), description: t("emptyLostBody") },
    found: { title: t("emptyFoundTitle"), description: t("emptyFoundBody") },
    closed: { title: t("emptyClosedTitle"), description: t("emptyClosedBody") },
  };

  const active = TABS.find((opt) => opt.id === tab)!;
  const { data, isPending, isError, error, refetch } = useItems(
    { user_id: user?.id, page_size: 50, ...active.query },
    // Never query before the session is known: without `user_id` the API would
    // happily return every user's items and present them as yours.
    { enabled: Boolean(user?.id) },
  );

  // `isPending` (not `isLoading`) also covers the disabled window above, so the
  // skeleton shows instead of a false "no items" empty state.
  const isLoading = isPending;
  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      >
        <Button asChild>
          <Link href={ROUTES.report}>
            <Plus className="h-4 w-4" />
            {tc("reportItem")}
          </Link>
        </Button>
      </PageHeader>

      {/* Tabs — roving selection with proper tab semantics. */}
      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="flex w-full gap-1 rounded-xl border bg-card p-1 sm:w-auto sm:self-start"
      >
        {TABS.map((opt) => {
          const selected = opt.id === tab;
          return (
            <button
              key={opt.id}
              role="tab"
              id={`tab-${opt.id}`}
              aria-selected={selected}
              aria-controls="my-items-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(opt.id)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                e.preventDefault();
                const i = TABS.findIndex((x) => x.id === tab);
                const next =
                  e.key === "ArrowRight"
                    ? TABS[(i + 1) % TABS.length]
                    : TABS[(i - 1 + TABS.length) % TABS.length];
                setTab(next.id);
                document.getElementById(`tab-${next.id}`)?.focus();
              }}
              className={cn(
                "flex-1 rounded-lg px-4 py-2 text-body-sm font-medium transition-colors sm:flex-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="my-items-panel"
        aria-labelledby={`tab-${tab}`}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <ItemRowSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title={t("loadError")}
            message={error instanceof Error ? error.message : undefined}
            onRetry={() => refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={tab === "closed" ? Archive : tab === "found" ? PackageOpen : Search}
            title={EMPTY[tab].title}
            description={EMPTY[tab].description}
            action={
              tab === "closed" ? undefined : (
                <Button asChild>
                  <Link href={ROUTES.report}>{tc("reportItem")}</Link>
                </Button>
              )
            }
          />
        ) : (
          <m.ul
            key={tab}
            variants={listContainer}
            initial="initial"
            animate="enter"
            className="space-y-3"
          >
            {items.map((item) => (
              <MyItemRow key={item.id} item={item} />
            ))}
          </m.ul>
        )}
      </div>
    </div>
  );
}
