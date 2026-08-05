"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
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

function ResetPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const token = useSearchParams().get("token");
  const reset = useResetPassword();

  const schema = z
    .object({
      // Mirrors the backend contract in app/schemas/auth.py.
      password: z
        .string()
        .min(8, t("passwordTooShort"))
        .max(128, t("passwordTooLong")),
      confirm: z.string().min(1, t("confirmPasswordRequired")),
    })
    .refine((v) => v.password === v.confirm, {
      message: t("passwordsMismatch"),
      path: ["confirm"],
    });
  type Values = z.infer<typeof schema>;

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
          <CardTitle className="text-heading-3">{t("linkIncompleteTitle")}</CardTitle>
          <CardDescription>
            {t("resetLinkExpiredBody")}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild>
            <Link href={ROUTES.forgotPassword}>{t("requestNewLink")}</Link>
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
          toast.success(t("passwordUpdatedTitle"), {
            description: t("passwordUpdatedBody"),
          });
          router.push(ROUTES.login);
        },
        onError: (error) =>
          form.setError("root", {
            message:
              error instanceof Error
                ? t("resetErrorExpired", { message: error.message })
                : t("resetErrorGeneric"),
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
        <CardTitle className="text-heading-3">{t("resetHeading")}</CardTitle>
        <CardDescription>
          {t("resetHeadingBody")}
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
                  <FormLabel>{t("newPassword")}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="new-password"
                      placeholder={t("newPasswordPlaceholder")}
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {t("newPasswordHint")}
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
                  <FormLabel>{t("confirmPassword")}</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={reset.isPending}>
              {reset.isPending ? <Spinner /> : null}
              {t("updatePassword")}
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
