/**
 * Domain API contracts. Real clients (HTTP) and mock adapters (in-memory)
 * implement the SAME interfaces — `services/index.ts` picks one per env, and
 * nothing above this layer ever knows which.
 */
import type {
  AdminAction,
  AdminActionQuery,
  AdminItem,
  AdminItemDetail,
  AdminItemQuery,
  AdminMatch,
  AdminMatchQuery,
  AdminPayment,
  AdminPaymentDetail,
  AdminPaymentQuery,
  AdminStats,
  AdminUser,
  AdminUserDetail,
  AdminUserPatch,
  AdminUserQuery,
  CreditGrantPayload,
  ItemClosePayload,
} from "@/types/admin";
import type { Paginated } from "@/types/api";
import type {
  AuthResponse,
  LoginPayload,
  ProfilePatch,
  RegisterPayload,
  User,
} from "@/types/auth";
import type {
  Checkout,
  CreditPack,
  Entitlements,
  Payment,
  UnlockResult,
} from "@/types/billing";
import type { Category } from "@/types/category";
import type { Claim, CreateClaimPayload } from "@/types/claim";
import type {
  CreateItemPayload,
  Item,
  ItemImage,
  ItemQuery,
  UpdateItemPayload,
} from "@/types/item";
import type {
  MatchFeedbackPayload,
  MatchSuggestion,
  MatchSuggestions,
} from "@/types/match";
import type { AppNotification, NotificationQuery } from "@/types/notification";

export interface AuthApi {
  register(payload: RegisterPayload): Promise<AuthResponse>;
  login(payload: LoginPayload): Promise<AuthResponse>;
  logout(refreshToken: string): Promise<void>;
  me(): Promise<User>;
  updateMe(patch: ProfilePatch): Promise<User>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  /** Returns the freshly-verified user (backend: response_model=UserRead). */
  verifyEmail(token: string): Promise<User>;
}

export interface ItemsApi {
  list(query: ItemQuery): Promise<Paginated<Item>>;
  get(id: string): Promise<Item>;
  create(payload: CreateItemPayload): Promise<Item>;
  update(id: string, payload: UpdateItemPayload): Promise<Item>;
  /** Soft-close as withdrawn (the platform never hard-deletes user reports). */
  withdraw(id: string): Promise<void>;
  /** Close as recovered. */
  resolve(id: string): Promise<Item>;
  /** Upload photos. Server validates, strips EXIF and re-encodes to WebP. */
  uploadImages(id: string, files: File[]): Promise<ItemImage[]>;
  deleteImage(id: string, imageId: string): Promise<void>;
}

export interface CategoriesApi {
  tree(): Promise<Category[]>;
}

export interface NotificationsApi {
  list(query?: NotificationQuery): Promise<Paginated<AppNotification>>;
  unreadCount(): Promise<{ count: number }>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
}

export interface MatchesApi {
  forItem(itemId: string): Promise<MatchSuggestions>;
  get(id: string): Promise<MatchSuggestion>;
  /**
   * Spend a credit (or the free allowance) to reveal one suggestion.
   * Idempotent — unlocking an already-open match charges nothing.
   * Throws a 402 `ApiError` when the balance is short; that is the signal to
   * open the paywall, and the only one that should.
   */
  unlock(id: string): Promise<UnlockResult>;
  confirm(id: string): Promise<MatchSuggestion>;
  reject(id: string): Promise<MatchSuggestion>;
  feedback(id: string, payload: MatchFeedbackPayload): Promise<void>;
  /** Re-embed and re-match. Returns once queued, not once finished. Free. */
  rematch(itemId: string): Promise<void>;
}

export interface BillingApi {
  /** The price ladder. Static per deploy. */
  packs(): Promise<CreditPack[]>;
  entitlements(): Promise<Entitlements>;
  checkout(payload: { pack_id: string; locale: string }): Promise<Checkout>;
  payments(): Promise<Payment[]>;
  /**
   * One payment — polled by the return page. The authoritative status, as
   * opposed to whatever the gateway's redirect URL claims: that URL can be
   * retyped, shared, or reached with the Back button.
   */
  payment(id: string): Promise<Payment>;
  /** Dev-only: settle a `manual` payment. Refused when APP_ENV=production. */
  simulate(id: string): Promise<Payment>;
}

export interface ClaimsApi {
  /** Submit a claim on someone else's item, answering their questions. */
  submit(itemId: string, payload: CreateClaimPayload): Promise<Claim>;
  /** Claims on MY item — reporter only. */
  forItem(itemId: string): Promise<Claim[]>;
  /** Claims I have submitted. */
  mine(): Promise<Claim[]>;
  get(id: string): Promise<Claim>;
  /** Owner-only. Releases contact details to both parties. */
  approve(id: string): Promise<Claim>;
  reject(id: string): Promise<Claim>;
  /** Claimant-only. */
  withdraw(id: string): Promise<Claim>;
}

/**
 * The admin console. Every call is refused (403) unless the session belongs to
 * an administrator, and every mutation is written to the audit log server-side.
 */
export interface AdminApi {
  stats(): Promise<AdminStats>;
  /** Re-queue every matchable report whose AI processing failed. */
  retryFailed(): Promise<{ requeued: number }>;

  users(query: AdminUserQuery): Promise<Paginated<AdminUser>>;
  user(id: string): Promise<AdminUserDetail>;
  updateUser(id: string, patch: AdminUserPatch): Promise<AdminUserDetail>;
  grantCredits(id: string, payload: CreditGrantPayload): Promise<AdminUserDetail>;

  items(query: AdminItemQuery): Promise<Paginated<AdminItem>>;
  item(id: string): Promise<AdminItemDetail>;
  closeItem(id: string, payload: ItemClosePayload): Promise<AdminItemDetail>;
  reopenItem(id: string, note?: string): Promise<AdminItemDetail>;
  reprocessItem(id: string): Promise<AdminItemDetail>;
  deleteImage(itemId: string, imageId: string, reason?: string): Promise<AdminItemDetail>;

  matches(query: AdminMatchQuery): Promise<Paginated<AdminMatch>>;
  retractMatch(id: string, note?: string): Promise<AdminMatch>;

  payments(query: AdminPaymentQuery): Promise<Paginated<AdminPayment>>;
  payment(id: string): Promise<AdminPaymentDetail>;

  actions(query: AdminActionQuery): Promise<Paginated<AdminAction>>;
}

export interface Api {
  auth: AuthApi;
  items: ItemsApi;
  categories: CategoriesApi;
  notifications: NotificationsApi;
  matches: MatchesApi;
  claims: ClaimsApi;
  billing: BillingApi;
  admin: AdminApi;
}
