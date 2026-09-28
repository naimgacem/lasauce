import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center py-10 text-center">
      <p className="text-overline uppercase text-muted-foreground">404</p>
      <h1 className="mt-3 text-heading-1">{t("notFoundTitle")}</h1>
      <p className="mt-2 max-w-sm text-body-sm text-muted-foreground">
        {t("notFoundBody")}
      </p>
      <Button asChild className="mt-6">
        <Link href={ROUTES.home}>{t("goHome")}</Link>
      </Button>
    </div>
  );
}
