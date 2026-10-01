/**
 * Admin console contracts — mirror `backend/app/schemas/admin.py`.
 *
 * These are the only types in the app that carry another person's email next
 * to their activity. Nothing outside `features/admin` should import them.
 */
import type { UserRole, UserStatus } from "@/types/auth";
import type { Payment, PaymentStatus } from "@/types/billing";
import type { ClaimAnswer, ClaimStatus } from "@/types/claim";
import type { Item, ItemStatus, ItemType, ProcessingStatus } from "@/types/item";
import type { MatchReason, MatchStatus } from "@/types/match";

export interface AdminUserRef {
  id: string;
  full_name: string;
  email: string;
}

// --- Users -------------------------------------------------------------------

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
  item_count: number;
  /** Most recent sign-in or session refresh. */
  last_active_at: string | null;
}

export interface AdminUserStats {
  items_total: number;
  items_open: number;
  items_recovered: number;
  claims_submitted: number;
  credit_balance: number;
  free_unlocks_used: number;
  payments_paid: number;
  amount_paid: number;
  active_sessions: number;
}

export type LedgerReason = "purchase" | "unlock" | "grant" | "refund";

export interface CreditLedgerEntry {
  id: string;
  delta: number;
  reason: LedgerReason;
  note: string | null;
  payment_id: string | null;
  match_id: string | null;
  created_at: string;
}

export interface AdminUserDetail extends AdminUser {
  stats: AdminUserStats;
  ledger: CreditLedgerEntry[];
  payments: Payment[];
}

export interface AdminUserQuery {
  q?: string;
  role?: UserRole;
  status?: UserStatus;
  verified?: boolean;
  page?: number;
  page_size?: number;
}

/** Any combination; the backend writes one audit entry per actual change. */
export interface AdminUserPatch {
  role?: UserRole;
  status?: "active" | "suspended";
  is_verified?: true;
  reason?: string;
}

export interface CreditGrantPayload {
  amount: number;
  note: string;
}

// --- Items -------------------------------------------------------------------

export interface AdminItem extends Item {
  reporter: AdminUserRef;
  match_count: number;
  pending_claim_count: number;
}

export interface AdminClaim {
  id: string;
  status: ClaimStatus;
  message: string | null;
  answers: ClaimAnswer[];
  claimant: AdminUserRef;
  created_at: string;
  resolved_at: string | null;
}

export interface AdminMatchItem {
  id: string;
  type: ItemType;
  title: string;
  status: ItemStatus;
  user_id: string;
  primary_image_url: string | null;
  wilaya_code: number | null;
}

export interface AdminMatchFeedback {
  user_id: string;
  is_correct: boolean;
  comment: string | null;
  created_at: string;
}

/** Unredacted — moderators judge the raw features the owners never see. */
export interface AdminMatch {
  id: string;
  status: MatchStatus;
  confidence: number;
  text_score: number;
  image_score: number | null;
  combined_score: number;
  explanation: MatchReason[];
  lost_item: AdminMatchItem;
  found_item: AdminMatchItem;
  feedback: AdminMatchFeedback[];
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface AdminItemDetail extends AdminItem {
  matches: AdminMatch[];
  claims: AdminClaim[];
}

export interface AdminItemQuery {
  q?: string;
  type?: ItemType;
  status?: ItemStatus;
  processing_status?: ProcessingStatus;
  category_id?: string;
  wilaya_code?: number;
  user_id?: string;
  page?: number;
  page_size?: number;
}

/** What a moderator may state. `withdrawn`/`recovered` are the reporter's to say. */
export type ModerationCloseReason = "removed" | "duplicate" | "expired";

export interface ItemClosePayload {
  reason_code: ModerationCloseReason;
  /** Internal — recorded in the audit log, never shown to the reporter. */
  note: string;
}

export interface AdminMatchQuery {
  status?: MatchStatus;
  min_confidence?: number;
  max_confidence?: number;
  page?: number;
  page_size?: number;
}

// --- Payments ----------------------------------------------------------------

export interface AdminPayment extends Payment {
  user: AdminUserRef;
  provider_ref: string | null;
  updated_at: string;
}

export interface AdminPaymentDetail extends AdminPayment {
  provider_payload: Record<string, unknown>;
}

export interface AdminPaymentQuery {
  status?: PaymentStatus;
  provider?: string;
  user_id?: string;
  page?: number;
  page_size?: number;
}

// --- Audit log ------------------------------------------------------------------

export type AdminActionType =
  | "suspend_user"
  | "reactivate_user"
  | "change_role"
  | "verify_user"
  | "grant_credits"
  | "close_item"
  | "reopen_item"
  | "reprocess_item"
  | "delete_image"
  | "retract_match"
  | "retry_failed_items";

export type AdminTargetType = "user" | "item" | "match" | "system";

export interface AdminAction {
  id: string;
  action: AdminActionType;
  target_type: AdminTargetType;
  target_id: string | null;
  target_label: string | null;
  reason: string | null;
  details: Record<string, unknown>;
  /** Null when the acting account has since been removed; `admin_email` remains. */
  admin: AdminUserRef | null;
  admin_email: string;
  created_at: string;
}

export interface AdminActionQuery {
  action?: AdminActionType;
  target_type?: AdminTargetType;
  target_id?: string;
  admin_id?: string;
  page?: number;
  page_size?: number;
}

// --- Overview ---------------------------------------------------------------------

export interface DailyActivity {
  /** Calendar day in Africa/Algiers, `YYYY-MM-DD`. */
  date: string;
  lost: number;
  found: number;
  signups: number;
}

export interface AdminStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    admins: number;
    verified: number;
    new_7d: number;
    new_30d: number;
  };
  items: {
    total: number;
    open_lost: number;
    open_found: number;
    matched: number;
    claimed: number;
    closed: number;
    recovered: number;
    created_7d: number;
  };
  pipeline: {
    pending: number;
    embedding: number;
    matching: number;
    failed: number;
    /** Null = unknown (queue unreachable), which is not the same as zero. */
    queue_depth: number | null;
  };
  matches: {
    total: number;
    suggested: number;
    confirmed: number;
    rejected: number;
    expired: number;
    /** confirmed / (confirmed + rejected); null until anything is judged. */
    confirm_rate: number | null;
    avg_confidence_confirmed: number | null;
    avg_confidence_rejected: number | null;
  };
  claims: { pending: number; approved: number; rejected: number };
  revenue: {
    currency: string;
    total: number;
    last_30d: number;
    paid_count: number;
    pending_count: number;
  };
  activity: DailyActivity[];
  generated_at: string;
}
