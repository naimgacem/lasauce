import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeletons mirror real component geometry so loading never shifts layout. */

export function ItemCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <CardContent className="space-y-2.5 p-4">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}

export function ItemRowSkeleton() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <Skeleton className="h-16 w-16 shrink-0 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <Skeleton className="h-5 w-14 rounded-full" />
      </CardContent>
    </Card>
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

export function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-20" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-12" />
      </CardContent>
    </Card>
  );
}

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Skeleton className="h-9 w-32" />
      <Card className="overflow-hidden">
        <Skeleton className="aspect-[16/9] w-full rounded-none" />
        <CardContent className="space-y-4 p-6">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
