/**
 * In-memory implementation of the full Api contract. Mirrors backend
 * semantics: closed items hidden from default browse, withdraw = soft close,
 * pagination envelope, no-enumeration auth flows.
 */
import { useAuthStore } from "@/store/auth.store";
import { ApiError, type Paginated } from "@/types/api";
import type { AuthResponse, User } from "@/types/auth";
import type { Item } from "@/types/item";
import type { AppNotification } from "@/types/notification";

import type { Api } from "@/services/contracts";
import {
  delay,
  findCategory,
  MOCK_CATEGORIES,
  MOCK_ITEMS,
  MOCK_MATCHES,
  MOCK_NOTIFICATIONS,
  MOCK_USER,
} from "./data";

const notFound = (what: string) =>
  new ApiError({ message: `${what} not found`, code: "NOT_FOUND", status: 404 });

function paginate<T>(rows: T[], page = 1, pageSize = 20): Paginated<T> {
  const start = (page - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    total: rows.length,
    page,
    page_size: pageSize,
    total_pages: Math.max(1, Math.ceil(rows.length / pageSize)),
  };
}

function mintSession(user: User): AuthResponse {
  return {
    access_token: `mock-access-${Date.now()}`,
    refresh_token: `mock-refresh-${Date.now()}`,
    user,
  };
}

/** Session snapshot persisted by the auth store stands in for the server. */
function currentUser(): User {
  return useAuthStore.getState().user ?? MOCK_USER;
}

let items: Item[] = [...MOCK_ITEMS];
let notifications: AppNotification[] = [...MOCK_NOTIFICATIONS];

export const mockApi: Api = {
  auth: {
    async register(payload) {
      await delay();
      return mintSession({
        ...MOCK_USER,
        id: crypto.randomUUID(),
        email: payload.email,
        full_name: payload.full_name,
        phone: payload.phone ?? null,
        is_verified: false,
        created_at: new Date().toISOString(),
      });
    },
    async login(payload) {
      await delay();
      return mintSession({
        ...MOCK_USER,
        email: payload.email,
        full_name: payload.email.split("@")[0] || "Demo User",
      });
    },
    async logout() {
      await delay(100);
    },
    async me() {
      await delay(120);
      return currentUser();
    },
    async updateMe(patch) {
      await delay();
      return { ...currentUser(), ...patch };
    },
    async forgotPassword() {
      await delay(); // always succeeds — no user enumeration
    },
    async resetPassword() {
      await delay();
    },
    async verifyEmail() {
      await delay();
    },
  },

  items: {
    async list(query) {
      await delay();
      let rows = [...items];
      if (query.type) rows = rows.filter((i) => i.type === query.type);
      if (query.category_id) rows = rows.filter((i) => i.category_id === query.category_id);
      if (query.user_id) rows = rows.filter((i) => i.user_id === query.user_id);
      if (query.wilaya) {
        const wilaya = query.wilaya.toLowerCase();
        rows = rows.filter((i) => (i.location_text ?? "").toLowerCase().includes(wilaya));
      }
      rows = rows.filter((i) => i.status !== "closed");
      if (query.q) {
        const q = query.q.toLowerCase();
        rows = rows.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            i.description.toLowerCase().includes(q),
        );
      }
      if (query.date_from)
        rows = rows.filter((i) => i.lost_or_found_at.slice(0, 10) >= query.date_from!);
      if (query.date_to)
        rows = rows.filter((i) => i.lost_or_found_at.slice(0, 10) <= query.date_to!);
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return paginate(rows, query.page, query.page_size);
    },
    async get(id) {
      await delay(180);
      const found = items.find((i) => i.id === id);
      if (!found) throw notFound("Item");
      return found;
    },
    async create(payload) {
      await delay();
      const now = new Date().toISOString();
      const created: Item = {
        id: crypto.randomUUID(),
        user_id: currentUser().id,
        type: payload.type,
        status: "open",
        processing_status: "pending",
        title: payload.title,
        description: payload.description,
        category_id: payload.category_id ?? null,
        category: findCategory(payload.category_id),
        color: payload.color ?? null,
        brand: payload.brand ?? null,
        location_text: payload.location_text ?? null,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        lost_or_found_at: payload.lost_or_found_at,
        closed_reason: null,
        closed_at: null,
        images: [],
        created_at: now,
        updated_at: now,
      };
      items = [created, ...items];
      return created;
    },
    async update(id, payload) {
      await delay();
      const target = items.find((i) => i.id === id);
      if (!target) throw notFound("Item");
      Object.assign(target, payload, {
        category: findCategory(payload.category_id ?? target.category_id),
        updated_at: new Date().toISOString(),
      });
      return target;
    },
    async withdraw(id) {
      await delay();
      const target = items.find((i) => i.id === id);
      if (!target) throw notFound("Item");
      const now = new Date().toISOString();
      Object.assign(target, {
        status: "closed",
        closed_reason: "withdrawn",
        closed_at: now,
        updated_at: now,
      });
    },
    async resolve(id) {
      await delay();
      const target = items.find((i) => i.id === id);
      if (!target) throw notFound("Item");
      const now = new Date().toISOString();
      Object.assign(target, {
        status: "closed",
        closed_reason: "recovered",
        closed_at: now,
        updated_at: now,
      });
      return target;
    },
  },

  categories: {
    async tree() {
      await delay(120);
      return MOCK_CATEGORIES;
    },
  },

  notifications: {
    async list(query = {}) {
      await delay();
      let rows = [...notifications];
      if (query.unread_only) rows = rows.filter((n) => !n.is_read);
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return paginate(rows, query.page, query.page_size);
    },
    async unreadCount() {
      await delay(80);
      return { count: notifications.filter((n) => !n.is_read).length };
    },
    async markRead(id) {
      await delay(80);
      notifications = notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n,
      );
    },
    async markAllRead() {
      await delay(120);
      notifications = notifications.map((n) => ({ ...n, is_read: true }));
    },
  },

  matches: {
    async forItem(itemId) {
      await delay(400);
      return (
        MOCK_MATCHES[itemId] ?? {
          item: { id: itemId, type: "lost", title: "" },
          matches: [],
        }
      );
    },
    async get(id) {
      await delay();
      const suggestion = Object.values(MOCK_MATCHES)
        .flatMap((s) => s.matches)
        .find((m) => m.match_id === id);
      if (!suggestion) throw notFound("Match");
      return suggestion;
    },
    async confirm() {
      await delay();
    },
    async reject() {
      await delay();
    },
    async feedback() {
      await delay();
    },
  },
};
