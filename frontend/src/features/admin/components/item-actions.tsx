"use client";

import * as React from "react";
import { Ban, ExternalLink, RotateCcw, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Spinner } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { AdminItemDetail, ModerationCloseReason } from "@/types/admin";

import { useCloseItem, useReopenItem, useReprocessItem } from "../hooks/use-admin-commands";
import { ReasonDialog } from "./reason-dialog";

const CLOSE_REASONS: ModerationCloseReason[] = ["removed", "duplicate", "expired"];

/** Reasons a moderator applied, and so may take back. Mirrors the backend. */
export const REOPENABLE = new Set(["removed", "duplicate", "expired"]);

function CloseReasonPicker({
  value,
  onChange,
}: {
  value: ModerationCloseReason;
  onChange: (value: ModerationCloseReason) => void;
}) {
  const t = useTranslations("admin.itemActions");
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{t("closeReason")}</legend>
      {CLOSE_REASONS.map((reason) => (
        <label
          key={reason}
          className={cn(
            "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
            "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
            value === reason ? "border-primary/50 bg-accent/50" : "hover:bg-accent/30",
          )}
        >
          <input
            type="radio"
            name="close-reason"
            value={reason}
            checked={value === reason}
            onChange={() => onChange(reason)}
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span>
            <span className="block text-body-sm font-medium">{t(`reasons.${reason}.label`)}</span>
            <span className="block text-caption font-normal text-muted-foreground">
              {t(`reasons.${reason}.hint`)}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Close, reopen, reprocess. What is offered follows the report's state and
 * who closed it: a moderator can reverse a moderator's close, never the
 * reporter's own "withdrawn" or "recovered".
 */
export function ItemActions({ item }: { item: AdminItemDetail }) {
  const t = useTranslations("admin.itemActions");
  const [dialog, setDialog] = React.useState<"close" | "reopen" | null>(null);
  const [reason, setReason] = React.useState<ModerationCloseReason>("removed");

  const closeItem = useCloseItem(item.id);
  const reopen = useReopenItem(item.id);
  const reprocess = useReprocessItem(item.id);

  React.useEffect(() => {
    if (dialog === "close") setReason("removed");
  }, [dialog]);

  const isClosed = item.status === "closed";
  const canReopen = isClosed && item.closed_reason !== null && REOPENABLE.has(item.closed_reason);

  return (
    <>
      <Button asChild variant="ghost" size="sm">
        <Link href={ROUTES.item(item.id)} target="_blank" rel="noopener">
          <ExternalLink className="h-4 w-4" />
          {t("viewPublic")}
        </Link>
      </Button>

      {!isClosed ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => reprocess.mutate()}
          disabled={reprocess.isPending}
        >
          {reprocess.isPending ? <Spinner /> : <RotateCcw className="h-4 w-4" />}
          {t("reprocess")}
        </Button>
      ) : null}

      {!isClosed ? (
        <Button
          variant="outline"
          size="sm"
          className="border-destructive/30 text-destructive hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setDialog("close")}
        >
          <Ban className="h-4 w-4" />
          {t("close")}
        </Button>
      ) : canReopen ? (
        <Button variant="outline" size="sm" onClick={() => setDialog("reopen")}>
          <Undo2 className="h-4 w-4" />
          {t("reopen")}
        </Button>
      ) : null}

      <ReasonDialog
        open={dialog === "close"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t("closeTitle")}
        description={[
          t("closeBody"),
          item.match_count ? t("closeMatches", { count: item.match_count }) : null,
          item.pending_claim_count ? t("closeClaims", { count: item.pending_claim_count }) : null,
        ]
          .filter(Boolean)
          .join(" ")}
        confirmLabel={t("closeConfirm")}
        destructive
        reasonRequired
        reasonLabel={t("closeNote")}
        reasonHint={t("closeNoteHint")}
        pending={closeItem.isPending}
        onConfirm={(note) => closeItem.mutateAsync({ reason_code: reason, note: note ?? "" })}
      >
        <CloseReasonPicker value={reason} onChange={setReason} />
      </ReasonDialog>

      <ReasonDialog
        open={dialog === "reopen"}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t("reopenTitle")}
        description={t("reopenBody")}
        confirmLabel={t("reopenConfirm")}
        pending={reopen.isPending}
        onConfirm={(note) => reopen.mutateAsync(note)}
      />
    </>
  );
}
