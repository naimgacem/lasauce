"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CheckCircle2, Clock, KeyRound, Lock, XCircle } from "lucide-react";

import { Spinner } from "@/components/feedback/loading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "@/features/auth/hooks/use-session";
import { ClaimDialog } from "@/features/claims/components/claim-dialog";
import { ContactReveal } from "@/features/claims/components/contact-reveal";
import { useMyClaims, useWithdrawClaim } from "@/features/claims/hooks/use-claims";
import { formatRelative } from "@/lib/format";
import { loginWithNext, ROUTES } from "@/lib/routes";
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

  // ── Guest ────────────────────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-start">
          <Lock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="flex-1 text-body-sm text-muted-foreground">
            {t("guestBody")}
          </p>
          <Button asChild size="sm">
            <Link href={loginWithNext(ROUTES.item(item.id))}>{tc("signIn")}</Link>
          </Button>
        </CardContent>
      </Card>
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
      <Card className="border-processing/30 bg-processing-muted/40">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <Clock className="h-5 w-5 shrink-0 text-processing" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t("pendingTitle")}</p>
            <p className="text-body-sm text-muted-foreground">
              {t("pendingBody", { relative: formatRelative(mine.created_at, locale) })}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => withdraw.mutate(mine.id)}
            disabled={withdraw.isPending}
          >
            {withdraw.isPending ? <Spinner /> : null}
            {t("withdrawAction")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Rejected / withdrawn ─────────────────────────────────────────────────
  if (mine && (mine.status === "rejected" || mine.status === "withdrawn")) {
    const rejected = mine.status === "rejected";
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-5">
          <XCircle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {rejected ? t("notApprovedTitle") : t("withdrewTitle")}
            </p>
            <p className="text-body-sm text-muted-foreground">
              {rejected
                ? t("rejectedBody")
                : t("newClaimBody")}
            </p>
          </div>
          {!rejected && !isClosed && item.status !== "claimed" ? (
            <ClaimDialog item={item} />
          ) : null}
        </CardContent>
      </Card>
    );
  }

  // ── Already settled with someone else ────────────────────────────────────
  if (item.status === "claimed" || isClosed) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-5">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-body-sm text-muted-foreground">
            {t("alreadyClaimed")}
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Default: invite a claim ──────────────────────────────────────────────
  return (
    <Card interactive>
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          aria-hidden
        >
          <KeyRound className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-heading-4">
            {item.type === "found" ? t("panelTitle") : t("didYouFind")}
          </h3>
          <p className="mt-0.5 text-body-sm text-muted-foreground">
            {item.claim_questions.length > 0
              ? t("answerCount", { count: item.claim_questions.length })
              : t("tellRightPerson")}
          </p>
        </div>
        <ClaimDialog item={item} />
      </CardContent>
    </Card>
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
