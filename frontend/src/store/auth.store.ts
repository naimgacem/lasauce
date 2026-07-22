import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AuthResponse, User } from "@/types/auth";

export type SessionStatus = "loading" | "guest" | "authed";

interface AuthState {
  /**
   * Access token lives in MEMORY ONLY (never persisted) — on reload the
   * AuthProvider performs a silent refresh to mint a new pair.
   */
  accessToken: string | null;
  /** Rotating refresh token — the only persisted credential. */
  refreshToken: string | null;
  /** Display snapshot; `/auth/me` via TanStack Query stays authoritative. */
  user: User | null;
  status: SessionStatus;

  setSession: (auth: AuthResponse) => void;
  setTokens: (tokens: { access: string; refresh: string }) => void;
  setUser: (user: User) => void;
  setStatus: (status: SessionStatus) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      status: "loading",

      setSession: (auth) =>
        set({
          accessToken: auth.access_token,
          refreshToken: auth.refresh_token,
          user: auth.user,
          status: "authed",
        }),
      setTokens: ({ access, refresh }) =>
        set({ accessToken: access, refreshToken: refresh }),
      setUser: (user) => set({ user }),
      setStatus: (status) => set({ status }),
      clearSession: () =>
        set({ accessToken: null, refreshToken: null, user: null, status: "guest" }),
    }),
    {
      name: "lostfound-session",
      storage: createJSONStorage(() => window.localStorage),
      // accessToken and status are intentionally NOT persisted.
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      // SSR-safe: AuthProvider rehydrates explicitly on the client.
      skipHydration: true,
    },
  ),
);
