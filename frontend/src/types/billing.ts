/** Paid matching: credit packs, entitlements, payments. */

/**
 * One purchasable bundle of match unlocks.
 *
 * No `name` field, by design. Packs are identified by `id` and labelled through
 * `billing.packs.<id>` in the message catalogue — the same reason match
 * explanations travel as codes rather than sentences: the audience reads
 * Arabic, French and English, and a name chosen on the server reaches two
 * thirds of it in the wrong language.
 */
export interface CreditPack {
  id: string;
  credits: number;
  /** Whole DZD. Chargily settles in the main unit, so this is never scaled. */
  amount: number;
  currency: string;
  /** Price per unlock — what makes a bundle legible as a saving. */
  unit_amount: number;
  /** Discount against buying singles, whole percent. 0 for the base pack. */
  savings_percent: number;
  /** Drawn as the default choice. At most one pack carries it. */
  highlighted: boolean;
}

/** What the viewer may currently do. Rides along with match responses. */
export interface Entitlements {
  balance: number;
  /** Remaining slice of the free allowance. Drives "your first one is free". */
  free_unlocks_remaining: number;
  unlock_cost: number;
  /**
   * False when the paywall is off entirely, or the viewer is an admin. The UI
   * checks this once rather than reasoning about tiers per card.
   */
  paywall_enabled: boolean;
}

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "canceled"
  | "expired";

export interface Payment {
  id: string;
  pack_id: string;
  credits: number;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  checkout_url: string | null;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
}

/** Where to send the buyer next. */
export interface Checkout {
  payment_id: string;
  checkout_url: string;
  amount: number;
  currency: string;
  credits: number;
  /** `chargily` in production, `manual` in dev — the return page branches on it. */
  provider: string;
}

/** Which pocket paid for an unlock. */
export type UnlockSource = "credit" | "free_allowance" | "grant";

export interface UnlockResult {
  match_id: string;
  source: UnlockSource;
  /**
   * The balance *after* the spend. Sent back with the unlock so the header chip
   * and the revealed card update in the same paint — a follow-up GET would show
   * the stale number for a frame.
   */
  entitlements: Entitlements;
}
