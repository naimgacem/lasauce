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
  // Reached from an emailed link, so these must work whether or not the visitor
  // happens to be signed in — they live OUTSIDE the guest-guarded (auth) group.
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",

  // authenticated
  dashboard: "/dashboard",
  myItems: "/my-items",
  report: "/report",
  reportLost: "/report/lost",   // redirects → /report?type=lost
  reportFound: "/report/found", // redirects → /report?type=found
  notifications: "/notifications",
  profile: "/profile",
  /** Pricing + purchase history. */
  billing: "/billing",
  /**
   * Where the payment gateway returns the customer. Authenticated: the page
   * reads the payment's real status from the API, and that read needs a session
   * — the URL alone is not evidence anyone paid.
   */
  billingReturn: "/billing/return",

  // future (feature-flagged)
  matches: (itemId: string) => `/matches/${itemId}`,

  // administrators only — guarded by <AdminGuard>, enforced by the API
  admin: "/admin",
  adminUsers: "/admin/users",
  adminUser: (id: string) => `/admin/users/${id}`,
  adminItems: "/admin/items",
  adminItem: (id: string) => `/admin/items/${id}`,
  adminMatches: "/admin/matches",
  adminPayments: "/admin/payments",
  adminActivity: "/admin/activity",
} as const;

/** Where to send an authenticated user by default. */
export const DEFAULT_AUTHED_ROUTE = ROUTES.dashboard;

/** Build the login redirect preserving the intended destination. */
export function loginWithNext(next: string): string {
  return `${ROUTES.login}?next=${encodeURIComponent(next)}`;
}
