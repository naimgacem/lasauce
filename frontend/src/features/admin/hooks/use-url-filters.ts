"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { usePathname, useRouter } from "@/i18n/navigation";

type Value = string | number | boolean | null | undefined;

/**
 * Filter state that lives in the URL.
 *
 * An operator who narrows the users table to "suspended, unverified" should be
 * able to paste that view to a colleague, reload it, or press Back and land on
 * it again. Component state gives none of that. Every filter in the console
 * reads and writes through here.
 *
 * Changing any filter resets `page`: page 4 of the old result set is
 * meaningless in the new one, and usually empty. Opening a detail sheet is not
 * a filter change, so it passes `keepPage`.
 */
export function useUrlFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const get = React.useCallback(
    (key: string): string | undefined => searchParams.get(key) ?? undefined,
    [searchParams],
  );

  const set = React.useCallback(
    (patch: Record<string, Value>, options?: { keepPage?: boolean }) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (!("page" in patch) && !options?.keepPage) next.delete("page");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const hasFilters = Array.from(searchParams.keys()).some((key) => key !== "page");

  return {
    get,
    set,
    page,
    setPage: (value: number) => set({ page: value > 1 ? value : undefined }),
    hasFilters,
    clear: () => router.replace(pathname, { scroll: false }),
  };
}
