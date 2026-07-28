"use client";

import { useMutation } from "@tanstack/react-query";

import { api } from "@/services";
import { useAuthStore } from "@/store/auth.store";
import type { LoginPayload } from "@/types/auth";

/**
 * Sign in. On success the session status flips to "authed" and <GuestGuard>
 * performs the redirect (honouring ?next=), so this hook never navigates.
 */
export function useLogin() {
  return useMutation({
    mutationFn: (payload: LoginPayload) => api.auth.login(payload),
    onSuccess: (session) => useAuthStore.getState().setSession(session),
  });
}
