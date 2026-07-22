import { request } from "@/services/http/client";
import type { AuthApi } from "@/services/contracts";
import type { AuthResponse, User } from "@/types/auth";

export const authClient: AuthApi = {
  register: (payload) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: payload }),
  login: (payload) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: payload }),
  logout: (refreshToken) =>
    request<void>("/auth/logout", {
      method: "POST",
      body: { refresh_token: refreshToken },
    }),
  me: () => request<User>("/auth/me"),
  updateMe: (patch) => request<User>("/auth/me", { method: "PATCH", body: patch }),
  forgotPassword: (email) =>
    request<void>("/auth/forgot-password", { method: "POST", body: { email } }),
  resetPassword: (token, newPassword) =>
    request<void>("/auth/reset-password", {
      method: "POST",
      body: { token, new_password: newPassword },
    }),
  verifyEmail: (token) =>
    request<void>("/auth/verify-email", { method: "POST", body: { token } }),
};
