"use client";

import { BadgeCheck, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UserRole, UserStatus } from "@/types/auth";
import type { PaymentStatus } from "@/types/billing";
import type { ClaimStatus } from "@/types/claim";
import type { ItemClosedReason, ItemStatus, ItemType, ProcessingStatus } from "@/types/item";
import type { MatchStatus } from "@/types/match";

/**
 * Every state in the console is a dot plus a word. The word carries the
 * meaning; the dot lets a column be scanned. Colour is never the only signal.
 *
 * Four tones only, with fixed meanings: `positive` is healthy or done,
 * `attention` is in progress or waiting on someone, `negative` blocks or
 * failed, `neutral` is over and needs nothing.
 */
type Tone = "positive" | "attention" | "negative" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  positive: "bg-primary",
  attention: "bg-processing",
  negative: "bg-destructive",
  neutral: "bg-muted-foreground/45",
};

export function StatusDot({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_CLASS[tone])} aria-hidden />
      {children}
    </span>
  );
}

const USER_TONE: Record<UserStatus, Tone> = {
  active: "positive",
  suspended: "negative",
  deleted: "neutral",
};

export function UserStatusLabel({ status }: { status: UserStatus }) {
  const t = useTranslations("admin.status.user");
  return <StatusDot tone={USER_TONE[status]}>{t(status)}</StatusDot>;
}

/** Only admins get a chip. "User" is the default and would label every row. */
export function RoleBadge({ role }: { role: UserRole }) {
  const t = useTranslations("admin.status.role");
  if (role !== "admin") return null;
  //  Icon-only on phones, where the label would squeeze the name it sits beside.
  return (
    <Badge variant="outline" className="gap-1 px-1.5 sm:px-2" title={t("admin")}>
      <ShieldCheck className="h-3 w-3" aria-hidden />
      <span className="sr-only sm:not-sr-only">{t("admin")}</span>
    </Badge>
  );
}

export function VerifiedMark({ verified }: { verified: boolean }) {
  const t = useTranslations("admin.status");
  if (!verified) return <span className="text-muted-foreground">{t("unverified")}</span>;
  return (
    <span className="inline-flex items-center gap-1 text-foreground">
      <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
      {t("verified")}
    </span>
  );
}

/** Lost ↔ Found keeps its product colours; soft, because tables are dense. */
export function ItemTypeTag({ type }: { type: ItemType }) {
  const t = useTranslations("item");
  return (
    <Badge variant={type === "lost" ? "lost-soft" : "found-soft"}>
      {type === "lost" ? t("lostBadge") : t("foundBadge")}
    </Badge>
  );
}

const ITEM_TONE: Record<ItemStatus, Tone> = {
  open: "positive",
  matched: "positive",
  claimed: "positive",
  closed: "neutral",
};

export function ItemStatusLabel({
  status,
  closedReason,
}: {
  status: ItemStatus;
  closedReason?: ItemClosedReason | null;
}) {
  const t = useTranslations("admin.status");
  //  A closed report says *how* it closed — "removed" and "recovered" are
  //  opposite outcomes, and a table that shows both as "Closed" hides that.
  const label =
    status === "closed" && closedReason ? t(`closed.${closedReason}`) : t(`item.${status}`);
  const tone = closedReason === "removed" ? "negative" : ITEM_TONE[status];
  return <StatusDot tone={tone}>{label}</StatusDot>;
}

const PROCESSING_TONE: Record<ProcessingStatus, Tone> = {
  pending: "attention",
  embedding: "attention",
  matching: "attention",
  ready: "positive",
  failed: "negative",
};

export function ProcessingLabel({ status }: { status: ProcessingStatus }) {
  const t = useTranslations("admin.status.processing");
  return <StatusDot tone={PROCESSING_TONE[status]}>{t(status)}</StatusDot>;
}

const MATCH_TONE: Record<MatchStatus, Tone> = {
  pending: "neutral",
  suggested: "attention",
  confirmed: "positive",
  rejected: "negative",
  expired: "neutral",
};

export function MatchStatusLabel({ status }: { status: MatchStatus }) {
  const t = useTranslations("admin.status.match");
  return <StatusDot tone={MATCH_TONE[status]}>{t(status)}</StatusDot>;
}

const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  pending: "attention",
  paid: "positive",
  failed: "negative",
  canceled: "neutral",
  expired: "neutral",
};

export function PaymentStatusLabel({ status }: { status: PaymentStatus }) {
  const t = useTranslations("admin.status.payment");
  return <StatusDot tone={PAYMENT_TONE[status]}>{t(status)}</StatusDot>;
}

const CLAIM_TONE: Record<ClaimStatus, Tone> = {
  pending: "attention",
  approved: "positive",
  rejected: "negative",
  withdrawn: "neutral",
};

export function ClaimStatusLabel({ status }: { status: ClaimStatus }) {
  const t = useTranslations("admin.status.claim");
  return <StatusDot tone={CLAIM_TONE[status]}>{t(status)}</StatusDot>;
}
