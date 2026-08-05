"use client";

import { ErrorState } from "@/components/feedback/error-state";
import { ItemDetail } from "@/features/items/components/item-detail";
import { useItem } from "@/features/items/hooks/use-items";
import type { Item } from "@/types/item";

/**
 * Client shell around the server-rendered item.
 *
 * The server already fetched this item (for metadata and first paint), so it is
 * handed over as `initialData` — the page paints immediately with no skeleton,
 * then TanStack Query refetches in the background. Keeping the item in the
 * query cache is what lets withdraw/resolve mutations invalidate and re-render
 * this view; a plain prop would go stale the moment the owner acted on it.
 */
export function ItemDetailView({ initialItem }: { initialItem: Item }) {
  const { data, error, refetch } = useItem(initialItem.id, {
    initialData: initialItem,
  });

  // `data` can only be undefined if a background refetch failed and the cache
  // was dropped; the server render proved the item exists, so this is a
  // transport problem, not a missing item.
  if (!data) {
    return (
      <div className="container max-w-xl py-12">
        <ErrorState
          title="Couldn't refresh this item"
          message={error instanceof Error ? error.message : undefined}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return <ItemDetail item={data} />;
}
