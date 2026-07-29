"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSession } from "@/features/auth/hooks/use-session";
import { loginWithNext, ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const NAV = [
  { href: ROUTES.lost, label: "Lost items" },
  { href: ROUTES.found, label: "Found items" },
  { href: ROUTES.search, label: "Search" },
] as const;

/** Public shell header — marketing nav, auth-aware right side. */
export function SiteHeader() {
  const pathname = usePathname();
  const { isAuthed } = useSession();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const isActive = (href: string) => pathname === href;
  const reportHref = isAuthed ? ROUTES.report : loginWithNext(ROUTES.report);

  return (
    <header className="sticky top-0 z-40 w-full border-b surface-blur">
      <div className="container flex h-16 items-center gap-6">
        <Logo />

        {/* Desktop nav — an animated underline marks the active section. */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={cn(
                "relative rounded-md px-3 py-2 text-body-sm font-medium transition-colors",
                "after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full",
                "after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-200 after:ease-out",
                "hover:text-foreground hover:after:scale-x-100",
                "motion-reduce:after:transition-none",
                isActive(link.href)
                  ? "text-foreground after:scale-x-100"
                  : "text-muted-foreground",
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
              <Button
                variant="outline"
                size="sm"
                asChild
                className="hidden sm:inline-flex"
              >
                <Link href={ROUTES.dashboard}>Dashboard</Link>
              </Button>
              <UserMenu />
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="hidden sm:inline-flex"
              >
                <Link href={ROUTES.login}>Sign in</Link>
              </Button>
              <Button size="sm" asChild className="hidden sm:inline-flex">
                <Link href={reportHref}>
                  <Plus className="h-4 w-4" />
                  Report an item
                </Link>
              </Button>
            </>
          )}

          {/* Mobile: the public shell had no navigation at all before this. */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>

              <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile">
                {NAV.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={cn(
                      "flex min-h-touch items-center rounded-lg px-3 text-body font-medium transition-colors",
                      isActive(link.href)
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="mt-8 flex flex-col gap-2 border-t pt-6">
                <Button asChild onClick={() => setMenuOpen(false)}>
                  <Link href={reportHref}>
                    <Plus className="h-4 w-4" />
                    Report an item
                  </Link>
                </Button>
                {!isAuthed ? (
                  <Button
                    variant="outline"
                    asChild
                    onClick={() => setMenuOpen(false)}
                  >
                    <Link href={ROUTES.login}>Sign in</Link>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    asChild
                    onClick={() => setMenuOpen(false)}
                  >
                    <Link href={ROUTES.dashboard}>Dashboard</Link>
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
