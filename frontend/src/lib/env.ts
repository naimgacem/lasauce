/** Typed public runtime config — nothing else reads `process.env` directly. */
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1",
  useMocks: (process.env.NEXT_PUBLIC_USE_MOCKS ?? "true") === "true",
} as const;
