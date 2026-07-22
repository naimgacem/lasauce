import { env } from "@/lib/env";
import { useAuthStore } from "@/store/auth.store";
import type { AuthResponse } from "@/types/auth";

/**
 * Single-flight refresh-token rotation: any number of concurrent 401s (or the
 * bootstrap) share ONE refresh call. Uses bare fetch so the refresh request is
 * never itself intercepted. Never navigates — guards own redirects by reacting
 * to the session status.
 */
let inflight: Promise<boolean> | null = null;

export function trySingleFlightRefresh(): Promise<boolean> {
  inflight ??= doRefresh().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doRefresh(): Promise<boolean> {
  const store = useAuthStore.getState();
  if (!store.refreshToken) return false;

  if (env.useMocks) {
    // Mock mode: mint a fresh fake pair; the persisted user snapshot stands in
    // for the server-side session.
    store.setTokens({
      access: `mock-access-${Date.now()}`,
      refresh: `mock-refresh-${Date.now()}`,
    });
    return true;
  }

  try {
    const res = await fetch(`${env.apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: store.refreshToken }),
    });
    if (!res.ok) throw new Error(`refresh failed (${res.status})`);
    const data = (await res.json()) as AuthResponse;
    useAuthStore.getState().setSession(data);
    return true;
  } catch {
    useAuthStore.getState().clearSession();
    return false;
  }
}
