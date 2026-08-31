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
export type ErrorType = 'auth' | 'db_query' | 'api_call' | 'upload' | 'validation' | 'navigation' | 'realtime' | 'unhandled';
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

function extractErrorDetails(err: unknown): { message?: string; name?: string; stack?: string; details?: unknown } {
  if (!err) return {};
  if (err instanceof Error) {
    return { message: err.message, name: err.name, stack: err.stack, details: err.cause };
  }
  if (typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    const msg = typeof obj.message === 'string' ? obj.message
      : typeof obj.error === 'string' ? obj.error
      : typeof obj.error_description === 'string' ? obj.error_description
      : typeof obj.details === 'string' ? obj.details
      : typeof obj.hint === 'string' ? obj.hint
      : typeof obj.msg === 'string' ? obj.msg
      : undefined;
    const name = typeof obj.name === 'string' ? obj.name : typeof obj.code === 'string' ? String(obj.code) : undefined;
    const stack = typeof obj.stack === 'string' ? obj.stack : undefined;
    return { message: msg, name, stack, details: obj };
  }
  return { message: String(err) };
}

// ─── Main reporter ──────────────────────────────────────────
export async function reportError(opts: ReportErrorOptions): Promise<void> {
  // 1. Always log to console — with full error details
  const tag = `[${opts.component}/${opts.action}]`;

  // Format the error for console: Error → native, plain object → JSON, else string
  function fmtErr(err: unknown): unknown {
    if (err == null || err === '') return undefined;
    if (err instanceof Error) return err;           // native Error prints stack in DevTools
    if (typeof err === 'object') {
      try { return JSON.stringify(err, null, 2); }  // plain object → readable JSON
      catch { return String(err); }
    }
    return err;
  }

  const formattedErr = fmtErr(opts.error);
  if (opts.severity === 'warning') {
    formattedErr !== undefined
      ? console.warn(tag, opts.message, formattedErr)
      : console.warn(tag, opts.message);
  } else {
    formattedErr !== undefined
      ? console.error(tag, opts.message, formattedErr)
      : console.error(tag, opts.message);
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
    
    // 3.1. Robust error message reconstruction
    const errDetails = extractErrorDetails(opts.error);
    let finalMessage = (opts.message || '').trim();

    if (!finalMessage || finalMessage === '[object Object]') {
      finalMessage = errDetails.message || `Hiba történt a(z) ${opts.component} komponensben (${opts.action})`;
    } else if (errDetails.message) {
      if (finalMessage.endsWith(':')) {
        finalMessage = `${finalMessage} ${errDetails.message}`;
      } else if (!finalMessage.toLowerCase().includes(errDetails.message.toLowerCase())) {
        finalMessage = `${finalMessage}: ${errDetails.message}`;
      }
    }

    const sanitizedContext = opts.context ? sanitizeContext(opts.context) : {};

    // 3.2. Automatically attach serialized raw error to context for deep visibility
    if (opts.error && !sanitizedContext.error_details) {
      try {
        if (opts.error instanceof Error) {
          sanitizedContext.error_details = {
            name: opts.error.name,
            message: opts.error.message,
            stack: opts.error.stack,
            ...(opts.error.cause ? { cause: String(opts.error.cause) } : {}),
          };
        } else if (typeof opts.error === 'object') {
          sanitizedContext.error_details = sanitizeContext(opts.error as Record<string, unknown>);
        } else {
          sanitizedContext.error_details = { value: String(opts.error) };
        }
      } catch {
        sanitizedContext.error_details = { value: '[Unserializable Error]' };
      }
    }

    // Extract stack trace
    let stackTrace: string | null = errDetails.stack?.slice(0, 3000) ?? null;
    if (!stackTrace && opts.error instanceof Error) {
      stackTrace = opts.error.stack?.slice(0, 3000) ?? null;
    }

    await supabase.from('app_error_logs').insert({
      user_id: userId,
      company_id: companyId,
      error_type: opts.type,
      severity: opts.severity || 'error',
      component: opts.component,
      action: opts.action,
      message: finalMessage.slice(0, 2000),
      stack_trace: stackTrace,
      context: sanitizedContext as unknown as Record<string, string>,
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
