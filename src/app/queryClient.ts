import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { reportError } from "@/lib/errorReporter";
import { extractErrorInfo } from "./bootstrap";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min — stable data won't refetch on every mount
      gcTime: 10 * 60 * 1000,   // 10 min garbage collection
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Log every final query failure (after retries exhausted)
      const { message, details } = extractErrorInfo(error);
      reportError({
        type: 'db_query',
        component: String(query.queryKey?.[0] || 'UnknownQuery'),
        action: 'query_error',
        message,
        error,
        context: { queryKey: query.queryKey, ...details },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Log every mutation failure
      const { message, details } = extractErrorInfo(error);
      reportError({
        type: 'db_query',
        component: String(mutation.options.mutationKey?.[0] || 'UnknownMutation'),
        action: 'mutation_error',
        message,
        error,
        context: { mutationKey: mutation.options.mutationKey, ...details },
      });
    },
  }),
});
