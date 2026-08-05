/**
 * Server-only runtime config. Never import this into a client component — these
 * values are read from `process.env` at request time and are not inlined into
 * the browser bundle the way `NEXT_PUBLIC_*` are.
 */
export const serverEnv = {
  /**
   * Base URL the Next *server* uses to reach the API. Always absolute.
   *
   * Deliberately NOT derived from `NEXT_PUBLIC_API_URL`: that one is relative
   * (`/api/v1`) so the browser stays same-origin, and `fetch` on the server has
   * no origin to resolve a relative path against. Defaults to the same
   * `API_ORIGIN` the `/api/v1/*` proxy in next.config.mjs forwards to, so one
   * variable moves both. Inside Docker that must be the compose service name —
   * `localhost` from the frontend container is the frontend container itself.
   */
  apiUrl:
    process.env.INTERNAL_API_URL ||
    `${(process.env.API_ORIGIN || "http://localhost:8000").replace(/\/+$/, "")}/api/v1`,

  /**
   * Public origin of this site. Open Graph URLs must be absolute — a relative
   * image path produces no preview card on WhatsApp or Facebook.
   */
  siteUrl: (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
} as const;
