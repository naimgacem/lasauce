/**
 * Feature flags for future milestones. Surfaces behind a disabled flag exist
 * in the codebase (types, clients, routes) but render nothing.
 */
export const flags = {
  matches: (process.env.NEXT_PUBLIC_FEATURE_MATCHES ?? "false") === "true",
  admin: (process.env.NEXT_PUBLIC_FEATURE_ADMIN ?? "false") === "true",
} as const;
