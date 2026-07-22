"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { FullPageLoader } from "@/components/feedback/loading";
import { useSession } from "@/features/auth/hooks/use-session";
import { loginWithNext } from "@/lib/routes";

/**
 * Protects the (app) route group. Waits for the session bootstrap, then
 * redirects guests to login preserving the intended destination.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();

  React.useEffect(() => {
    if (status === "guest") {
      router.replace(loginWithNext(pathname));
    }
  }, [status, pathname, router]);

  if (status === "loading") return <FullPageLoader />;
  if (status === "guest") return <FullPageLoader label="Redirecting to sign in…" />;

  return <>{children}</>;
}
