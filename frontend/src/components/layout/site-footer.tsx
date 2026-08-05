import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { Logo } from "@/components/layout/logo";
import { ROUTES } from "@/lib/routes";

export function SiteFooter() {
  const t = useTranslations("common");

  return (
    <footer className="border-t py-8">
      <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <Logo withWordmark={false} />
          <span>
            {t("appName")} — {t("tagline")}
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href={ROUTES.lost} className="hover:text-foreground">
            {t("lost")}
          </Link>
          <Link href={ROUTES.found} className="hover:text-foreground">
            {t("found")}
          </Link>
          <Link href={ROUTES.search} className="hover:text-foreground">
            {t("search")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
