import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ErrorState } from "@/components/feedback/error-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

/** Rendered with a real 404 status when `notFound()` fires in the page. */
export default async function ItemNotFound() {
  const t = await getTranslations("item");

  return (
    <div className="container max-w-xl py-12">
      <ErrorState
        title={t("notFoundTitle")}
        message={t("notFoundBody")}
      />
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild variant="outline">
          <Link href={ROUTES.lost}>{t("browseLost")}</Link>
        </Button>
        <Button asChild>
          <Link href={ROUTES.found}>{t("browseFound")}</Link>
        </Button>
      </div>
    </div>
  );
}
