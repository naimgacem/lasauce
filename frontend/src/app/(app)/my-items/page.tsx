"use client";

import * as React from "react";
import Link from "next/link";
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

const TABS: { id: TabId; label: string; query: Partial<ItemQuery> }[] = [
  { id: "lost", label: "Lost", query: { type: "lost" } },
  { id: "found", label: "Found", query: { type: "found" } },
  // The API hides closed items unless a status is named explicitly.
  { id: "closed", label: "Closed", query: { status: "closed" } },
];

const EMPTY: Record<TabId, { title: string; description: string }> = {
  lost: {
    title: "No open lost reports",
    description:
      "Report something you've lost and we'll compare it against every found item as new ones arrive.",
  },
  found: {
    title: "No open found reports",
    description:
      "Found something? Post it so the owner can prove it's theirs and get it back.",
  },
  closed: {
    title: "Nothing closed yet",
    description:
      "Recovered and withdrawn reports are kept here so you always have the history.",
  },
};

export default function MyItemsPage() {
  const { user } = useSession();
  const [tab, setTab] = React.useState<TabId>("lost");

  const active = TABS.find((t) => t.id === tab)!;
  const { data, isLoading, isError, error, refetch } = useItems({
    user_id: user?.id,
    page_size: 50,
    ...active.query,
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="My items"
        description="Everything you've reported, and what happened to it."
      >
        <Button asChild>
          <Link href={ROUTES.report}>
            <Plus className="h-4 w-4" />
            Report item
          </Link>
        </Button>
      </PageHeader>

      {/* Tabs — roving selection with proper tab semantics. */}
      <div
        role="tablist"
        aria-label="Report status"
        className="flex w-full gap-1 rounded-xl border bg-card p-1 sm:w-auto sm:self-start"
      >
        {TABS.map((t) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls="my-items-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
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
              {t.label}
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
            title="Couldn't load your items"
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
                  <Link href={ROUTES.report}>Report an item</Link>
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
