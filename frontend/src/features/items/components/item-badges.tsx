import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { ItemStatus, ItemType, ProcessingStatus } from "@/types/item";

/**
 * Status is secondary to type, so it stays neutral. Gold is deliberately absent:
 * it marks the paid tier, and "matched" is a state of the report, not a
 * purchase. `open` has no chip at all — it is the default, and a chip that
 * appears on every card says nothing.
 */
const STATUS_VARIANT: Record<
  Exclude<ItemStatus, "open">,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  matched: "secondary",
  claimed: "secondary",
  closed: "outline",
};

/**
 * Lost ↔ Found is the product's core binary, so it gets the loudest treatment:
 * a solid rose or teal chip, readable at a glance and safe for red-green
 * colour blindness.
 */
export function ItemTypeBadge({
  type,
  className,
}: {
  type: ItemType;
  className?: string;
}) {
  const t = useTranslations("item");
  return (
    <Badge variant={type === "lost" ? "lost" : "found"} className={className}>
      {type === "lost" ? t("lostBadge") : t("foundBadge")}
    </Badge>
  );
}

const STATUS_LABEL_KEY: Record<ItemStatus, "statusOpen" | "statusMatched" | "statusClaimed" | "statusClosed"> = {
  open: "statusOpen",
  matched: "statusMatched",
  claimed: "statusClaimed",
  closed: "statusClosed",
};

export function ItemStatusBadge({
  status,
  className,
}: {
  status: ItemStatus;
  className?: string;
}) {
  const t = useTranslations("item");
  if (status === "open") return null;
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {t(STATUS_LABEL_KEY[status])}
    </Badge>
  );
}

/** Amber pulse while the ML pipeline works; silent once ready. */
export function ProcessingBadge({ status }: { status: ProcessingStatus }) {
  const t = useTranslations("item");

  if (status === "ready") return null;

  if (status === "failed") {
    return <Badge variant="outline">{t("processingFailed")}</Badge>;
  }

  return (
    <Badge variant="processing-soft">
      <span className="relative flex h-1.5 w-1.5" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-processing" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-processing" />
      </span>
      {t("matching")}
    </Badge>
  );
}
