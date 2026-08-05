"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { ErrorState } from "@/components/feedback/error-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    // Surface to monitoring in a real deployment.
    console.error(error);
  }, [error]);

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <ErrorState
          title={t("genericTitle")}
          message={error.message || t("genericBody")}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
