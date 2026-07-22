"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/feedback/error-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to monitoring in a real deployment.
    console.error(error);
  }, [error]);

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-10">
      <div className="w-full max-w-md">
        <ErrorState
          title="Something went wrong"
          message={error.message || "An unexpected error occurred. Please try again."}
          onRetry={reset}
        />
      </div>
    </div>
  );
}
