"use client";

import { useMutation } from "@tanstack/react-query";

import { api } from "@/services";

/**
 * Request a reset link. Always resolves successfully, even for an unknown
 * address — the backend answers identically either way so the form can't be
 * used to discover which emails have accounts.
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => api.auth.forgotPassword(email),
  });
}

/** Set a new password from an emailed token. Revokes all other sessions. */
export function useResetPassword() {
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      api.auth.resetPassword(token, password),
  });
}

/** Confirm an email address from an emailed token. */
export function useVerifyEmail() {
  return useMutation({
    mutationFn: (token: string) => api.auth.verifyEmail(token),
  });
}
