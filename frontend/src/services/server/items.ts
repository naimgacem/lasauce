/**
 * Server-side item fetching, for `generateMetadata` and initial render.
 *
 * Kept separate from `services/items.client.ts`: that client carries auth
 * headers, token refresh and browser-only concerns. Server rendering only ever
 * reads public endpoints, so a bare `fetch` is both sufficient and safer — a
 * crawler must never be served a page built with someone's credentials.
 */

import { env } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import { MOCK_ITEMS } from "@/services/mock/data";
import type { Item } from "@/types/item";

/**
 * Whether a null from `fetchItem` proves the item doesn't exist.
 *
 * With mocks on there is no backend to ask: the seed dataset is compiled in, but
 * reports created during a session live only in the browser's copy of the mock
 * store. An id the server can't resolve therefore means "let the client try",
 * not "404" — otherwise every freshly filed demo report lands on Item not found.
 */
export const serverKnowsEveryItem = !env.useMocks;

/** Returns null for 404s and any transport failure — callers decide the UX. */
export async function fetchItem(id: string): Promise<Item | null> {
  // Mirrors the client-side switch in `services/index.ts`: whichever data source
  // the browser is reading, the server render has to read the same one.
  if (env.useMocks) return MOCK_ITEMS.find((item) => item.id === id) ?? null;

  try {
    const res = await fetch(`${serverEnv.apiUrl}/items/${encodeURIComponent(id)}`, {
      // Shared links get crawled repeatedly (WhatsApp, Facebook, Google). A
      // short revalidate keeps previews current without a request per crawl;
      // the client refetches on mount anyway, so a viewer never sees stale data.
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as Item;
  } catch {
    // The API being briefly unreachable should render the not-found state
    // rather than crash the route.
    return null;
  }
}

/** Absolute URL for a stored image — Open Graph rejects relative paths. */
export function absoluteMediaUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(imagePath)) return imagePath;
  return `${serverEnv.siteUrl}/media/${imagePath.replace(/^\/+/, "")}`;
}
