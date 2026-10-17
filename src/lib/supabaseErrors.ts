/**
 * supabaseErrors.ts — Centralized Supabase error handler
 *
 * Intercepts known error codes (rate limiting, auth, etc.)
 * and shows user-friendly toast notifications.
 */

import { toast } from '@/hooks/use-toast';

interface SupabaseError {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  // PostgREST custom error shape
  statusCode?: number;
}

/**
 * Checks if a Supabase PostgREST error is an out-of-bounds pagination error
 * (PGRST103 / HTTP 416 "Requested range not satisfiable").
 *
 * This occurs legitimately when a filter, date range, or company change reduces
 * total records while currentPage > 1, or when a paginated batch loop exceeds the total count.
 */
export function isPgrstRangeError(error: unknown): boolean {
  if (!error) return false;
  const err = error as any;
  return (
    err.code === 'PGRST103' ||
    err.statusCode === 416 ||
    err.status === 416 ||
    (typeof err.message === 'string' && /satisfiable/i.test(err.message)) ||
    (typeof err.details === 'string' && /satisfiable/i.test(err.details)) ||
    (typeof err.error === 'string' && /satisfiable/i.test(err.error))
  );
}

/**
 * Checks if a Supabase error is a rate limit (429) response
 * and shows a friendly toast if so.
 *
 * @returns `true` if the error was a rate limit (handled), `false` otherwise
 *
 * Usage:
 * ```ts
 * const { data, error } = await supabase.from('table').insert({...});
 * if (error) {
 *   if (handleRateLimitError(error)) return; // already shown toast
 *   // handle other errors...
 * }
 * ```
 */
export function handleRateLimitError(error: SupabaseError | null): boolean {
  if (!error) return false;

  const isRateLimit =
    error.code === 'RATE_LIMIT_EXCEEDED' ||
    error.message?.includes('RATE_LIMIT_EXCEEDED') ||
    error.message?.includes('Túl sok kérés') ||
    (error as any)?.statusCode === 429;

  if (isRateLimit) {
    toast({
      variant: 'destructive',
      title: '⏳ A rendszer túlterhelt',
      description:
        'Túl sok művelet érkezett rövid időn belül. Kérjük próbáld újra körülbelül 1 perc múlva.',
      duration: 8000,
    });
    return true;
  }

  return false;
}

/**
 * Generic Supabase error handler — checks for rate limit first,
 * then shows a custom error toast for everything else.
 *
 * @returns `true` if the error was handled
 */
export function handleSupabaseError(
  error: SupabaseError | null,
  fallbackMessage?: string
): boolean {
  if (!error) return false;

  // Check rate limit first
  if (handleRateLimitError(error)) return true;

  // Generic error toast
  toast({
    variant: 'destructive',
    title: 'Hiba történt',
    description: fallbackMessage || error.message || 'Ismeretlen hiba. Próbáld újra később.',
    duration: 5000,
  });

  return true;
}
