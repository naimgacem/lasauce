import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { ROUTES } from "@/lib/routes";

export function SiteFooter() {
  return (
    <footer className="border-t py-8">
      <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <Logo withWordmark={false} />
          <span>Lost &amp; Found — AI-assisted reunions.</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href={ROUTES.lost} className="hover:text-foreground">
            Lost
          </Link>
          <Link href={ROUTES.found} className="hover:text-foreground">
            Found
          </Link>
          <Link href={ROUTES.search} className="hover:text-foreground">
            Search
          </Link>
        </nav>
      </div>
    </footer>
  );
}
