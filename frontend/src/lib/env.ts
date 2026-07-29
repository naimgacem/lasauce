/** Typed public runtime config — nothing else reads `process.env` directly. */
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  /**
   * Base for stored item images. Empty by default so URLs stay same-origin and
   * resolve through the `/media/*` rewrite in next.config.mjs — that's what
   * lets next/image optimise them from inside Docker.
   */
  mediaUrl: process.env.NEXT_PUBLIC_MEDIA_URL ?? "",
  useMocks: (process.env.NEXT_PUBLIC_USE_MOCKS ?? "false") === "true",
} as const;
