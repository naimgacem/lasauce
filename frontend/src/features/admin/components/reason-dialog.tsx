"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Spinner } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Matches the backend's `MIN_REASON_LENGTH`. */
export const MIN_REASON_LENGTH = 3;

/**
 * Confirmation for any action that changes something for someone else.
 *
 * Asks *why* at the moment of acting, because that is the only moment the
 * answer is known — the audit log is read weeks later by someone else. Where
 * the backend requires a reason, so does this dialog; elsewhere the field is
 * offered but optional.
 *
 * Extra inputs (a close reason, a credit amount) go in `children` and stay
 * owned by the caller, which also decides via `canConfirm` whether they are
 * complete. The dialog closes only when `onConfirm` resolves; on failure it
 * stays open with the text intact, and the mutation's toast says what went wrong.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  reasonRequired = false,
  reasonLabel,
  reasonHint,
  pending = false,
  canConfirm = true,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  reasonRequired?: boolean;
  reasonLabel?: string;
  reasonHint?: string;
  pending?: boolean;
  canConfirm?: boolean;
  onConfirm: (reason: string | undefined) => Promise<unknown>;
  children?: React.ReactNode;
}) {
  const t = useTranslations("admin.common");
  const fieldId = React.useId();
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (!open) setReason("");
  }, [open]);

  const trimmed = reason.trim();
  const reasonOk = !reasonRequired || trimmed.length >= MIN_REASON_LENGTH;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!reasonOk || !canConfirm || pending) return;
    try {
      await onConfirm(trimmed || undefined);
      onOpenChange(false);
    } catch {
      //  Reported by the mutation's toast; keep the dialog and its text.
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>

          {children}

          <div className="grid gap-2">
            <Label htmlFor={fieldId}>
              {reasonLabel ?? t("reason")}
              {!reasonRequired ? (
                <span className="ms-1.5 font-normal text-muted-foreground">
                  ({t("optional")})
                </span>
              ) : null}
            </Label>
            <Textarea
              id={fieldId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              maxLength={1000}
              rows={3}
              required={reasonRequired}
              aria-describedby={`${fieldId}-hint`}
            />
            <p id={`${fieldId}-hint`} className="text-caption font-normal text-muted-foreground">
              {reasonHint ?? (reasonRequired ? t("reasonRequiredHint") : t("reasonHint"))}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={!reasonOk || !canConfirm || pending}
            >
              {pending ? <Spinner /> : null}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
