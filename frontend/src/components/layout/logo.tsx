import { Link } from "@/i18n/navigation";
import { PackageSearch } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export function Logo({
  href = "/",
  withWordmark = true,
  className,
}: {
  href?: string;
  withWordmark?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");

  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 font-semibold", className)}
    >
      <PackageSearch className="h-5 w-5 text-primary" aria-hidden />
      {withWordmark ? (
        <span className="hidden sm:inline">{t("appName")}</span>
      ) : null}
      <span className="sr-only">{t("appName")}</span>
    </Link>
  );
}
