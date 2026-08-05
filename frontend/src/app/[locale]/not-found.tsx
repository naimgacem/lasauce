import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center gap-4 py-10 text-center">
      <p className="text-6xl font-bold text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {t("notFoundBody")}
      </p>
      <Button asChild>
        <Link href={ROUTES.home}>{t("goHome")}</Link>
      </Button>
    </div>
  );
}
