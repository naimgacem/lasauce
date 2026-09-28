"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { Spinner } from "@/components/feedback/loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/use-session";
import { ClaimDialog } from "@/features/claims/components/claim-dialog";
import { ContactReveal } from "@/features/claims/components/contact-reveal";
import { useMyClaims, useWithdrawClaim } from "@/features/claims/hooks/use-claims";
import { formatRelative } from "@/lib/format";
import { loginWithNext, ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { Item } from "@/types/item";

/**
 * The claimant-side panel on an item detail page. Replaces the old
 * "Sign in to contact the reporter" gate, which led nowhere.
 *
 * Renders nothing for the item's owner — they get `IncomingClaims` instead.
 */
export function ClaimPanel({ item }: { item: Item }) {
  const t = useTranslations("claims");
  const tc = useTranslations("common");
  const locale = useLocale();
  const { user, isAuthed } = useSession();
  const isOwner = user?.id === item.user_id;
  const { data: myClaims } = useMyClaims(isAuthed && !isOwner);
  const withdraw = useWithdrawClaim(item.id);

  if (isOwner) return null;

  const isClosed = item.status === "closed";
  const mine = myClaims?.find((c) => c.item_id === item.id);

  const title = item.type === "found" ? t("panelTitle") : t("didYouFind");

  // ── Guest ────────────────────────────────────────────────────────────────
  // The most common visitor of all: someone who tapped a shared link. Ask
  // the question first, then say what signing in leads to.
  if (!isAuthed) {
    return (
      <Panel>
        <h2 className="text-heading-4">{title}</h2>
        <p className="mt-1 text-body-sm text-muted-foreground">{t("guestBody")}</p>
        <Button asChild size="lg" className="mt-4 w-full">
          <Link href={loginWithNext(ROUTES.item(item.id))}>{tc("signIn")}</Link>
        </Button>
      </Panel>
    );
  }

  // ── Approved: the payoff ─────────────────────────────────────────────────
  if (mine?.status === "approved" && mine.contact) {
    return (
      <ContactReveal
        contact={mine.contact}
        heading={t("approvedHeading")}
        note={t("approvedNote")}
      />
    );
  }

  // ── Pending ──────────────────────────────────────────────────────────────
  if (mine?.status === "pending") {
    return (
      <Panel className="border-processing/30 bg-processing-muted/40">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-processing" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-body font-medium">{t("pendingTitle")}</h2>
            <p className="mt-0.5 text-body-sm text-muted-foreground">
              {t("pendingBody", { relative: formatRelative(mine.created_at, locale) })}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => withdraw.mutate(mine.id)}
          disabled={withdraw.isPending}
        >
          {withdraw.isPending ? <Spinner /> : null}
          {t("withdrawAction")}
        </Button>
      </Panel>
    );
  }

  // ── Rejected / withdrawn ─────────────────────────────────────────────────
  if (mine && (mine.status === "rejected" || mine.status === "withdrawn")) {
    const rejected = mine.status === "rejected";
    const canRetry = !rejected && !isClosed && item.status !== "claimed";
    return (
      <Panel>
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-body font-medium">
              {rejected ? t("notApprovedTitle") : t("withdrewTitle")}
            </h2>
            <p className="mt-0.5 text-body-sm text-muted-foreground">
              {rejected ? t("rejectedBody") : t("newClaimBody")}
            </p>
          </div>
        </div>
        {canRetry ? <ClaimDialog item={item} className="mt-4 w-full" /> : null}
      </Panel>
    );
  }

  // ── Already settled with someone else ────────────────────────────────────
  if (item.status === "claimed" || isClosed) {
    return (
      <Panel className="flex items-start gap-3 bg-muted/40">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-body-sm text-muted-foreground">{t("alreadyClaimed")}</p>
      </Panel>
    );
  }

  // ── Default: invite a claim ──────────────────────────────────────────────
  return (
    <Panel>
      <h2 className="text-heading-4">{title}</h2>
      <p className="mt-1 text-body-sm text-muted-foreground">
        {item.claim_questions.length > 0
          ? t("answerCount", { count: item.claim_questions.length })
          : t("tellRightPerson")}
      </p>
      <ClaimDialog item={item} className="mt-4 w-full" />
    </Panel>
  );
}

/** The claim panel's single surface, so every state sits in the same frame. */
function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      {children}
    </section>
  );
}

/** Small status chip reused by the owner-side list. */
export function ClaimStatusBadge({ status }: { status: string }) {
  const t = useTranslations("claims");
  if (status === "approved") return <Badge variant="found-soft">{t("approved")}</Badge>;
  if (status === "rejected") return <Badge variant="outline">{t("rejected")}</Badge>;
  if (status === "withdrawn") return <Badge variant="outline">{t("withdrawn")}</Badge>;
  return <Badge variant="processing-soft">{t("pending")}</Badge>;
}
