"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { formatDateTime, formatRelative } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { AdminAction } from "@/types/admin";

/** User targets are labelled "Name <email>" server-side; the sentence wants the name. */
function splitUserLabel(label: string): { name: string; email?: string } {
  const match = /^(.*) <(.+)>$/.exec(label);
  return match ? { name: match[1], email: match[2] } : { name: label };
}

function targetHref(action: AdminAction): string | null {
  if (!action.target_id) return null;
  if (action.target_type === "user") return ROUTES.adminUser(action.target_id);
  if (action.target_type === "item") return ROUTES.adminItem(action.target_id);
  return null;
}

type Change = { from?: unknown; to?: unknown };
const asChange = (value: unknown): Change | null =>
  value && typeof value === "object" && "to" in value ? (value as Change) : null;
const asNumber = (value: unknown): number | null => (typeof value === "number" ? value : null);
const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/**
 * The consequential detail of an entry, as a phrase — "user → admin",
 * "2 suggestions withdrawn" — rather than the raw JSON it is stored as.
 */
function useDetailPhrase(action: AdminAction): string | null {
  const t = useTranslations("admin.audit.detail");
  const ts = useTranslations("admin.status");
  const d = action.details;

  switch (action.action) {
    case "change_role": {
      const change = asChange(d.role);
      if (!change) return null;
      const role = (value: unknown) =>
        value === "admin" || value === "user" ? ts(`role.${value}`) : t("none");
      return t("change", { from: role(change.from), to: role(change.to) });
    }
    case "suspend_user": {
      const sessions = asNumber(d.sessions_revoked);
      return sessions ? t("sessionsEnded", { count: sessions }) : null;
    }
    case "grant_credits": {
      const amount = asNumber(d.amount);
      return amount ? t("credits", { count: amount }) : null;
    }
    case "close_item": {
      const reason = d.closed_reason;
      const parts: string[] = [];
      if (reason === "removed" || reason === "duplicate" || reason === "expired") {
        parts.push(ts(`closed.${reason}`));
      }
      const retracted = asList(d.retracted_match_ids).length;
      const declined = asList(d.declined_claim_ids).length;
      if (retracted) parts.push(t("matchesRetracted", { count: retracted }));
      if (declined) parts.push(t("claimsDeclined", { count: declined }));
      return parts.join(" · ") || null;
    }
    case "reopen_item": {
      const restored = asNumber(d.reinstated_matches);
      return restored ? t("matchesRestored", { count: restored }) : null;
    }
    case "retry_failed_items": {
      const count = asNumber(d.count);
      return count ? t("reportsRequeued", { count }) : null;
    }
    default:
      return null;
  }
}

/**
 * One line of the audit log: who did what to whom, when, and why.
 *
 * The sentence is a translated template with the actor and target slotted in,
 * because word order differs between the three languages — "Ada a suspendu
 * Omar" and "علّقت Ada حساب Omar" do not share a structure with the English.
 */
export function AuditEntry({
  action,
  linkTarget = true,
}: {
  action: AdminAction;
  /** Off on the target's own page, where a link would point back at itself. */
  linkTarget?: boolean;
}) {
  const t = useTranslations("admin.audit");
  const locale = useLocale();
  const detail = useDetailPhrase(action);

  const actor =
    action.admin?.full_name ??
    (action.admin_email === "cli" ? t("actorCli") : action.admin_email);

  const label = action.target_label ?? "";
  const target = action.target_type === "user" ? splitUserLabel(label).name : label;
  const href = targetHref(action);

  const tags = {
    actor: (chunks: React.ReactNode) => <span className="font-medium text-foreground">{chunks}</span>,
    target: (chunks: React.ReactNode) =>
      linkTarget && href ? (
        <Link href={href} className="font-medium text-foreground underline-offset-4 hover:underline">
          {chunks}
        </Link>
      ) : (
        <span className="font-medium text-foreground">{chunks}</span>
      ),
  };

  return (
    <div className="min-w-0">
      <p className="text-body-sm text-muted-foreground">
        {t.rich(`sentence.${action.action}`, {
          ...tags,
          actorName: actor,
          targetName: target || t("unnamed"),
        })}
      </p>
      {detail ? <p className="mt-0.5 text-caption font-normal text-muted-foreground">{detail}</p> : null}
      {action.reason ? (
        <p className="mt-1.5 border-s-2 ps-2.5 text-body-sm text-foreground">{action.reason}</p>
      ) : null}
      <p className="mt-1.5 text-caption font-normal text-muted-foreground/80">
        <time dateTime={action.created_at} title={formatDateTime(action.created_at, locale)}>
          {formatRelative(action.created_at, locale)}
        </time>
      </p>
    </div>
  );
}
