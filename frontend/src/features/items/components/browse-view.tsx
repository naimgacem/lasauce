"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { m } from "framer-motion";
import {
  LayoutGrid,
  List,
  PackageOpen,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { listContainer } from "@/animations";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import {
  ItemCardSkeleton,
  ItemRowSkeleton,
} from "@/components/feedback/skeletons";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ItemCard } from "@/features/items/components/item-card";
import {
  countActiveFilters,
  ItemFilters,
  type BrowseFilters,
} from "@/features/items/components/item-filters";
import { ItemRow } from "@/features/items/components/item-row";
import { useItems } from "@/features/items/hooks/use-items";
import { useDebounce } from "@/hooks/use-debounce";
import { ROUTES } from "@/lib/routes";
import type { ItemType } from "@/types/item";

const PAGE_SIZE = 12;
type ViewMode = "grid" | "list";

export function BrowseView({
  presetType,
  title,
  description,
}: {
  presetType?: ItemType;
  title: string;
  description: string;
}) {
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(searchParams.get("q") ?? "");
  const [filters, setFilters] = React.useState<BrowseFilters>({});
  const [page, setPage] = React.useState(1);
  const [view, setView] = React.useState<ViewMode>("grid");
  const debouncedSearch = useDebounce(search, 300);

  React.useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
  }, [searchParams]);

  const query = {
    type: presetType,
    q: debouncedSearch || undefined,
    ...filters,
    page,
    page_size: PAGE_SIZE,
  };
  const { data, isLoading, isFetching, isError, error, refetch } = useItems(query);

  function updateFilters(next: Partial<BrowseFilters>) {
    setFilters((prev) => ({ ...prev, ...next }));
    setPage(1);
  }

  const activeCount = countActiveFilters(filters);
  const items = data?.items ?? [];
  const hasQuery = Boolean(debouncedSearch || activeCount);

  return (
    <div className="container py-8">
      <PageHeader title={title} description={description}>
        <Button asChild>
          <Link href={ROUTES.report}>Report an item</Link>
        </Button>
      </PageHeader>

      {/* Toolbar: search + view toggle + mobile filter trigger */}
      <div className="mt-6 flex items-center gap-2">
        <div className="relative flex-1 md:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search by title or description…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Search items"
          />
        </div>

        {/* Mobile: slide-over filter drawer */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="md:hidden" aria-label="Open filters">
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeCount > 0 ? (
                <Badge className="ml-1 h-5 min-w-5 justify-center px-1">
                  {activeCount}
                </Badge>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <ItemFilters value={filters} onChange={updateFilters} />
            </div>
          </SheetContent>
        </Sheet>

        <div
          className="ml-auto hidden items-center rounded-md border p-0.5 sm:flex"
          role="group"
          aria-label="View mode"
        >
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-6 flex gap-8">
        {/* Desktop: sticky filter sidebar */}
        <aside className="hidden w-60 shrink-0 md:block" aria-label="Filters">
          <div className="sticky top-24 rounded-2xl border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Filters</h2>
            <ItemFilters value={filters} onChange={updateFilters} />
          </div>
        </aside>

        {/* Results */}
        <div className="min-w-0 flex-1 space-y-6" aria-busy={isFetching}>
          {isLoading ? (
            view === "grid" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ItemCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <ItemRowSkeleton key={i} />
                ))}
              </div>
            )
          ) : isError ? (
            <ErrorState
              title="Couldn't load items"
              message={error instanceof Error ? error.message : undefined}
              onRetry={() => refetch()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={hasQuery ? Search : PackageOpen}
              title={hasQuery ? "No items match" : "Nothing here yet"}
              description={
                hasQuery
                  ? "Try a broader search or clear some filters — new reports arrive all the time."
                  : "Be the first to post. Reports take about two minutes, and our matching engine does the searching."
              }
              action={
                <Button asChild>
                  <Link href={ROUTES.report}>Report an item</Link>
                </Button>
              }
              secondaryAction={
                hasQuery ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setFilters({});
                      setPage(1);
                    }}
                  >
                    Clear search & filters
                  </Button>
                ) : undefined
              }
            />
          ) : view === "grid" ? (
            <m.div
              key={`grid-${page}-${debouncedSearch}-${JSON.stringify(filters)}`}
              variants={listContainer}
              initial="initial"
              animate="enter"
              className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
            >
              {items.map((item) => (
                <ItemCard key={item.id} item={item} />
              ))}
            </m.div>
          ) : (
            <m.div
              key={`list-${page}-${debouncedSearch}-${JSON.stringify(filters)}`}
              variants={listContainer}
              initial="initial"
              animate="enter"
              className="space-y-3"
            >
              {items.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </m.div>
          )}

          {data ? (
            <Pagination
              page={data.page}
              totalPages={data.total_pages}
              total={data.total}
              onPageChange={setPage}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
