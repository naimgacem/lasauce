"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { FullPageLoader } from "@/components/feedback/loading";
import { useSession } from "@/features/auth/hooks/use-session";
import { DEFAULT_AUTHED_ROUTE } from "@/lib/routes";

/** Keeps authenticated users out of the (auth) group; honours ?next=. */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();

  React.useEffect(() => {
    if (status === "authed") {
      const next = searchParams.get("next");
      // Only allow internal redirects.
      router.replace(next?.startsWith("/") ? next : DEFAULT_AUTHED_ROUTE);
    }
  }, [status, searchParams, router]);

  if (status === "loading") return <FullPageLoader />;
  if (status === "authed") return <FullPageLoader label={t("redirecting")} />;

  return <>{children}</>;
}
