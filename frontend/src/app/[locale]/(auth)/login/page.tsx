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
  return { title: t("signIn") };
}

export default async function LoginPage() {
  const t = await getTranslations("auth");

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{t("loginTitle")}</CardTitle>
        <CardDescription>
          {t("loginSubtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <AuthForm mode="login" />
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link
            href={ROUTES.register}
            className="font-medium text-primary hover:underline"
          >
            {t("registerTitle")}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
