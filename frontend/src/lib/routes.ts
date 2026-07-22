/**
 * Single source of truth for paths. Nav menus, guards and redirects derive
 * from here — a page can't silently fall out of sync with its protection.
 */
export const ROUTES = {
  // public
  home: "/",
  lost: "/lost",
  found: "/found",
  search: "/search",
  item: (id: string) => `/items/${id}`,

  // guest-only
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",

  // authenticated
  dashboard: "/dashboard",
  myItems: "/my-items",
  report: "/report",
  reportLost: "/report/lost",   // redirects → /report?type=lost
  reportFound: "/report/found", // redirects → /report?type=found
  notifications: "/notifications",
  profile: "/profile",

  // future (feature-flagged)
  matches: (itemId: string) => `/matches/${itemId}`,
  admin: "/admin",
} as const;

/** Where to send an authenticated user by default. */
export const DEFAULT_AUTHED_ROUTE = ROUTES.dashboard;

/** Build the login redirect preserving the intended destination. */
export function loginWithNext(next: string): string {
  return `${ROUTES.login}?next=${encodeURIComponent(next)}`;
}
