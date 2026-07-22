"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/use-session";
import { loginWithNext, ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const links = [
  { href: ROUTES.lost, label: "Lost" },
  { href: ROUTES.found, label: "Found" },
  { href: ROUTES.search, label: "Search" },
];

/** Public shell header — marketing nav, auth-aware right side. */
export function SiteHeader() {
  const pathname = usePathname();
  const { isAuthed } = useSession();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center gap-6">
        <Logo />

        <nav className="flex items-center gap-1">
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
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {isAuthed ? (
            <>
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                <Link href={ROUTES.dashboard}>Dashboard</Link>
              </Button>
              <UserMenu />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={ROUTES.login}>Sign in</Link>
              </Button>
              <Button size="sm" asChild className="hidden sm:inline-flex">
                <Link href={loginWithNext(ROUTES.reportLost)}>Report item</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
