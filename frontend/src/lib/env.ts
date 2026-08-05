/** Typed public runtime config — nothing else reads `process.env` directly. */
export const env = {
  /**
   * Relative by default, so browser calls stay same-origin and reach the API
   * through the `/api/v1/*` proxy in next.config.mjs. Keep it that way: this
   * value is inlined into the client bundle at BUILD time, so an absolute
   * `http://localhost:8000` means anyone loading the app from another machine
   * calls *their own* laptop. Point `API_ORIGIN` at the backend instead.
   */
  // `||`, not `??`: an env file with a blank `NEXT_PUBLIC_API_URL=` yields ""
  // rather than undefined, and "" would silently strip the /api/v1 prefix off
  // every request path.
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "/api/v1",
  /**
   * Base for stored item images. Empty by default so URLs stay same-origin and
   * resolve through the `/media/*` rewrite in next.config.mjs — that's what
   * lets next/image optimise them from inside Docker.
   */
  mediaUrl: process.env.NEXT_PUBLIC_MEDIA_URL ?? "",
  useMocks: (process.env.NEXT_PUBLIC_USE_MOCKS ?? "false") === "true",
} as const;
