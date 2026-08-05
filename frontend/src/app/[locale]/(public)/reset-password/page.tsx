"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Spinner } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useResetPassword } from "@/features/auth/hooks/use-password";
import { ROUTES } from "@/lib/routes";
import { useAuthStore } from "@/store/auth.store";

const schema = z
  .object({
    // Mirrors the backend contract in app/schemas/auth.py.
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .max(128, "Password is too long"),
    confirm: z.string().min(1, "Confirm your new password"),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

type Values = z.infer<typeof schema>;

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const reset = useResetPassword();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });

  if (!token) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <span
            className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
            aria-hidden
          >
            <ShieldAlert className="h-6 w-6" />
          </span>
          <CardTitle className="text-heading-3">This link is incomplete</CardTitle>
          <CardDescription>
            Reset links expire after 30 minutes and can only be used once. Request
            a fresh one and try again.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild>
            <Link href={ROUTES.forgotPassword}>Request a new link</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  function onSubmit(values: Values) {
    reset.mutate(
      { token: token!, password: values.password },
      {
        onSuccess: () => {
          // Resetting revokes every refresh token server-side, so any session
          // held in this tab is already dead — clear it rather than let the
          // user act on a stale one.
          useAuthStore.getState().clearSession();
          toast.success("Password updated", {
            description: "Sign in with your new password.",
          });
          router.push(ROUTES.login);
        },
        onError: (error) =>
          form.setError("root", {
            message:
              error instanceof Error
                ? `${error.message} The link may have expired.`
                : "Could not reset your password.",
          }),
      },
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <span
          className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          aria-hidden
        >
          <KeyRound className="h-6 w-6" />
        </span>
        <CardTitle className="text-heading-3">Choose a new password</CardTitle>
        <CardDescription>
          You&apos;ll be signed out everywhere else once it&apos;s changed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {form.formState.errors.root?.message ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-body-sm text-destructive"
              >
                {form.formState.errors.root.message}
              </p>
            ) : null}

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Use something you don&apos;t reuse elsewhere.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={reset.isPending}>
              {reset.isPending ? <Spinner /> : null}
              Update password
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-section">
      <div className="w-full max-w-container-form">
        {/* Suspense: the form reads ?token= via useSearchParams. */}
        <React.Suspense fallback={<div className="h-80" />}>
          <ResetPasswordForm />
        </React.Suspense>
      </div>
    </div>
  );
}
