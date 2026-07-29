"use client";

import Link from "next/link";
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
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left">
          <Lock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="flex-1 text-body-sm text-muted-foreground">
            Sign in to claim this item. You&apos;ll answer the reporter&apos;s
            questions — contact details are shared only once they approve.
          </p>
          <Button asChild size="sm">
            <Link href={loginWithNext(ROUTES.item(item.id))}>Sign in</Link>
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
        heading="Your claim was approved"
        note="Here's how to reach the reporter. Agree a public place and a time that suits you both."
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
            <p className="font-medium">Waiting for the reporter to review</p>
            <p className="text-body-sm text-muted-foreground">
              Sent {formatRelative(mine.created_at)}. We&apos;ll notify you either way.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => withdraw.mutate(mine.id)}
            disabled={withdraw.isPending}
          >
            {withdraw.isPending ? <Spinner /> : null}
            Withdraw
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
              {rejected ? "Your claim wasn't approved" : "You withdrew your claim"}
            </p>
            <p className="text-body-sm text-muted-foreground">
              {rejected
                ? "The reporter didn't recognise your answers."
                : "You can send a new claim if you'd like."}
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
            This item has already been claimed.
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
            {item.type === "found" ? "Think this is yours?" : "Did you find this?"}
          </h3>
          <p className="mt-0.5 text-body-sm text-muted-foreground">
            {item.claim_questions.length > 0 ? (
              <>
                Answer {item.claim_questions.length} quick question
                {item.claim_questions.length === 1 ? "" : "s"} to prove it.
              </>
            ) : (
              "Tell the reporter something only the right person would know."
            )}
          </p>
        </div>
        <ClaimDialog item={item} />
      </CardContent>
    </Card>
  );
}

/** Small status chip reused by the owner-side list. */
export function ClaimStatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge variant="found-soft">Approved</Badge>;
  if (status === "rejected") return <Badge variant="outline">Rejected</Badge>;
  if (status === "withdrawn") return <Badge variant="outline">Withdrawn</Badge>;
  return <Badge variant="processing-soft">Pending</Badge>;
}
