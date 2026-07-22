"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { NotificationBell } from "@/components/layout/notification-bell";
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
import { cn } from "@/lib/utils";

const links = [
  { href: ROUTES.dashboard, label: "Dashboard" },
  { href: ROUTES.search, label: "Browse" },
  { href: ROUTES.myItems, label: "My items" },
];

/**
 * Authenticated shell header. Desktop (≥lg) carries the nav; on mobile the
 * bottom tab bar owns navigation and this bar stays slim.
 */
export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center gap-6">
        <Logo href={ROUTES.dashboard} />

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="ml-2">
                <Plus className="h-4 w-4" />
                Report
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link href={ROUTES.reportLost} className="cursor-pointer">
                  Something I lost
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={ROUTES.reportFound} className="cursor-pointer">
                  Something I found
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
