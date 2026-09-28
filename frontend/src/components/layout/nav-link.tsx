"use client";

import { Link } from "@/i18n/navigation";

import { cn } from "@/lib/utils";

/**
 * Desktop header link, shared by the public and app shells so "you are here"
 * looks the same on both sides of sign-in. The link fills the bar's height and
 * the active rule sits on the bar's bottom border, where a tab indicator
 * belongs, rather than floating under the text.
 */
export function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-16 items-center px-3 text-body-sm font-medium transition-colors duration-200",
        "after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-primary",
        "focus-visible:rounded-md focus-visible:ring-inset focus-visible:ring-offset-0",
        active
          ? "text-foreground after:opacity-100"
          : "text-muted-foreground after:opacity-0 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
