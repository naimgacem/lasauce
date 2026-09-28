import { Skeleton } from "@/components/ui/skeleton";

/** Skeletons mirror real component geometry so loading never shifts layout. */

export function ItemCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-3 sm:p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function ItemRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-2.5 sm:gap-4 sm:p-3">
      <Skeleton className="h-14 w-14 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-5 w-12 rounded-full" />
    </div>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-4">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

/** Mirrors ItemDetail: photo left, facts right; stacked below `lg`. */
export function DetailSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-5 w-28" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-x-12 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Skeleton className="aspect-[4/3] w-full rounded-xl lg:aspect-[3/2]" />
        <div className="space-y-6">
          <div className="space-y-3">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="space-y-4 border-y py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
