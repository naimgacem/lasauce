import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** Same shape as EmptyState, so a failed list and an empty list sit alike. */
export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const t = useTranslations("errors");
  const tc = useTranslations("common");

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-destructive/25 bg-destructive/[0.03] px-6 py-12 text-center"
    >
      <span
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive"
        aria-hidden
      >
        <AlertTriangle className="h-5 w-5" />
      </span>
      <h3 className="text-heading-4">{title ?? t("genericTitle")}</h3>
      {message ? (
        <p className="mt-1.5 max-w-sm text-body-sm text-muted-foreground">{message}</p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          {tc("retry")}
        </Button>
      ) : null}
    </div>
  );
}
