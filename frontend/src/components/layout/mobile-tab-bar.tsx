"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, Plus, Search, User } from "lucide-react";

import { useUnreadCount } from "@/features/notifications/hooks/use-unread-count";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const tabs = [
  { href: ROUTES.dashboard, label: "Home", icon: Home },
  { href: ROUTES.search, label: "Browse", icon: Search },
  // center slot is the raised Report button
  { href: ROUTES.notifications, label: "Alerts", icon: Bell },
  { href: ROUTES.profile, label: "You", icon: User },
] as const;

/**
 * Mobile navigation for the authenticated shell (<lg). The raised center
 * button is the primary action: report an item.
 */
export function MobileTabBar() {
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
        className={cn(
          "relative flex min-w-[44px] flex-1 flex-col items-center gap-1 rounded-md py-1.5 text-[11px] font-medium",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <tab.icon className="h-5 w-5" />
        {isAlerts && unread > 0 ? (
          <span className="absolute right-1/2 top-0 h-2 w-2 translate-x-3 rounded-full bg-primary" />
        ) : null}
        {tab.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-end justify-between px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {tabs.slice(0, 2).map(renderTab)}

        <Link
          href={ROUTES.report}
          aria-label="Report an item"
          className="-mt-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </Link>

        {tabs.slice(2).map(renderTab)}
      </div>
    </nav>
  );
}
