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
  // Short label: "Notifications" does not fit a quarter of a 390px bar.
  { href: ROUTES.notifications, key: "notificationsShort", icon: Bell },
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
          "relative flex min-w-touch flex-1 flex-col items-center gap-1 rounded-md py-1.5 text-[0.6875rem] font-medium leading-none",
          "transition-colors duration-200",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <tab.icon
          className={cn("h-5 w-5", active && "text-primary")}
          strokeWidth={active ? 2.25 : 1.75}
          aria-hidden
        />
        {isAlerts && unread > 0 ? (
          <span
            className="absolute end-1/2 top-1 h-2 w-2 translate-x-3 rounded-full bg-primary ring-2 ring-background rtl:-translate-x-3"
            aria-hidden
          />
        ) : null}
        <span className="max-w-full truncate">{t(tab.key)}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label={t("primaryNav")}
      className="fixed inset-x-0 bottom-0 z-40 border-t surface-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-end justify-between px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {tabs.slice(0, 2).map(renderTab)}

        <Link
          href={ROUTES.report}
          aria-label={tc("reportItem")}
          className="-mt-5 flex h-[3.25rem] w-[3.25rem] shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-background transition-transform active:scale-95 motion-reduce:active:scale-100"
        >
          <Plus className="h-6 w-6" />
        </Link>

        {tabs.slice(2).map(renderTab)}
      </div>
    </nav>
  );
}
