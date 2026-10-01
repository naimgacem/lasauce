import type {
  AdminActionQuery,
  AdminItemQuery,
  AdminMatchQuery,
  AdminPaymentQuery,
  AdminUserQuery,
} from "@/types/admin";
import type { ItemQuery } from "@/types/item";

/** Query-key factories — the only place keys are spelled. */
export const authKeys = {
  all: ["auth"] as const,
  me: () => [...authKeys.all, "me"] as const,
};

export const categoryKeys = {
  all: ["categories"] as const,
  tree: () => [...categoryKeys.all, "tree"] as const,
};

export const itemKeys = {
  all: ["items"] as const,
  lists: () => [...itemKeys.all, "list"] as const,
  list: (query: ItemQuery) => [...itemKeys.lists(), query] as const,
  details: () => [...itemKeys.all, "detail"] as const,
  detail: (id: string) => [...itemKeys.details(), id] as const,
};

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (query: object) => [...notificationKeys.lists(), query] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

export const claimKeys = {
  all: ["claims"] as const,
  forItem: (itemId: string) => [...claimKeys.all, "item", itemId] as const,
  mine: () => [...claimKeys.all, "mine"] as const,
  detail: (id: string) => [...claimKeys.all, "detail", id] as const,
};

export const matchKeys = {
  all: ["matches"] as const,
  forItem: (itemId: string) => [...matchKeys.all, "item", itemId] as const,
  detail: (id: string) => [...matchKeys.all, "detail", id] as const,
};

export const billingKeys = {
  all: ["billing"] as const,
  packs: () => [...billingKeys.all, "packs"] as const,
  /**
   * Invalidated by every unlock and every settled payment. `matchKeys` is
   * invalidated alongside it — the balance and the cards it gates are one piece
   * of state to the user, and refreshing only half of it shows a card that
   * opened next to a chip that still says zero.
   */
  entitlements: () => [...billingKeys.all, "entitlements"] as const,
  payments: () => [...billingKeys.all, "payments"] as const,
  payment: (id: string) => [...billingKeys.all, "payment", id] as const,
};

/**
 * One root for the whole console, so a moderation action can refresh every
 * admin view it might have changed in a single invalidation. The cost is a few
 * extra refetches; the alternative is a stat tile disagreeing with the table
 * beneath it.
 */
export const adminKeys = {
  all: ["admin"] as const,
  stats: () => [...adminKeys.all, "stats"] as const,
  users: (query: AdminUserQuery) => [...adminKeys.all, "users", query] as const,
  user: (id: string) => [...adminKeys.all, "user", id] as const,
  items: (query: AdminItemQuery) => [...adminKeys.all, "items", query] as const,
  item: (id: string) => [...adminKeys.all, "item", id] as const,
  matches: (query: AdminMatchQuery) => [...adminKeys.all, "matches", query] as const,
  payments: (query: AdminPaymentQuery) => [...adminKeys.all, "payments", query] as const,
  payment: (id: string) => [...adminKeys.all, "payment", id] as const,
  actions: (query: AdminActionQuery) => [...adminKeys.all, "actions", query] as const,
};
