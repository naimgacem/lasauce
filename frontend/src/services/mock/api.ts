/**
 * In-memory implementation of the full Api contract. Mirrors backend
 * semantics: closed items hidden from default browse, withdraw = soft close,
 * pagination envelope, no-enumeration auth flows.
 */
import { useAuthStore } from "@/store/auth.store";
import { ApiError, type Paginated } from "@/types/api";
import type { AuthResponse, User } from "@/types/auth";
import type { Claim } from "@/types/claim";
import type { Item, ItemImage } from "@/types/item";
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

function findMatch(id: string) {
  const suggestion = Object.values(MOCK_MATCHES)
    .flatMap((s) => s.matches)
    .find((m) => m.match_id === id);
  if (!suggestion) throw notFound("Match");
  return suggestion;
}

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
let claims: Claim[] = [];

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
      return { ...currentUser(), is_verified: true };
    },
  },

  items: {
    async list(query) {
      await delay();
      let rows = [...items];
      if (query.type) rows = rows.filter((i) => i.type === query.type);
      if (query.category_id) rows = rows.filter((i) => i.category_id === query.category_id);
      if (query.user_id) rows = rows.filter((i) => i.user_id === query.user_id);
      if (query.wilaya_code != null) {
        rows = rows.filter((i) => i.wilaya_code === query.wilaya_code);
      }
      if (query.status) {
        rows = rows.filter((i) => i.status === query.status);
      } else {
        rows = rows.filter((i) => i.status !== "closed");
      }
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
        wilaya_code: payload.wilaya_code ?? null,
        claim_questions: payload.claim_questions ?? [],
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

    async uploadImages(id, files) {
      await delay(600);
      const target = items.find((i) => i.id === id);
      if (!target) throw notFound("Item");
      // Object URLs stand in for stored keys so mock mode renders real previews.
      const created: ItemImage[] = files.map((file) => ({
        id: crypto.randomUUID(),
        item_id: id,
        image_path: URL.createObjectURL(file),
        created_at: new Date().toISOString(),
      }));
      target.images = [...target.images, ...created];
      return created;
    },

    async deleteImage(id, imageId) {
      await delay(200);
      const target = items.find((i) => i.id === id);
      if (!target) throw notFound("Item");
      target.images = target.images.filter((img) => img.id !== imageId);
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

  claims: {
    async submit(itemId, payload) {
      await delay();
      const item = items.find((i) => i.id === itemId);
      if (!item) throw notFound("Item");
      const me = currentUser();
      const claim: Claim = {
        id: crypto.randomUUID(),
        item_id: itemId,
        status: "pending",
        message: payload.message ?? null,
        answers: payload.answers,
        claimant: { id: me.id, full_name: me.full_name },
        created_at: new Date().toISOString(),
        resolved_at: null,
        contact: null,
      };
      claims = [claim, ...claims];
      return claim;
    },
    async forItem(itemId) {
      await delay(150);
      return claims.filter((c) => c.item_id === itemId);
    },
    async mine() {
      await delay(150);
      const me = currentUser();
      return claims.filter((c) => c.claimant.id === me.id);
    },
    async get(id) {
      await delay(120);
      const claim = claims.find((c) => c.id === id);
      if (!claim) throw notFound("Claim");
      return claim;
    },
    async approve(id) {
      await delay();
      const claim = claims.find((c) => c.id === id);
      if (!claim) throw notFound("Claim");
      const now = new Date().toISOString();
      // Mirrors the server: approving settles every other open claim, flips the
      // item to `claimed`, and releases contact details.
      claims = claims.map((c) =>
        c.item_id === claim.item_id && c.id !== id && c.status === "pending"
          ? { ...c, status: "rejected", resolved_at: now }
          : c,
      );
      Object.assign(claim, {
        status: "approved",
        resolved_at: now,
        contact: {
          full_name: "Demo Reporter",
          email: "reporter@lostfound.app",
          phone: "0555 12 34 56",
        },
      });
      const item = items.find((i) => i.id === claim.item_id);
      if (item) item.status = "claimed";
      return claim;
    },
    async reject(id) {
      await delay();
      const claim = claims.find((c) => c.id === id);
      if (!claim) throw notFound("Claim");
      Object.assign(claim, {
        status: "rejected",
        resolved_at: new Date().toISOString(),
      });
      return claim;
    },
    async withdraw(id) {
      await delay();
      const claim = claims.find((c) => c.id === id);
      if (!claim) throw notFound("Claim");
      Object.assign(claim, {
        status: "withdrawn",
        resolved_at: new Date().toISOString(),
      });
      return claim;
    },
  },

  matches: {
    async forItem(itemId) {
      await delay(400);
      return (
        MOCK_MATCHES[itemId] ?? {
          item: { id: itemId, type: "lost", title: "" },
          matches: [],
          //  `ready`, not `pending`: with no worker in mock mode an in-flight
          //  status would leave the panel spinning forever.
          processing_status: "ready",
        }
      );
    },
    async get(id) {
      await delay();
      return findMatch(id);
    },
    async confirm(id) {
      await delay();
      const match = findMatch(id);
      match.status = "confirmed";
      return match;
    },
    async reject(id) {
      await delay();
      const match = findMatch(id);
      match.status = "rejected";
      return match;
    },
    async feedback() {
      await delay();
    },
    async rematch() {
      await delay(400);
    },
  },
};
