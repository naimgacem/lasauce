"use client";

import { m } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Check, Inbox, X } from "lucide-react";

import { listContainer, listItem } from "@/animations";
import { Spinner } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClaimStatusBadge } from "@/features/claims/components/claim-panel";
import { ContactReveal } from "@/features/claims/components/contact-reveal";
import {
  useApproveClaim,
  useItemClaims,
  useRejectClaim,
} from "@/features/claims/hooks/use-claims";
import { formatRelative } from "@/lib/format";
import type { Item } from "@/types/item";

/**
 * Owner-side review queue. Only rendered for the item's reporter — the
 * endpoint behind it is owner-only, so a non-owner would get a 403 anyway.
 */
export function IncomingClaims({ item }: { item: Item }) {
  const t = useTranslations("claims");
  const locale = useLocale();
  const { data: claims, isLoading } = useItemClaims(item.id, true);
  const approve = useApproveClaim(item.id);
  const reject = useRejectClaim(item.id);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  const rows = claims ?? [];
  const pending = rows.filter((c) => c.status === "pending");
  const approved = rows.find((c) => c.status === "approved");
  const busy = approve.isPending || reject.isPending;

  if (rows.length === 0) {
    return (
      <section aria-labelledby="claims-heading">
        <h2 id="claims-heading" className="mb-3 text-heading-3">
          {t("incomingTitle")}
        </h2>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Inbox className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-body-sm text-muted-foreground">
              {t("emptyBody")}
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby="claims-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="claims-heading" className="text-heading-3">
          {t("incomingTitle")}
        </h2>
        {pending.length > 0 ? (
          <span className="text-body-sm text-muted-foreground">
            {t("awaitingReview", { count: pending.length })}
          </span>
        ) : null}
      </div>

      {/* Once approved, the owner gets the claimant's details right here. */}
      {approved?.contact ? (
        <ContactReveal
          contact={approved.contact}
          heading={t("youApproved", { name: approved.claimant.full_name })}
          note={t("approvedNote")}
        />
      ) : null}

      <m.ul
        variants={listContainer}
        initial="initial"
        animate="enter"
        className="space-y-3"
      >
        {rows.map((claim) => (
          <m.li key={claim.id} variants={listItem}>
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {claim.claimant.full_name}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {formatRelative(claim.created_at, locale)}
                    </p>
                  </div>
                  <ClaimStatusBadge status={claim.status} />
                </div>

                {claim.answers.length > 0 ? (
                  <dl className="space-y-3 rounded-xl border bg-muted/30 p-4">
                    {claim.answers.map((a) => (
                      <div key={a.question} className="space-y-0.5">
                        <dt className="text-caption text-muted-foreground">
                          {a.question}
                        </dt>
                        <dd className="text-body-sm font-medium">{a.answer}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}

                {claim.message ? (
                  <p className="whitespace-pre-line text-body-sm text-foreground/85">
                    {claim.message}
                  </p>
                ) : null}

                {claim.status === "pending" ? (
                  <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                    <Button
                      size="sm"
                      onClick={() => approve.mutate(claim.id)}
                      disabled={busy}
                    >
                      {approve.isPending ? <Spinner /> : <Check className="h-4 w-4" />}
                      {t("approveShare")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => reject.mutate(claim.id)}
                      disabled={busy}
                    >
                      <X className="h-4 w-4" />
                      {t("notThem")}
                    </Button>
                    <span className="ms-auto text-caption text-muted-foreground">
                      {t("approvingSharesDetails")}
                    </span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </m.li>
        ))}
      </m.ul>
    </section>
  );
}
