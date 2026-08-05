import { createNavigation } from "next-intl/navigation";

import { routing } from "@/i18n/routing";

/**
 * Locale-aware replacements for next/link and next/navigation.
 *
 * Import `Link`, `useRouter`, `usePathname` and `redirect` from HERE, not from
 * `next/link` / `next/navigation` — these keep the active locale prefix on
 * every href and every programmatic navigation. A plain next/link would drop
 * an Arabic reader back into French on the first click.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
