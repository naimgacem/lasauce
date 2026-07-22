export type UserRole = "user" | "admin";
export type UserStatus = "active" | "suspended" | "deleted";

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}

export type ProfilePatch = Partial<
  Pick<User, "full_name" | "phone" | "avatar_url">
>;
