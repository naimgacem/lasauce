"use client";

import { Link } from "@/i18n/navigation";
import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { listContainer } from "@/animations";
import { ItemCardSkeleton } from "@/components/feedback/skeletons";
import { ItemCard } from "@/features/items/components/item-card";
import { useItems } from "@/features/items/hooks/use-items";
import { ROUTES } from "@/lib/routes";

const GRID = "grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4";

/**
 * "Recently reported" strip for the landing page. Proof the platform is alive
 * — the single most persuasive thing a first-time visitor can see. Renders
 * nothing at all rather than an empty shell when there's no data yet.
 *
 * Two columns on phones: four full-width photo cards stacked is a thousand
 * pixels of scrolling for what is meant to be a glance.
 */
export function RecentItemsStrip({ limit = 4 }: { limit?: number }) {
  const t = useTranslations("landing");
  const { data, isLoading, isError } = useItems({ page: 1, page_size: limit });
  const items = data?.items ?? [];

  if (isError || (!isLoading && items.length === 0)) return null;

  return (
    <section aria-labelledby="recent-items">
      <div className="container py-12 md:py-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 id="recent-items" className="text-heading-3">
              {t("recentlyReported")}
            </h2>
            <p className="mt-1 text-body-sm text-muted-foreground">
              {t("recentlyReportedSubtitle")}
            </p>
          </div>
          <Link
            href={ROUTES.search}
            className="group inline-flex shrink-0 items-center gap-1.5 text-body-sm font-medium underline-offset-4 hover:underline"
          >
            {t("seeAll")}
            <ArrowRight
              className="h-4 w-4 transition-transform duration-200 ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
              aria-hidden
            />
          </Link>
        </div>

        {isLoading ? (
          <div className={GRID}>
            {Array.from({ length: limit }).map((_, i) => (
              <ItemCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <m.div
            variants={listContainer}
            initial="initial"
            whileInView="enter"
            viewport={{ once: true, margin: "-60px" }}
            className={GRID}
          >
            {/* ItemCard carries its own `listItem` variant — it inherits the
                stagger from this container, so no extra wrapper. */}
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </m.div>
        )}
      </div>
    </section>
  );
}
