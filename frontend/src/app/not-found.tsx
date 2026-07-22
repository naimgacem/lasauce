import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

export default function NotFound() {
  return (
    <div className="container flex min-h-[70vh] flex-col items-center justify-center gap-4 py-10 text-center">
      <p className="text-6xl font-bold text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you are looking for doesn&apos;t exist or may have been moved.
      </p>
      <Button asChild>
        <Link href={ROUTES.home}>Back home</Link>
      </Button>
    </div>
  );
}
