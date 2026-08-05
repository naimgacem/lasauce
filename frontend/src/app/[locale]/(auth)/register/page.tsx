import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthForm } from "@/features/auth/components/auth-form";
import { ROUTES } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return { title: t("signUp") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{t("registerTitle")}</CardTitle>
        <CardDescription>
          {t("registerSubtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <AuthForm mode="register" />
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          {t("haveAccount")}{" "}
          <Link
            href={ROUTES.login}
            className="font-medium text-primary hover:underline"
          >
            {tc("signIn")}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
