"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
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
import { useTranslations } from "next-intl";
import { ROUTES } from "@/lib/routes";
import type { ItemType } from "@/types/item";

const PAGE_SIZE = 12;
type ViewMode = "grid" | "list";

interface BrowseViewProps {
  presetType?: ItemType;
  title: string;
  description: string;
}

/**
 * `useSearchParams` opts the subtree into client-side rendering, which Next
 * refuses to prerender without a Suspense boundary — so the boundary lives
 * here rather than being duplicated across every browse route.
 */
export function BrowseView(props: BrowseViewProps) {
  return (
    <React.Suspense fallback={<BrowseFallback title={props.title} description={props.description} />}>
      <BrowseViewInner {...props} />
    </React.Suspense>
  );
}

function BrowseFallback({ title, description }: Omit<BrowseViewProps, "presetType">) {
  return (
    <div className="container py-8">
      <PageHeader title={title} description={description} />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ItemCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** Seed filters from the URL so a shared/deep link lands pre-filtered. */
function filtersFromParams(params: URLSearchParams): BrowseFilters {
  const wilaya = Number(params.get("wilaya_code"));
  return {
    wilaya_code: Number.isInteger(wilaya) && wilaya > 0 ? wilaya : undefined,
    category_id: params.get("category_id") ?? undefined,
    date_from: params.get("date_from") ?? undefined,
    date_to: params.get("date_to") ?? undefined,
  };
}

function BrowseViewInner({ presetType, title, description }: BrowseViewProps) {
  const t = useTranslations("browse");
  const tc = useTranslations("common");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // The URL is the single source of truth for anything worth sharing, so a
  // filtered search is linkable and bookmarkable, back/forward behave, and the
  // wilaya chosen on the landing hero survives the trip to /search instead of
  // being dropped on arrival.
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const filters = React.useMemo(
    () => filtersFromParams(searchParams),
    [searchParams],
  );

  // View mode is a personal preference, not part of the search — it stays local.
  const [view, setView] = React.useState<ViewMode>("grid");
  const [searchInput, setSearchInput] = React.useState(q);
  const debouncedSearch = useDebounce(searchInput, 300);

  const setParams = React.useCallback(
    (updates: Record<string, string | number | undefined | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      const qs = next.toString();
      // `replace`, not `push`: one history entry per keystroke would bury the
      // back button under a page of near-identical search URLs.
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  // Debounced text → URL. Any new query resets to the first page.
  React.useEffect(() => {
    if (debouncedSearch === q) return;
    setParams({ q: debouncedSearch, page: null });
  }, [debouncedSearch, q, setParams]);

  // URL → input, so back/forward and hero arrivals refill the search box.
  React.useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const query = {
    type: presetType,
    q: q || undefined,
    ...filters,
    page,
    page_size: PAGE_SIZE,
  };
  const { data, isLoading, isFetching, isError, error, refetch } = useItems(query);

  function updateFilters(next: Partial<BrowseFilters>) {
    setParams({ ...next, page: null });
  }

  const activeCount = countActiveFilters(filters);
  const items = data?.items ?? [];
  const hasQuery = Boolean(q || activeCount);

  return (
    <div className="container py-8">
      <PageHeader title={title} description={description}>
        <Button asChild>
          <Link href={ROUTES.report}>{tc("reportItem")}</Link>
        </Button>
      </PageHeader>

      {/* Toolbar: search + view toggle + mobile filter trigger */}
      <div className="mt-6 flex items-center gap-2">
        <div className="relative flex-1 md:max-w-sm">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder={t("searchPlaceholder")}
            className="ps-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label={tc("search")}
          />
        </div>

        {/* Mobile: slide-over filter drawer */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="md:hidden" aria-label={t("openFilters")}>
              <SlidersHorizontal className="h-4 w-4" />
              {tc("filters")}
              {activeCount > 0 ? (
                <Badge className="ms-1 h-5 min-w-5 justify-center px-1">
                  {activeCount}
                </Badge>
              ) : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{tc("filters")}</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <ItemFilters value={filters} onChange={updateFilters} />
            </div>
          </SheetContent>
        </Sheet>

        <div
          className="ms-auto hidden items-center rounded-md border p-0.5 sm:flex"
          role="group"
          aria-label={tc("viewMode")}
        >
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setView("grid")}
            aria-pressed={view === "grid"}
            aria-label={tc("gridView")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setView("list")}
            aria-pressed={view === "list"}
            aria-label={tc("listView")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-6 flex gap-8">
        {/* Desktop: sticky filter sidebar */}
        <aside className="hidden w-60 shrink-0 md:block" aria-label="Filters">
          <div className="sticky top-24 rounded-2xl border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">{tc("filters")}</h2>
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
              title={t("loadError")}
              message={error instanceof Error ? error.message : undefined}
              onRetry={() => refetch()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={hasQuery ? Search : PackageOpen}
              title={hasQuery ? t("emptySearchTitle") : t("emptyTitle")}
              description={hasQuery ? t("emptySearchBody") : t("emptyBody")}
              action={
                <Button asChild>
                  <Link href={ROUTES.report}>{t("reportYourItem")}</Link>
                </Button>
              }
            />
          ) : view === "grid" ? (
            <m.div
              // Keyed on view + page only. Including the filters (previously via
              // JSON.stringify) tore down and rebuilt every card on each
              // keystroke, losing focus and restarting animations mid-typing.
              key={`grid-${page}`}
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
              key={`list-${page}`}
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
              // Page 1 is the default — leave it out so shared links stay tidy.
              onPageChange={(next) => setParams({ page: next === 1 ? null : next })}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
