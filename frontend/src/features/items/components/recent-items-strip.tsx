"use client";

import Link from "next/link";
import { m } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { listContainer } from "@/animations";
import { ItemCardSkeleton } from "@/components/feedback/skeletons";
import { Button } from "@/components/ui/button";
import { ItemCard } from "@/features/items/components/item-card";
import { useItems } from "@/features/items/hooks/use-items";
import { ROUTES } from "@/lib/routes";

/**
 * "Recently reported" strip for the landing page. Proof the platform is alive
 * — the single most persuasive thing a first-time visitor can see. Renders
 * nothing at all rather than an empty shell when there's no data yet.
 */
export function RecentItemsStrip({ limit = 4 }: { limit?: number }) {
  const { data, isLoading, isError } = useItems({ page: 1, page_size: limit });
  const items = data?.items ?? [];

  if (isError || (!isLoading && items.length === 0)) return null;

  return (
    <section className="border-t bg-card/40" aria-labelledby="recent-items">
      <div className="container py-section">
        <div className="mb-stack-lg flex items-end justify-between gap-4">
          <div>
            <h2 id="recent-items" className="text-heading-2">
              Recently reported
            </h2>
            <p className="mt-1 text-body-sm text-muted-foreground">
              Fresh reports from across Algeria.
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild className="shrink-0">
            <Link href={ROUTES.search}>
              See all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
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
