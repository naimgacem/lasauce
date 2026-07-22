import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/types/api";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Auth/permission/not-found are not transient — don't retry them.
          if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}
