import { env } from "@/lib/env";
import { useAuthStore } from "@/store/auth.store";

import { networkError, parseErrorResponse } from "./errors";
import { trySingleFlightRefresh } from "./refresh";

type Primitive = string | number | boolean;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  params?: Record<string, Primitive | undefined>;
  timeoutMs?: number;
}

/**
 * Typed fetch core. Injects the bearer token, applies a timeout, normalises
 * the backend error envelope, and on 401 performs a single-flight refresh
 * then replays the request exactly once.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {},
  _retried = false,
): Promise<T> {
  const { method = "GET", body, params, timeoutMs = 12_000 } = options;

  const url = new URL(env.apiUrl + path);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
    }
  }

  const token = useAuthStore.getState().accessToken;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw networkError();
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 && !_retried && useAuthStore.getState().refreshToken) {
    const refreshed = await trySingleFlightRefresh();
    if (refreshed) return request<T>(path, options, true);
    // refresh failed → session already cleared; guards will redirect.
  }

  if (!res.ok) throw await parseErrorResponse(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
