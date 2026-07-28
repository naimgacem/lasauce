"use client";

import { useMutation } from "@tanstack/react-query";

import { api } from "@/services";
import { useAuthStore } from "@/store/auth.store";
import type { RegisterPayload } from "@/types/auth";

/**
 * Create an account. The backend registers and logs in atomically, returning a
 * token pair, so the new user lands authenticated. <GuestGuard> owns the
 * redirect once status flips to "authed".
 */
export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) => api.auth.register(payload),
    onSuccess: (session) => useAuthStore.getState().setSession(session),
  });
}
