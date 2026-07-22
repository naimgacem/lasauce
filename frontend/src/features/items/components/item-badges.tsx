import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";
import type { ItemStatus, ItemType, ProcessingStatus } from "@/types/item";

const STATUS_VARIANT: Record<
  ItemStatus,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  open: "secondary",
  matched: "ai",
  claimed: "default",
  closed: "outline",
};

export function ItemTypeBadge({ type }: { type: ItemType }) {
  return (
    <Badge variant={type === "lost" ? "lost" : "found"}>
      {type === "lost" ? "Lost" : "Found"}
    </Badge>
  );
}

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{titleCase(status)}</Badge>;
}

/** Amber pulse while the ML pipeline works; quiet otherwise. */
export function ProcessingBadge({ status }: { status: ProcessingStatus }) {
  if (status === "ready") return null;
  if (status === "failed") {
    return <Badge variant="outline">Processing failed</Badge>;
  }
  return (
    <Badge variant="processing">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-processing-foreground/60 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-processing-foreground" />
      </span>
      Matching…
    </Badge>
  );
}
