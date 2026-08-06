import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { ItemStatus, ItemType, ProcessingStatus } from "@/types/item";

const STATUS_VARIANT: Record<
  ItemStatus,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  open: "secondary",
  matched: "premium",
  claimed: "default",
  closed: "outline",
};

/**
 * Lost ↔ Found is the product's core binary, so it gets the loudest treatment:
 * a solid rose or teal chip, readable at a glance and safe for red-green
 * colour blindness.
 */
export function ItemTypeBadge({ type }: { type: ItemType }) {
  const t = useTranslations("item");
  return (
    <Badge variant={type === "lost" ? "lost" : "found"}>
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

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const t = useTranslations("item");
  return <Badge variant={STATUS_VARIANT[status]}>{t(STATUS_LABEL_KEY[status])}</Badge>;
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
