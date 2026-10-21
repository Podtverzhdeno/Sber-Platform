import { QueryClient } from "@tanstack/react-query";

import { retrySafeRead } from "../api/client";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: retrySafeRead,
        refetchOnWindowFocus: false,
        staleTime: 60_000,
        gcTime: 10 * 60_000,
      },
      mutations: { retry: false },
    },
  });
}
