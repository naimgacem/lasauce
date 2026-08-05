"use client";

import * as React from "react";
import { Link } from "@/i18n/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForgotPassword } from "@/features/auth/hooks/use-password";
import { ROUTES } from "@/lib/routes";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const forgot = useForgotPassword();

  const schema = z.object({
    email: z.string().min(1, t("emailRequired")).email(t("emailInvalid")),
  });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: Values) {
    // Resolves the same way for unknown addresses — see the hook's note.
    forgot.mutate(values.email, { onSuccess: () => setSentTo(values.email) });
  }

  if (sentTo) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <span
            className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-found-muted text-found"
            aria-hidden
          >
            <MailCheck className="h-6 w-6" />
          </span>
          <CardTitle className="text-heading-3">{t("checkInboxTitle")}</CardTitle>
          <CardDescription>
            {t.rich("checkInboxBody", {
              email: sentTo,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button variant="ghost" asChild>
            <Link href={ROUTES.login}>
              <ArrowLeft className="h-4 w-4" />
              {t("backToLogin")}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-heading-3">{t("forgotTitle")}</CardTitle>
        <CardDescription>
          {t("forgotSubtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("email")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder={t("emailPlaceholder")}
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={forgot.isPending}>
              {forgot.isPending ? <Spinner /> : null}
              {t("sendLink")}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center">
        <Button variant="ghost" size="sm" asChild>
          <Link href={ROUTES.login}>
            <ArrowLeft className="h-4 w-4" />
            {t("backToLogin")}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
