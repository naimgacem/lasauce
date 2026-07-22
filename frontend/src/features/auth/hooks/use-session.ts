"use client";

import { useAuthStore } from "@/store/auth.store";

/** Session snapshot for components: user, status, role helpers. */
export function useSession() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  return {
    user,
    status,
    isLoading: status === "loading",
    isAuthed: status === "authed",
    isAdmin: status === "authed" && user?.role === "admin",
  };
}
