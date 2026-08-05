"use client";

import { ErrorState } from "@/components/feedback/error-state";
import { DetailSkeleton } from "@/components/feedback/skeletons";
import { ItemDetail } from "@/features/items/components/item-detail";
import { useItem } from "@/features/items/hooks/use-items";
import type { Item } from "@/types/item";

/**
 * Client shell around the server-rendered item.
 *
 * When the server already fetched this item (for metadata and first paint) it is
 * handed over as `initialData` — the page paints immediately with no skeleton,
 * then TanStack Query refetches in the background. Keeping the item in the
 * query cache is what lets withdraw/resolve mutations invalidate and re-render
 * this view; a plain prop would go stale the moment the owner acted on it.
 *
 * `initialItem` is optional because the server can't always resolve an id up
 * front — in mock mode the live dataset only exists in this browser. Then this
 * view fetches from scratch and owns the loading and missing-item states.
 */
export function ItemDetailView({
  itemId,
  initialItem,
}: {
  itemId: string;
  initialItem?: Item;
}) {
  const { data, error, isPending, refetch } = useItem(itemId, {
    initialData: initialItem,
  });

  if (isPending) {
    return (
      <div className="container max-w-4xl py-8">
        <DetailSkeleton />
      </div>
    );
  }

  if (!data) {
    // A server-rendered item that vanishes mid-session is a transport problem,
    // not a missing report — the server render already proved it exists.
    return (
      <div className="container max-w-xl py-12">
        <ErrorState
          title={initialItem ? "Couldn't refresh this item" : "Item not found"}
          message={
            initialItem
              ? error instanceof Error
                ? error.message
                : undefined
              : "This report may have been removed, or the link is incorrect."
          }
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return <ItemDetail item={data} />;
}
