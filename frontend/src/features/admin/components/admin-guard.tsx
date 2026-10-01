"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { FullPageLoader } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/use-session";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { loginWithNext, ROUTES } from "@/lib/routes";

/** Shown to a signed-in account without the admin role — or one demoted mid-session. */
export function RestrictedNotice() {
  const t = useTranslations("admin.guard");
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <span
          className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden
        >
          <ShieldAlert className="h-5 w-5" />
        </span>
        <h1 className="text-heading-3">{t("title")}</h1>
        <p className="mt-2 text-body-sm text-muted-foreground">{t("body")}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={ROUTES.dashboard}>{t("back")}</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Keeps the console to administrators. A convenience, not the control: every
 * `/admin` endpoint checks the role itself, and a stale session snapshot that
 * still says "admin" gets 403s the console renders as `RestrictedNotice`.
 *
 * A non-admin sees the notice *without* the console frame — the navigation is
 * itself a description of what administrators can do.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const pathname = usePathname();
  const { status, isAdmin } = useSession();

  React.useEffect(() => {
    if (status === "guest") router.replace(loginWithNext(pathname));
  }, [status, pathname, router]);

  if (status === "loading") return <FullPageLoader />;
  if (status === "guest") return <FullPageLoader label={t("redirectingToSignIn")} />;
  if (!isAdmin) return <RestrictedNotice />;
  return <>{children}</>;
}
