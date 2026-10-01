/**
 * In-memory admin console, built from the same mock items the rest of the demo
 * shows. Mutations change this module's state and append to its audit log, so
 * the console behaves like the real one: suspend someone and the users table,
 * the overview and the activity log all agree.
 */
import { useAuthStore } from "@/store/auth.store";
import { ApiError, type Paginated } from "@/types/api";
import type {
  AdminAction,
  AdminActionType,
  AdminItem,
  AdminItemDetail,
  AdminMatch,
  AdminMatchItem,
  AdminPaymentDetail,
  AdminTargetType,
  AdminUser,
  AdminUserDetail,
} from "@/types/admin";
import type { Item } from "@/types/item";

import type { AdminApi } from "@/services/contracts";
import { daysAgo, delay, MOCK_ITEMS, MOCK_USER } from "./data";

const notFound = (what: string) =>
  new ApiError({ message: `${what} not found`, code: "NOT_FOUND", status: 404 });
const conflict = (message: string) => new ApiError({ message, code: "CONFLICT", status: 409 });

function person(id: string, name: string, email: string, days: number, extra: Partial<AdminUser> = {}): AdminUser {
  return {
    id,
    email,
    full_name: name,
    phone: null,
    role: "user",
    status: "active",
    avatar_url: null,
    is_verified: true,
    created_at: daysAgo(days),
    item_count: 0,
    last_active_at: daysAgo(Math.max(0, days - 3)),
    ...extra,
  };
}

const users: AdminUser[] = [
  person(MOCK_USER.id, MOCK_USER.full_name, MOCK_USER.email, 120),
  person("u-amina", "Amina Bouzid", "amina@example.dz", 64),
  person("u-karim", "Karim Haddad", "karim@example.dz", 41, { is_verified: false }),
  person("u-lina", "Lina Merabet", "lina@example.dz", 12),
  person("u-yacine", "Yacine Rahmani", "yacine@example.dz", 5, { status: "suspended" }),
  person("u-admin", "Console Admin", "admin@example.dz", 200, { role: "admin" }),
];

/** Mock items all belong to the demo user; spread them out so the table reads true. */
let items: Item[] = MOCK_ITEMS.map((item, i) => ({ ...item, user_id: users[i % 4].id }));

const side = (item: Item): AdminMatchItem => ({
  id: item.id,
  type: item.type,
  title: item.title,
  status: item.status,
  user_id: item.user_id,
  primary_image_url: item.images[0]?.image_path ?? null,
  wilaya_code: item.wilaya_code,
});

let matches: AdminMatch[] = (() => {
  const lost = items.filter((i) => i.type === "lost");
  const found = items.filter((i) => i.type === "found");
  const confidences = [0.91, 0.78, 0.66, 0.58];
  const statuses = ["suggested", "confirmed", "rejected", "suggested"] as const;
  return lost.flatMap((l, li) =>
    found.slice(0, 2).map((f, fi) => {
      const k = (li * 2 + fi) % confidences.length;
      return {
        id: `m-${l.id}-${f.id}`,
        status: statuses[k],
        confidence: confidences[k],
        text_score: confidences[k] - 0.04,
        image_score: fi === 0 ? confidences[k] + 0.03 : null,
        combined_score: confidences[k] - 0.02,
        explanation: [{ code: "text_strong" }, { code: "time_close", params: { days: 1 } }],
        lost_item: side(l),
        found_item: side(f),
        feedback: [],
        created_at: daysAgo(k + 1),
        updated_at: daysAgo(k),
        resolved_at: statuses[k] === "suggested" ? null : daysAgo(k),
      } satisfies AdminMatch;
    }),
  );
})();

const payments: AdminPaymentDetail[] = [
  {
    id: "p-1",
    pack_id: "trio",
    credits: 3,
    amount: 500,
    currency: "dzd",
    status: "paid",
    provider: "manual",
    provider_ref: "manual_7f3a",
    checkout_url: null,
    failure_reason: null,
    created_at: daysAgo(6),
    paid_at: daysAgo(6),
    updated_at: daysAgo(6),
    user: { id: "u-amina", full_name: "Amina Bouzid", email: "amina@example.dz" },
    provider_payload: { simulated: true },
  },
  {
    id: "p-2",
    pack_id: "single",
    credits: 1,
    amount: 200,
    currency: "dzd",
    status: "failed",
    provider: "chargily",
    provider_ref: "01j9xk2",
    checkout_url: null,
    failure_reason: "Card declined",
    created_at: daysAgo(3),
    paid_at: null,
    updated_at: daysAgo(3),
    user: { id: "u-karim", full_name: "Karim Haddad", email: "karim@example.dz" },
    provider_payload: { type: "checkout.failed" },
  },
];

let actions: AdminAction[] = [];
const ledgers: Record<string, AdminUserDetail["ledger"]> = {};

function actor() {
  const me = useAuthStore.getState().user ?? users[users.length - 1];
  return { id: me.id, full_name: me.full_name, email: me.email };
}

function record(
  action: AdminActionType,
  target_type: AdminTargetType,
  target_id: string | null,
  target_label: string | null,
  reason: string | null | undefined,
  details: Record<string, unknown> = {},
) {
  const admin = actor();
  actions = [
    {
      id: crypto.randomUUID(),
      action,
      target_type,
      target_id,
      target_label,
      reason: reason?.trim() || null,
      details,
      admin,
      admin_email: admin.email,
      created_at: new Date().toISOString(),
    },
    ...actions,
  ];
}

function page<T>(rows: T[], p = 1, size = 20): Paginated<T> {
  const start = (p - 1) * size;
  return {
    items: rows.slice(start, start + size),
    total: rows.length,
    page: p,
    page_size: size,
    total_pages: Math.ceil(rows.length / size),
  };
}

function reporter(userId: string) {
  const u = users.find((x) => x.id === userId) ?? users[0];
  return { id: u.id, full_name: u.full_name, email: u.email };
}

const isLive = (m: AdminMatch) => m.status !== "rejected" && m.status !== "expired";
const involves = (m: AdminMatch, id: string) => m.lost_item.id === id || m.found_item.id === id;

function toAdminItem(item: Item): AdminItem {
  return {
    ...item,
    reporter: reporter(item.user_id),
    match_count: matches.filter((m) => involves(m, item.id) && isLive(m)).length,
    pending_claim_count: 0,
  };
}

function itemDetail(id: string): AdminItemDetail {
  const item = items.find((i) => i.id === id);
  if (!item) throw notFound("Item");
  return { ...toAdminItem(item), matches: matches.filter((m) => involves(m, id)), claims: [] };
}

function userDetail(id: string): AdminUserDetail {
  const u = users.find((x) => x.id === id);
  if (!u) throw notFound("User");
  const own = items.filter((i) => i.user_id === id);
  const ledger = ledgers[id] ?? [];
  const paid = payments.filter((p) => p.user.id === id && p.status === "paid");
  return {
    ...u,
    item_count: own.length,
    stats: {
      items_total: own.length,
      items_open: own.filter((i) => i.status !== "closed").length,
      items_recovered: own.filter((i) => i.closed_reason === "recovered").length,
      claims_submitted: 0,
      credit_balance: ledger.reduce((sum, e) => sum + e.delta, 0),
      free_unlocks_used: 0,
      payments_paid: paid.length,
      amount_paid: paid.reduce((sum, p) => sum + p.amount, 0),
      active_sessions: u.status === "active" ? 1 : 0,
    },
    ledger,
    payments: payments.filter((p) => p.user.id === id),
  };
}

function patchItem(id: string, patch: Partial<Item>) {
  items = items.map((i) => (i.id === id ? { ...i, ...patch, updated_at: new Date().toISOString() } : i));
}

export const mockAdminApi: AdminApi = {
  async stats() {
    await delay();
    const count = (pred: (i: Item) => boolean) => items.filter(pred).length;
    const judged = matches.filter((m) => m.status === "confirmed" || m.status === "rejected");
    const confirmed = matches.filter((m) => m.status === "confirmed");
    const avg = (rows: AdminMatch[]) =>
      rows.length ? rows.reduce((s, m) => s + m.confidence, 0) / rows.length : null;
    const paid = payments.filter((p) => p.status === "paid");
    return {
      users: {
        total: users.length,
        active: users.filter((u) => u.status === "active").length,
        suspended: users.filter((u) => u.status === "suspended").length,
        admins: users.filter((u) => u.role === "admin").length,
        verified: users.filter((u) => u.is_verified).length,
        new_7d: 1,
        new_30d: 2,
      },
      items: {
        total: items.length,
        open_lost: count((i) => i.status === "open" && i.type === "lost"),
        open_found: count((i) => i.status === "open" && i.type === "found"),
        matched: count((i) => i.status === "matched"),
        claimed: count((i) => i.status === "claimed"),
        closed: count((i) => i.status === "closed"),
        recovered: count((i) => i.closed_reason === "recovered"),
        created_7d: count((i) => Date.now() - Date.parse(i.created_at) < 7 * 86_400_000),
      },
      pipeline: {
        pending: count((i) => i.processing_status === "pending"),
        embedding: count((i) => i.processing_status === "embedding"),
        matching: count((i) => i.processing_status === "matching"),
        failed: count((i) => i.processing_status === "failed" && i.status !== "closed"),
        queue_depth: 0,
      },
      matches: {
        total: matches.length,
        suggested: matches.filter((m) => m.status === "suggested").length,
        confirmed: confirmed.length,
        rejected: judged.length - confirmed.length,
        expired: matches.filter((m) => m.status === "expired").length,
        confirm_rate: judged.length ? confirmed.length / judged.length : null,
        avg_confidence_confirmed: avg(confirmed),
        avg_confidence_rejected: avg(judged.filter((m) => m.status === "rejected")),
      },
      claims: { pending: 1, approved: 2, rejected: 0 },
      revenue: {
        currency: "dzd",
        total: paid.reduce((s, p) => s + p.amount, 0),
        last_30d: paid.reduce((s, p) => s + p.amount, 0),
        paid_count: paid.length,
        pending_count: payments.filter((p) => p.status === "pending").length,
      },
      //  A deterministic wave rather than randomness: the chart must look the
      //  same on every reload of the demo.
      activity: Array.from({ length: 30 }, (_, i) => {
        const day = new Date(Date.now() - (29 - i) * 86_400_000);
        return {
          date: day.toISOString().slice(0, 10),
          lost: (i * 7) % 5,
          found: (i * 3 + 2) % 4,
          signups: i % 6 === 0 ? 1 : 0,
        };
      }),
      generated_at: new Date().toISOString(),
    };
  },

  async retryFailed() {
    await delay();
    const failed = items.filter((i) => i.processing_status === "failed" && i.status !== "closed");
    failed.forEach((i) => patchItem(i.id, { processing_status: "pending" }));
    if (failed.length) {
      record("retry_failed_items", "system", null, null, null, { count: failed.length });
    }
    return { requeued: failed.length };
  },

  async users(query) {
    await delay();
    const q = query.q?.trim().toLowerCase();
    const rows = users
      .map((u) => ({ ...u, item_count: items.filter((i) => i.user_id === u.id).length }))
      .filter((u) => !q || u.id === q || u.full_name.toLowerCase().includes(q) || u.email.includes(q))
      .filter((u) => !query.role || u.role === query.role)
      .filter((u) => !query.status || u.status === query.status)
      .filter((u) => query.verified === undefined || u.is_verified === query.verified);
    return page(rows, query.page, query.page_size);
  },

  async user(id) {
    await delay();
    return userDetail(id);
  },

  async updateUser(id, patch) {
    await delay();
    const target = users.find((u) => u.id === id);
    if (!target) throw notFound("User");
    const label = `${target.full_name} <${target.email}>`;
    if (patch.status && patch.status !== target.status) {
      record(
        patch.status === "suspended" ? "suspend_user" : "reactivate_user",
        "user",
        id,
        label,
        patch.reason,
        { status: { from: target.status, to: patch.status } },
      );
      target.status = patch.status;
    }
    if (patch.role && patch.role !== target.role) {
      record("change_role", "user", id, label, patch.reason, {
        role: { from: target.role, to: patch.role },
      });
      target.role = patch.role;
    }
    if (patch.is_verified && !target.is_verified) {
      record("verify_user", "user", id, label, patch.reason);
      target.is_verified = true;
    }
    return userDetail(id);
  },

  async grantCredits(id, payload) {
    await delay();
    const target = users.find((u) => u.id === id);
    if (!target) throw notFound("User");
    ledgers[id] = [
      {
        id: crypto.randomUUID(),
        delta: payload.amount,
        reason: "grant",
        note: payload.note,
        payment_id: null,
        match_id: null,
        created_at: new Date().toISOString(),
      },
      ...(ledgers[id] ?? []),
    ];
    record("grant_credits", "user", id, `${target.full_name} <${target.email}>`, payload.note, {
      amount: payload.amount,
    });
    return userDetail(id);
  },

  async items(query) {
    await delay();
    const q = query.q?.trim().toLowerCase();
    const rows = items
      .filter((i) => !q || i.id === q || i.title.toLowerCase().includes(q))
      .filter((i) => !query.type || i.type === query.type)
      .filter((i) => !query.status || i.status === query.status)
      .filter((i) => !query.processing_status || i.processing_status === query.processing_status)
      .filter((i) => !query.user_id || i.user_id === query.user_id)
      .map(toAdminItem);
    return page(rows, query.page, query.page_size);
  },

  async item(id) {
    await delay();
    return itemDetail(id);
  },

  async closeItem(id, payload) {
    await delay();
    const item = items.find((i) => i.id === id);
    if (!item) throw notFound("Item");
    if (item.status === "closed") throw conflict("This report is already closed");
    patchItem(id, {
      status: "closed",
      closed_reason: payload.reason_code,
      closed_at: new Date().toISOString(),
    });
    matches = matches.map((m) =>
      involves(m, id) && m.status === "suggested" ? { ...m, status: "expired" } : m,
    );
    record("close_item", "item", id, item.title, payload.note, {
      closed_reason: payload.reason_code,
    });
    return itemDetail(id);
  },

  async reopenItem(id, note) {
    await delay();
    const item = items.find((i) => i.id === id);
    if (!item) throw notFound("Item");
    if (item.status !== "closed") throw conflict("Only closed reports can be reopened");
    if (item.closed_reason === "withdrawn" || item.closed_reason === "recovered") {
      throw conflict("This report was closed by its reporter. Only they can change that.");
    }
    patchItem(id, { status: "open", closed_reason: null, closed_at: null });
    record("reopen_item", "item", id, item.title, note);
    return itemDetail(id);
  },

  async reprocessItem(id) {
    await delay();
    const item = items.find((i) => i.id === id);
    if (!item) throw notFound("Item");
    patchItem(id, { processing_status: "pending" });
    record("reprocess_item", "item", id, item.title, null, {
      processing_status: { from: item.processing_status, to: "pending" },
    });
    return itemDetail(id);
  },

  async deleteImage(itemId, imageId, reason) {
    await delay();
    const item = items.find((i) => i.id === itemId);
    if (!item) throw notFound("Item");
    patchItem(itemId, { images: item.images.filter((img) => img.id !== imageId) });
    record("delete_image", "item", itemId, item.title, reason, { image_id: imageId });
    return itemDetail(itemId);
  },

  async matches(query) {
    await delay();
    const rows = matches
      .filter((m) => !query.status || m.status === query.status)
      .filter((m) => query.min_confidence === undefined || m.confidence >= query.min_confidence)
      .filter((m) => query.max_confidence === undefined || m.confidence <= query.max_confidence);
    return page(rows, query.page, query.page_size);
  },

  async retractMatch(id, note) {
    await delay();
    const match = matches.find((m) => m.id === id);
    if (!match) throw notFound("Match");
    if (match.status !== "suggested" && match.status !== "pending") {
      throw conflict(`This match is already ${match.status}`);
    }
    const next: AdminMatch = { ...match, status: "expired", updated_at: new Date().toISOString() };
    matches = matches.map((m) => (m.id === id ? next : m));
    record("retract_match", "match", id, `${match.lost_item.title} ↔ ${match.found_item.title}`, note);
    return next;
  },

  async payments(query) {
    await delay();
    const rows = payments
      .filter((p) => !query.status || p.status === query.status)
      .filter((p) => !query.provider || p.provider === query.provider)
      .filter((p) => !query.user_id || p.user.id === query.user_id);
    return page(rows, query.page, query.page_size);
  },

  async payment(id) {
    await delay();
    const payment = payments.find((p) => p.id === id);
    if (!payment) throw notFound("Payment");
    return payment;
  },

  async actions(query) {
    await delay();
    const rows = actions
      .filter((a) => !query.action || a.action === query.action)
      .filter((a) => !query.target_type || a.target_type === query.target_type)
      .filter((a) => !query.target_id || a.target_id === query.target_id);
    return page(rows, query.page, query.page_size);
  },
};
