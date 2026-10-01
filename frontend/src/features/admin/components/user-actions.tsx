"use client";

import * as React from "react";
import { BadgeCheck, ChevronDown, Coins, ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/features/auth/hooks/use-session";
import type { AdminUserDetail } from "@/types/admin";

import { useGrantCredits, useUpdateUser } from "../hooks/use-admin-commands";
import { ReasonDialog } from "./reason-dialog";

type DialogKind = "suspend" | "reactivate" | "promote" | "demote" | "verify" | "credits";

const MAX_GRANT = 100;

/**
 * Every lever on an account, each behind a dialog that says what it will do.
 *
 * Role and status are unavailable on your own account — the backend refuses
 * them (it is what keeps the platform from locking itself out), so the menu
 * says so up front rather than letting the request fail.
 */
export function UserActions({ user }: { user: AdminUserDetail }) {
  const t = useTranslations("admin.userActions");
  const { user: me } = useSession();
  const isSelf = me?.id === user.id;
  const [dialog, setDialog] = React.useState<DialogKind | null>(null);
  const [amount, setAmount] = React.useState("1");

  const update = useUpdateUser(user.id);
  const grant = useGrantCredits(user.id);
  const close = (open: boolean) => !open && setDialog(null);

  const credits = Number(amount);
  const validAmount = Number.isInteger(credits) && credits >= 1 && credits <= MAX_GRANT;

  React.useEffect(() => {
    if (dialog === "credits") setAmount("1");
  }, [dialog]);

  if (user.status === "deleted") return null;

  const name = user.full_name;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setDialog("credits")}>
        <Coins className="h-4 w-4" />
        {t("grantCredits")}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {t("more")}
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {!user.is_verified ? (
            <DropdownMenuItem onSelect={() => setDialog("verify")}>
              <BadgeCheck className="h-4 w-4" />
              {t("verify")}
            </DropdownMenuItem>
          ) : null}
          {user.role === "admin" ? (
            <DropdownMenuItem disabled={isSelf} onSelect={() => setDialog("demote")}>
              <ShieldOff className="h-4 w-4" />
              {t("demote")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled={isSelf} onSelect={() => setDialog("promote")}>
              <ShieldCheck className="h-4 w-4" />
              {t("promote")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {user.status === "suspended" ? (
            <DropdownMenuItem disabled={isSelf} onSelect={() => setDialog("reactivate")}>
              <UserCheck className="h-4 w-4" />
              {t("reactivate")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              disabled={isSelf}
              onSelect={() => setDialog("suspend")}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <UserX className="h-4 w-4" />
              {t("suspend")}
            </DropdownMenuItem>
          )}
          {isSelf ? (
            <p className="px-2 pb-1.5 pt-2 text-caption font-normal text-muted-foreground">
              {t("selfNote")}
            </p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ReasonDialog
        open={dialog === "suspend"}
        onOpenChange={close}
        title={t("suspendTitle", { name })}
        description={t("suspendBody")}
        confirmLabel={t("suspendConfirm")}
        destructive
        reasonRequired
        pending={update.isPending}
        onConfirm={(reason) => update.mutateAsync({ status: "suspended", reason })}
      />
      <ReasonDialog
        open={dialog === "reactivate"}
        onOpenChange={close}
        title={t("reactivateTitle", { name })}
        description={t("reactivateBody")}
        confirmLabel={t("reactivateConfirm")}
        pending={update.isPending}
        onConfirm={(reason) => update.mutateAsync({ status: "active", reason })}
      />
      <ReasonDialog
        open={dialog === "promote"}
        onOpenChange={close}
        title={t("promoteTitle", { name })}
        description={t("promoteBody")}
        confirmLabel={t("promoteConfirm")}
        reasonRequired
        pending={update.isPending}
        onConfirm={(reason) => update.mutateAsync({ role: "admin", reason })}
      />
      <ReasonDialog
        open={dialog === "demote"}
        onOpenChange={close}
        title={t("demoteTitle", { name })}
        description={t("demoteBody")}
        confirmLabel={t("demoteConfirm")}
        destructive
        reasonRequired
        pending={update.isPending}
        onConfirm={(reason) => update.mutateAsync({ role: "user", reason })}
      />
      <ReasonDialog
        open={dialog === "verify"}
        onOpenChange={close}
        title={t("verifyTitle", { email: user.email })}
        description={t("verifyBody")}
        confirmLabel={t("verifyConfirm")}
        pending={update.isPending}
        onConfirm={(reason) => update.mutateAsync({ is_verified: true, reason })}
      />
      <ReasonDialog
        open={dialog === "credits"}
        onOpenChange={close}
        title={t("creditsTitle")}
        description={t("creditsBody", { name })}
        confirmLabel={t("creditsConfirm", { count: validAmount ? credits : 0 })}
        reasonRequired
        reasonLabel={t("creditsNote")}
        reasonHint={t("creditsNoteHint")}
        canConfirm={validAmount}
        pending={grant.isPending}
        onConfirm={(note) => grant.mutateAsync({ amount: credits, note: note ?? "" })}
      >
        <div className="grid gap-2">
          <Label htmlFor="grant-amount">{t("creditsAmount")}</Label>
          <Input
            id="grant-amount"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_GRANT}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-28"
            aria-invalid={!validAmount}
          />
          <p className="text-caption font-normal text-muted-foreground">
            {t("creditsAmountHint", { max: MAX_GRANT, balance: user.stats.credit_balance })}
          </p>
        </div>
      </ReasonDialog>
    </>
  );
}
