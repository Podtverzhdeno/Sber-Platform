import { QueryClient } from "@tanstack/react-query";

import { retrySafeRead, subscribeAuthScopeChange } from "../api/client";

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
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
  subscribeAuthScopeChange(() => {
    // A role switch can change visibility without a route change. Never reuse
    // private search, notification, analytics or work projections from prior scope.
    client.removeQueries({
      predicate: (query) =>
        !["public-config", "demo-personas"].includes(String(query.queryKey[0])),
    });
  });
  return client;
}

/** A single query client per browser session, reused across workspace routes. */
export const appQueryClient = createQueryClient();

/** Reset cached actor-scoped projections between independent test mounts. */
export function resetAppQueryCacheForTests(): void {
  appQueryClient.clear();
}
