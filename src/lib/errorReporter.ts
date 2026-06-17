/**
 * Centralized error reporter — logs frontend errors to app_error_logs table.
 * 
 * Usage:
 *   reportError({ type: 'auth', component: 'Auth', action: 'login', message: 'Invalid credentials', error });
 * 
 * Features:
 *   - Rate limiting: max 10 logs per minute per session
 *   - Sensitive data filtering: strips password, token, secret, key fields from context
 *   - Fire-and-forget: never blocks UI
 *   - Fallback: always console.error even if DB write fails
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Types ───────────────────────────────────────────────────
export type ErrorType = 'auth' | 'db_query' | 'api_call' | 'upload' | 'validation' | 'navigation' | 'unhandled';
export type Severity = 'error' | 'warning' | 'info';

export interface ReportErrorOptions {
  type: ErrorType;
  severity?: Severity;
  component: string;
  action: string;
  message: string;
  error?: unknown;
  context?: Record<string, unknown>;
}

// ─── Rate limiting (10/min) ──────────────────────────────────
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const recentTimestamps: number[] = [];

function isRateLimited(): boolean {
  const now = Date.now();
  // Remove timestamps outside window
  while (recentTimestamps.length > 0 && recentTimestamps[0]! < now - RATE_WINDOW_MS) {
    recentTimestamps.shift();
  }
  if (recentTimestamps.length >= RATE_LIMIT) return true;
  recentTimestamps.push(now);
  return false;
}

// ─── Sensitive data filter ───────────────────────────────────
const SENSITIVE_KEYS = /^(password|passwd|secret|token|api_?key|authorization|cookie|session|credit.?card|cvv|ssn)$/i;

function sanitizeContext(ctx: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (SENSITIVE_KEYS.test(key)) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      clean[key] = sanitizeContext(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

// ─── Get company ID from app state ──────────────────────────
function getCompanyId(): string | null {
  try {
    // Try multiple known storage keys
    return localStorage.getItem('selectedCompanyId')
      || localStorage.getItem('vb_company_id')
      || null;
  } catch {
    return null;
  }
}

// ─── Main reporter ──────────────────────────────────────────
export async function reportError(opts: ReportErrorOptions): Promise<void> {
  // 1. Always log to console
  const tag = `[${opts.component}/${opts.action}]`;
  if (opts.severity === 'warning') {
    console.warn(tag, opts.message, opts.error || '');
  } else {
    console.error(tag, opts.message, opts.error || '');
  }

  // 2. Rate limit check
  if (isRateLimited()) return;

  // 3. Fire-and-forget DB insert
  try {
    // Try to get user — may be null for auth errors
    let userId: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id ?? null;
    } catch {
      // Auth not available — that's fine for auth error logging
    }

    const companyId = getCompanyId();
    const sanitizedContext = opts.context ? sanitizeContext(opts.context) : {};

    // Extract stack trace
    let stackTrace: string | null = null;
    if (opts.error instanceof Error) {
      stackTrace = opts.error.stack?.slice(0, 3000) ?? null;
    }

    await supabase.from('app_error_logs').insert({
      user_id: userId,
      company_id: companyId,
      error_type: opts.type,
      severity: opts.severity || 'error',
      component: opts.component,
      action: opts.action,
      message: opts.message.slice(0, 2000),
      stack_trace: stackTrace,
      context: sanitizedContext,
      url: window.location.pathname,
      user_agent: navigator.userAgent.slice(0, 500),
    });
  } catch {
    // If logging itself fails, silently ignore — never cascade
  }
}

// ─── Convenience helpers ─────────────────────────────────────

/** Log an auth error (login, signup, password reset, etc.) */
export function reportAuthError(component: string, action: string, message: string, error?: unknown, context?: Record<string, unknown>) {
  return reportError({ type: 'auth', component, action, message, error, context });
}

/** Log a database query error */
export function reportDbError(component: string, action: string, message: string, error?: unknown, context?: Record<string, unknown>) {
  return reportError({ type: 'db_query', component, action, message, error, context });
}

/** Log an API call error */
export function reportApiError(component: string, action: string, message: string, error?: unknown, context?: Record<string, unknown>) {
  return reportError({ type: 'api_call', component, action, message, error, context });
}

/** Log a file upload error */
export function reportUploadError(component: string, action: string, message: string, error?: unknown, context?: Record<string, unknown>) {
  return reportError({ type: 'upload', component, action, message, error, context });
}

/** Log a validation error */
export function reportValidationError(component: string, action: string, message: string, context?: Record<string, unknown>) {
  return reportError({ type: 'validation', severity: 'warning', component, action, message, context });
}
