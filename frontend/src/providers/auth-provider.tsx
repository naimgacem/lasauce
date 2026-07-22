"use client";

import * as React from "react";

import { trySingleFlightRefresh } from "@/services/http/refresh";
import { useAuthStore } from "@/store/auth.store";
import { useDraftStore } from "@/store/draft.store";

/**
 * Session bootstrap. On first client render:
 *  1. rehydrate the persisted stores (skipHydration keeps SSR clean),
 *  2. if a refresh token exists → silent refresh → authed,
 *  3. otherwise → guest.
 * Guards render loaders while status === "loading", so protected content
 * never flashes and guests are never bounced prematurely.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      await useAuthStore.persist.rehydrate();
      await useDraftStore.persist.rehydrate();

      const { refreshToken } = useAuthStore.getState();
      if (!refreshToken) {
        useAuthStore.getState().setStatus("guest");
        return;
      }
      const ok = await trySingleFlightRefresh();
      if (!cancelled) {
        useAuthStore.getState().setStatus(ok ? "authed" : "guest");
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}
