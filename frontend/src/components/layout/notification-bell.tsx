"use client";

import { Link } from "@/i18n/navigation";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useUnreadCount } from "@/features/notifications/hooks/use-unread-count";
import { ROUTES } from "@/lib/routes";

export function NotificationBell() {
  const t = useTranslations("notifications");
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;

  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <Link href={ROUTES.notifications} aria-label={t("bellLabel", { count })}>
        <Bell className="h-5 w-5" />
        {count > 0 ? (
          <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none tabular-nums text-primary-foreground ring-2 ring-background">
            {count > 9 ? "9+" : count}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
