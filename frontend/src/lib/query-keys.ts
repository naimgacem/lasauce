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

export const matchKeys = {
  all: ["matches"] as const,
  forItem: (itemId: string) => [...matchKeys.all, "item", itemId] as const,
  detail: (id: string) => [...matchKeys.all, "detail", id] as const,
};
