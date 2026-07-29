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

/**
 * Lost ↔ Found is the product's core binary, so it gets the loudest treatment:
 * a solid rose or teal chip, readable at a glance and safe for red-green
 * colour blindness.
 */
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

/** Amber pulse while the ML pipeline works; silent once ready. */
export function ProcessingBadge({ status }: { status: ProcessingStatus }) {
  if (status === "ready") return null;

  if (status === "failed") {
    return <Badge variant="outline">Processing failed</Badge>;
  }

  return (
    <Badge variant="processing-soft">
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-processing" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-processing" />
      </span>
      Matching
    </Badge>
  );
}
