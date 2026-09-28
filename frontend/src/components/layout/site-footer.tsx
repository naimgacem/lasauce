import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { Logo } from "@/components/layout/logo";
import { ROUTES } from "@/lib/routes";

export function SiteFooter() {
  const t = useTranslations("common");
  const tn = useTranslations("nav");

  return (
    <footer className="border-t">
      <div className="container flex flex-col gap-6 py-8 text-body-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <Logo className="text-foreground" />
          <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
          <span>{t("tagline")}</span>
        </div>
        <nav className="flex items-center gap-5" aria-label={tn("footerNav")}>
          <Link href={ROUTES.lost} className="transition-colors hover:text-foreground">
            {tn("lostItems")}
          </Link>
          <Link href={ROUTES.found} className="transition-colors hover:text-foreground">
            {tn("foundItems")}
          </Link>
          <Link href={ROUTES.search} className="transition-colors hover:text-foreground">
            {tn("search")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
