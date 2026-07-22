"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUnreadCount } from "@/features/notifications/hooks/use-unread-count";
import { ROUTES } from "@/lib/routes";

export function NotificationBell() {
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;

  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link href={ROUTES.notifications} aria-label={`Notifications${count ? ` (${count} unread)` : ""}`}>
        <Bell className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
