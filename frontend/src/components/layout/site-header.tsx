"use client";

import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/use-session";
import { ROUTES } from "@/lib/routes";

/** Public shell header — marketing nav, auth-aware right side. */
export function SiteHeader() {
  const { isAuthed } = useSession();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center gap-6">
        <Logo />

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
            </>
          )}
        </div>
      </div>
    </header>
  );
}
