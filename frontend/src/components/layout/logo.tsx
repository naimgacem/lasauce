import Link from "next/link";
import { PackageSearch } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({
  href = "/",
  withWordmark = true,
  className,
}: {
  href?: string;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 font-semibold", className)}
    >
      <PackageSearch className="h-5 w-5 text-primary" aria-hidden />
      {withWordmark ? (
        <span className="hidden sm:inline">Lost &amp; Found</span>
      ) : null}
      <span className="sr-only">Lost &amp; Found — home</span>
    </Link>
  );
}
