"use client";

import {
  LayoutGrid,
  Link2,
  type LucideIcon,
  Package,
  Receipt,
  ScrollText,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

type NavKey = "overview" | "users" | "items" | "matches" | "payments" | "activity";

interface NavEntry {
  key: NavKey;
  href: string;
  icon: LucideIcon;
}

/**
 * Grouped by what the operator is doing, not by database table: moderating
 * people and their reports, looking at money, reading the record.
 */
const GROUPS: { key: "moderation" | "business" | "records" | null; entries: NavEntry[] }[] = [
  { key: null, entries: [{ key: "overview", href: ROUTES.admin, icon: LayoutGrid }] },
  {
    key: "moderation",
    entries: [
      { key: "users", href: ROUTES.adminUsers, icon: Users },
      { key: "items", href: ROUTES.adminItems, icon: Package },
      { key: "matches", href: ROUTES.adminMatches, icon: Link2 },
    ],
  },
  { key: "business", entries: [{ key: "payments", href: ROUTES.adminPayments, icon: Receipt }] },
  { key: "records", entries: [{ key: "activity", href: ROUTES.adminActivity, icon: ScrollText }] },
];

function isActive(pathname: string, href: string): boolean {
  //  The overview is the prefix of every other page, so it matches exactly.
  if (href === ROUTES.admin) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("admin");
  const pathname = usePathname();

  return (
    <nav aria-label={t("shell.navLabel")} className="space-y-6">
      {GROUPS.map((group, index) => (
        <div key={group.key ?? index}>
          {group.key ? (
            <p className="mb-1.5 px-3 text-overline uppercase text-muted-foreground/80">
              {t(`shell.groups.${group.key}`)}
            </p>
          ) : null}
          <ul className="space-y-0.5">
            {group.entries.map((entry) => {
              const active = isActive(pathname, entry.href);
              return (
                <li key={entry.key}>
                  <Link
                    href={entry.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-3 rounded-md px-3 text-body-sm font-medium transition-colors duration-150",
                      "focus-visible:ring-offset-0",
                      active
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <entry.icon
                      className={cn("h-4 w-4 shrink-0", active && "text-primary")}
                      strokeWidth={active ? 2.25 : 1.75}
                      aria-hidden
                    />
                    {t(`nav.${entry.key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
