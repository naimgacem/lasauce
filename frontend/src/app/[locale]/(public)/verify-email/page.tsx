"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { FullPageLoader } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSession } from "@/features/auth/hooks/use-session";
import { useVerifyEmail } from "@/features/auth/hooks/use-password";
import { ROUTES } from "@/lib/routes";
import { useAuthStore } from "@/store/auth.store";

function VerifyEmailInner() {
  const t = useTranslations("auth");
  const token = useSearchParams().get("token");
  const { isAuthed } = useSession();
  const verify = useVerifyEmail();

  // Fire exactly once per token. The ref survives StrictMode's double-effect in
  // development, which would otherwise burn the token on the first render.
  const attempted = React.useRef(false);
  React.useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    verify.mutate(token, {
      onSuccess: (user) => {
        // Keep the session snapshot honest so the profile badge flips instantly.
        const current = useAuthStore.getState().user;
        if (current && user?.id === current.id) {
          useAuthStore.getState().setUser(user);
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <Result
        tone="error"
        title={t("linkIncompleteTitle")}
        body={t("verifyLinkIncompleteBody")}
        action={{ href: ROUTES.login, label: t("goToSignIn") }}
      />
    );
  }

  if (verify.isPending || verify.isIdle) {
    return <FullPageLoader label={t("verifyPending")} />;
  }

  if (verify.isError) {
    return (
      <Result
        tone="error"
        title={t("verifyFailed")}
        body={
          verify.error instanceof Error
            ? t("verifyFailedBody", { message: verify.error.message })
            : t("verifyFailedBodyGeneric")
        }
        action={{ href: ROUTES.login, label: t("goToSignIn") }}
      />
    );
  }

  return (
    <Result
      tone="success"
      title={t("verifiedTitle")}
      body={t("verifiedBody")}
      action={
        isAuthed
          ? { href: ROUTES.dashboard, label: t("goToDashboard") }
          : { href: ROUTES.login, label: t("goToSignIn") }
      }
    />
  );
}

function Result({
  tone,
  title,
  body,
  action,
}: {
  tone: "success" | "error";
  title: string;
  body: string;
  action: { href: string; label: string };
}) {
  const success = tone === "success";
  return (
    <Card>
      <CardHeader className="items-center text-center">
        <span
          className={
            success
              ? "mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-found-muted text-found"
              : "mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
          }
          aria-hidden
        >
          {success ? (
            <BadgeCheck className="h-6 w-6" />
          ) : (
            <ShieldAlert className="h-6 w-6" />
          )}
        </span>
        <CardTitle className="text-heading-3">{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      <CardFooter className="justify-center">
        <Button asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-section">
      <div className="w-full max-w-container-form">
        <React.Suspense fallback={<FullPageLoader />}>
          <VerifyEmailInner />
        </React.Suspense>
      </div>
    </div>
  );
}
