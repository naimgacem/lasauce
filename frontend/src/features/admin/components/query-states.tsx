"use client";

import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/types/api";

import { RestrictedNotice } from "./admin-guard";

/**
 * A failed admin read. A 403 here means the role was withdrawn after the page
 * loaded — the session snapshot still said "admin" — so it gets the restricted
 * notice rather than a retry button that can never succeed.
 */
export function AdminQueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useTranslations("admin.common");
  if (error instanceof ApiError && error.status === 403) return <RestrictedNotice />;
  return (
    <ErrorState
      title={t("loadError")}
      message={error instanceof Error ? error.message : undefined}
      onRetry={onRetry}
    />
  );
}

/** Nothing matched — and, when filters are the reason, the way out. */
export function NoResults({ onClear }: { onClear?: () => void }) {
  const t = useTranslations("admin.common");
  return (
    <EmptyState
      icon={SearchX}
      title={t("noResultsTitle")}
      description={onClear ? t("noResultsBody") : undefined}
      action={
        onClear ? (
          <Button variant="outline" onClick={onClear}>
            {t("clearFilters")}
          </Button>
        ) : undefined
      }
    />
  );
}
