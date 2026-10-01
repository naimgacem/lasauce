"use client";

import * as React from "react";
import { ArrowLeft, Menu } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { isRtl } from "@/i18n/routing";
import { ROUTES } from "@/lib/routes";

import { AdminNav } from "./admin-nav";

function Brand() {
  const t = useTranslations("admin.shell");
  return (
    <div className="flex items-center gap-2.5">
      <Logo href={ROUTES.admin} />
      <span className="rounded border px-1.5 py-0.5 text-overline uppercase text-muted-foreground">
        {t("badge")}
      </span>
    </div>
  );
}

function BackToApp({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("admin.shell");
  return (
    <Link
      href={ROUTES.dashboard}
      onClick={onNavigate}
      className="group flex h-9 items-center gap-3 rounded-md px-3 text-body-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:ring-offset-0"
    >
      <ArrowLeft
        className="h-4 w-4 transition-transform ltr:group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5"
        aria-hidden
      />
      {t("backToApp")}
    </Link>
  );
}

/**
 * The console frame: a fixed sidebar from `lg`, a sheet below it.
 *
 * The user-facing product deliberately has no sidebar (docs §7). This is not
 * that product — it is a tool an operator works in for an hour at a time,
 * moving between five lists, and a persistent map of where they are earns its
 * width here.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin.shell");
  const locale = useLocale();
  const [open, setOpen] = React.useState(false);
  const close = () => setOpen(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-e bg-card/60 lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b px-5">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <AdminNav />
        </div>
        <div className="border-t p-3">
          <BackToApp />
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b px-4 surface-blur lg:px-8">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label={t("openNav")}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side={isRtl(locale) ? "right" : "left"}
              className="flex w-72 flex-col gap-0 p-0"
            >
              <div className="flex h-16 items-center border-b px-5">
                <SheetTitle className="sr-only">{t("navLabel")}</SheetTitle>
                <Brand />
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-5">
                <AdminNav onNavigate={close} />
              </div>
              <div className="border-t p-3">
                <BackToApp onNavigate={close} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="lg:hidden">
            <Brand />
          </div>

          <div className="ms-auto flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[80rem]">{children}</div>
        </main>
      </div>
    </div>
  );
}
