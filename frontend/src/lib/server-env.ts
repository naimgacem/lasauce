/**
 * Server-only runtime config. Never import this into a client component — these
 * values are read from `process.env` at request time and are not inlined into
 * the browser bundle the way `NEXT_PUBLIC_*` are.
 */
export const serverEnv = {
  /**
   * Base URL the Next *server* uses to reach the API.
   *
   * This is deliberately separate from `NEXT_PUBLIC_API_URL`: that one is the
   * URL the browser uses, so it has to be host-reachable (`localhost:8000`).
   * Inside Docker, `localhost` from the frontend container is the frontend
   * container itself — server-side fetches must go to the compose service name.
   */
  apiUrl:
    process.env.INTERNAL_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:8000/api/v1",

  /**
   * Public origin of this site. Open Graph URLs must be absolute — a relative
   * image path produces no preview card on WhatsApp or Facebook.
   */
  siteUrl: (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
} as const;
