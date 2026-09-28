"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { ChevronDown, Plus } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { NotificationBell } from "@/components/layout/notification-bell";
import { CreditBalance } from "@/features/billing/components/credit-balance";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { NavLink } from "@/components/layout/nav-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/lib/routes";
import { useTranslations } from "next-intl";

const links = [
  { href: ROUTES.dashboard, key: "dashboard" },
  { href: ROUTES.search, key: "search" },
  { href: ROUTES.myItems, key: "myItems" },
] as const;

/**
 * Authenticated shell header. Desktop (≥lg) carries the nav; on mobile the
 * bottom tab bar owns navigation and this bar stays slim.
 */
export function AppHeader() {
  const t = useTranslations("nav");
  const tr = useTranslations("report");
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b surface-blur">
      <div className="container flex h-16 items-center gap-6">
        <Logo href={ROUTES.dashboard} />

        <nav className="hidden items-center lg:flex" aria-label={t("mainNav")}>
          {links.map((link) => (
            <NavLink key={link.href} href={link.href} active={pathname === link.href}>
              {t(link.key)}
            </NavLink>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="ms-3">
                <Plus className="h-4 w-4" />
                {t("report")}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link href={ROUTES.reportLost} className="cursor-pointer">
                  {tr("iLost")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={ROUTES.reportFound} className="cursor-pointer">
                  {tr("iFound")}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="ms-auto flex items-center gap-1">
          {/* Left of the icon cluster: it is a value, not a control, and
              sitting among the icon buttons would invite it to be read as one.
              Renders nothing when the paywall is off or the viewer is an admin. */}
          <CreditBalance className="me-1 hidden sm:inline-flex" />
          <NotificationBell />
          <LanguageSwitcher />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
