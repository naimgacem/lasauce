"use client";

import { useRouter } from "next/navigation";
import { m } from "framer-motion";
import {
  Bell,
  CheckCheck,
  PackageCheck,
  PackageX,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { listItem } from "@/animations";
import { formatRelative } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationType } from "@/types/notification";

const TYPE_META: Record<
  NotificationType,
  { icon: LucideIcon; iconClass: string; ai?: boolean }
> = {
  match_found: { icon: Sparkles, iconClass: "text-white", ai: true },
  match_confirmed: { icon: CheckCheck, iconClass: "text-found" },
  item_claimed: { icon: PackageCheck, iconClass: "text-primary" },
  item_closed: { icon: PackageX, iconClass: "text-muted-foreground" },
  system: { icon: Bell, iconClass: "text-muted-foreground" },
};

export function NotificationItem({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
}) {
  const router = useRouter();
  const meta = TYPE_META[notification.type];
  const Icon = meta.icon;

  function open() {
    if (!notification.is_read) onRead(notification.id);
    if (notification.item_id) router.push(ROUTES.item(notification.item_id));
  }

  return (
    <m.li variants={listItem}>
      <button
        type="button"
        onClick={open}
        className={cn(
          "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !notification.is_read && "border-primary/20 bg-primary/[0.03]",
        )}
        aria-label={`${notification.is_read ? "" : "Unread: "}${notification.title}`}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            meta.ai ? "bg-ai-gradient" : "bg-secondary",
          )}
          aria-hidden
        >
          <Icon className={cn("h-4 w-4", meta.iconClass)} />
        </span>

        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="flex items-center gap-2">
            <span
              className={cn(
                "truncate text-sm",
                notification.is_read ? "font-medium" : "font-semibold",
              )}
            >
              {notification.title}
            </span>
            {!notification.is_read ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
            ) : null}
          </span>
          <span className="block text-sm text-muted-foreground">
            {notification.body}
          </span>
          <span className="block text-xs text-muted-foreground/70">
            {formatRelative(notification.created_at)}
          </span>
        </span>
      </button>
    </m.li>
  );
}
