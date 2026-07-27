import { addDoc, collection, getDocs, orderBy, query, where } from "firebase/firestore";

import { firebaseDb } from "@/lib/firebase";
import { ApiError, type Paginated } from "@/types/api";
import type { AuthResponse, User } from "@/types/auth";
import type { Item, CreateItemPayload } from "@/types/item";
import type { Api } from "@/services/contracts";

const ITEMS_COLLECTION = "items";

function notFound(what: string) {
  return new ApiError({ message: `${what} not found`, code: "NOT_FOUND", status: 404 });
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

function toItem(doc: any): Item {
  const data = doc.data();
  return {
    id: doc.id,
    user_id: data.user_id,
    type: data.type,
    status: data.status,
    processing_status: data.processing_status,
    title: data.title,
    description: data.description,
    category_id: data.category_id ?? null,
    category: null,
    color: data.color ?? null,
    brand: data.brand ?? null,
    location_text: data.location_text ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    lost_or_found_at: data.lost_or_found_at,
    closed_reason: data.closed_reason ?? null,
    closed_at: data.closed_at ?? null,
    images: data.images ?? [],
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export const firebaseApi: Api = {
  auth: {
    async register() {
      return {
        access_token: "firebase",
        refresh_token: "firebase",
        user: {} as User,
      };
    },
    async login() {
      return {
        access_token: "firebase",
        refresh_token: "firebase",
        user: {} as User,
      };
    },
    async logout() {},
    async me() {
      return {} as User;
    },
    async updateMe(patch) {
      return patch as User;
    },
    async forgotPassword() {},
    async resetPassword() {},
    async verifyEmail() {},
  },
  items: {
    async list(query) {
      const constraints: any[] = [];
      if (query.type) constraints.push(where("type", "==", query.type));
      if (query.category_id) constraints.push(where("category_id", "==", query.category_id));
      if (query.user_id) constraints.push(where("user_id", "==", query.user_id));
      if (query.q) constraints.push(where("title", ">=", query.q));
      constraints.push(orderBy("created_at", "desc"));
      const q = query(collection(firebaseDb, ITEMS_COLLECTION), ...constraints);
      const snapshot = await getDocs(q);
      const rows = snapshot.docs.map(toItem);
      return paginate(rows, query.page, query.page_size);
    },
    async get(id) {
      const snapshot = await getDocs(query(collection(firebaseDb, ITEMS_COLLECTION), where("id", "==", id)));
      if (snapshot.empty) throw notFound("Item");
      return toItem(snapshot.docs[0]);
    },
    async create(payload: CreateItemPayload) {
      const now = new Date().toISOString();
      const ref = await addDoc(collection(firebaseDb, ITEMS_COLLECTION), {
        ...payload,
        status: "open",
        processing_status: "pending",
        category_id: payload.category_id ?? null,
        color: payload.color ?? null,
        brand: payload.brand ?? null,
        location_text: payload.location_text ?? null,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        images: [],
        created_at: now,
        updated_at: now,
      });
      return {
        id: ref.id,
        user_id: "firebase-user",
        type: payload.type,
        status: "open",
        processing_status: "pending",
        title: payload.title,
        description: payload.description,
        category_id: payload.category_id ?? null,
        category: null,
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
    },
    async update() {
      throw new Error("Not implemented yet");
    },
    async withdraw() {
      throw new Error("Not implemented yet");
    },
    async resolve() {
      throw new Error("Not implemented yet");
    },
  },
  categories: {
    async tree() {
      return [];
    },
  },
  notifications: {
    async list() {
      return { items: [], total: 0, page: 1, page_size: 20, total_pages: 1 };
    },
    async unreadCount() {
      return { count: 0 };
    },
    async markRead() {},
    async markAllRead() {},
  },
  matches: {
    async forItem() {
      return { item: { id: "", type: "lost", title: "" }, matches: [] };
    },
    async get() {
      throw new Error("Not implemented yet");
    },
    async confirm() {},
    async reject() {},
    async feedback() {},
  },
};
