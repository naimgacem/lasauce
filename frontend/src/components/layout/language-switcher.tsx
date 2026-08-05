"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Check, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_LABELS, LOCALES, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/**
 * Language switcher.
 *
 * Switching stays on the *same* page rather than bouncing to the home page:
 * `usePathname` from our i18n wrapper returns the path without the locale
 * prefix, so re-pushing it under a new locale lands on the translated
 * equivalent. Search params are carried across too, so a filtered search
 * survives a language change.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function switchTo(next: Locale) {
    if (next === locale) return;
    const qs = searchParams.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { locale: next });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative", className)}
          aria-label={t("language")}
          disabled={pending}
        >
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {LOCALES.map((code) => (
          <DropdownMenuItem
            key={code}
            onSelect={() => switchTo(code)}
            className="justify-between gap-3"
            // Each label is written in its own language, so it must render in
            // that language's direction regardless of the current page.
            dir={code === "ar" ? "rtl" : "ltr"}
          >
            <span>{LOCALE_LABELS[code]}</span>
            {code === locale ? <Check className="h-4 w-4" aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
