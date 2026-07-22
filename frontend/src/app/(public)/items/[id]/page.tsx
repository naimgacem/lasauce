"use client";

import { useParams } from "next/navigation";

import { ErrorState } from "@/components/feedback/error-state";
import { DetailSkeleton } from "@/components/feedback/skeletons";
import { ItemDetail } from "@/features/items/components/item-detail";
import { useItem } from "@/features/items/hooks/use-items";
import { ApiError } from "@/types/api";

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: item, isLoading, isError, error, refetch } = useItem(params.id);

  if (isLoading) {
    return (
      <div className="container py-8">
        <DetailSkeleton />
      </div>
    );
  }

  if (isError || !item) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="container max-w-xl py-12">
        <ErrorState
          title={notFound ? "Item not found" : "Couldn't load this item"}
          message={
            notFound
              ? "This report may have been removed, or the link is incorrect."
              : error instanceof Error
                ? error.message
                : undefined
          }
          onRetry={notFound ? undefined : () => refetch()}
        />
      </div>
    );
  }

  return <ItemDetail item={item} />;
}
