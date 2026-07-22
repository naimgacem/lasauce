"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ROUTES } from "@/lib/routes";
import { api } from "@/services";
import { useAuthStore } from "@/store/auth.store";

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { refreshToken } = useAuthStore.getState();
      if (refreshToken) {
        // Best effort — local sign-out must succeed even if the API is down.
        await api.auth.logout(refreshToken).catch(() => undefined);
      }
    },
    onSettled: () => {
      useAuthStore.getState().clearSession();
      queryClient.clear();
      toast.success("Signed out.");
      router.push(ROUTES.login);
    },
  });
}
