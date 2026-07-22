"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authKeys } from "@/lib/query-keys";
import { api } from "@/services";
import { useAuthStore } from "@/store/auth.store";
import type { ProfilePatch } from "@/types/auth";

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: ProfilePatch) => api.auth.updateMe(patch),
    onSuccess: (user) => {
      useAuthStore.getState().setUser(user); // keep the session snapshot fresh
      queryClient.setQueryData(authKeys.me(), user);
      toast.success("Profile updated.");
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useSendPasswordReset() {
  return useMutation({
    mutationFn: (email: string) => api.auth.forgotPassword(email),
    onSuccess: () =>
      toast.success("Reset link sent", {
        description: "Check your inbox for the password reset email.",
      }),
    onError: (error) => toast.error(error.message),
  });
}
