/**
 * Domain API contracts. Real clients (HTTP) and mock adapters (in-memory)
 * implement the SAME interfaces — `services/index.ts` picks one per env, and
 * nothing above this layer ever knows which.
 */
import type { Paginated } from "@/types/api";
import type {
  AuthResponse,
  LoginPayload,
  ProfilePatch,
  RegisterPayload,
  User,
} from "@/types/auth";
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
  verifyEmail(token: string): Promise<void>;
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
  confirm(id: string): Promise<void>;
  reject(id: string): Promise<void>;
  feedback(id: string, payload: MatchFeedbackPayload): Promise<void>;
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

export interface Api {
  auth: AuthApi;
  items: ItemsApi;
  categories: CategoriesApi;
  notifications: NotificationsApi;
  matches: MatchesApi;
  claims: ClaimsApi;
}
