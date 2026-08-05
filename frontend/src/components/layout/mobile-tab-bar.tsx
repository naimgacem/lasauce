"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { Bell, Home, Plus, Search, User } from "lucide-react";

import { useUnreadCount } from "@/features/notifications/hooks/use-unread-count";
import { ROUTES } from "@/lib/routes";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";


const tabs = [
  { href: ROUTES.dashboard, key: "home", icon: Home },
  { href: ROUTES.search, key: "search", icon: Search },
  // center slot is the raised Report button
  { href: ROUTES.notifications, key: "notifications", icon: Bell },
  { href: ROUTES.profile, key: "profile", icon: User },
] as const;

/**
 * Mobile navigation for the authenticated shell (<lg). The raised center
 * button is the primary action: report an item.
 */
export function MobileTabBar() {
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const { data } = useUnreadCount();
  const unread = data?.count ?? 0;

  const renderTab = (tab: (typeof tabs)[number]) => {
    const active = pathname === tab.href;
    const isAlerts = tab.href === ROUTES.notifications;
    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex min-w-touch flex-1 flex-col items-center gap-1 rounded-md py-1.5 text-caption",
          "transition-colors duration-200 active:scale-95 motion-reduce:active:scale-100",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <tab.icon
          className={cn(
            "h-5 w-5 transition-transform duration-200",
            active && "scale-110",
          )}
          aria-hidden
        />
        {isAlerts && unread > 0 ? (
          <span className="absolute end-1/2 top-0 h-2 w-2 translate-x-3 rtl:-translate-x-3 rounded-full bg-primary" />
        ) : null}
        {t(tab.key)}
      </Link>
    );
  };

  return (
    <nav
      aria-label={t("primaryNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-end justify-between px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {tabs.slice(0, 2).map(renderTab)}

        <Link
          href={ROUTES.report}
          aria-label={tc("reportItem")}
          className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </Link>

        {tabs.slice(2).map(renderTab)}
      </div>
    </nav>
  );
}
