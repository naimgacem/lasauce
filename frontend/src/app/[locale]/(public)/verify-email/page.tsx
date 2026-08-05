"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, ShieldAlert } from "lucide-react";

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
        title="This link is incomplete"
        body="Verification links expire after 48 hours and can only be used once. Sign in and we'll send a fresh one."
        action={{ href: ROUTES.login, label: "Go to sign in" }}
      />
    );
  }

  if (verify.isPending || verify.isIdle) {
    return <FullPageLoader label="Verifying your email…" />;
  }

  if (verify.isError) {
    return (
      <Result
        tone="error"
        title="We couldn't verify this link"
        body={
          verify.error instanceof Error
            ? `${verify.error.message} It may have expired or already been used.`
            : "The link may have expired or already been used."
        }
        action={{ href: ROUTES.login, label: "Go to sign in" }}
      />
    );
  }

  return (
    <Result
      tone="success"
      title="Email verified"
      body="Thanks — your address is confirmed. You're all set to report and claim items."
      action={
        isAuthed
          ? { href: ROUTES.dashboard, label: "Go to dashboard" }
          : { href: ROUTES.login, label: "Sign in" }
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
