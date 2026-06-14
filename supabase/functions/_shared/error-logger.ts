/**
 * Shared error reporting utility for Edge Functions.
 * Writes errors to the `app_error_logs` table using service_role key.
 * 
 * Usage:
 *   import { logError } from "../_shared/error-logger.ts";
 *   await logError(supabaseServiceClient, { ... });
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

interface ErrorLogEntry {
  error_type: string;     // 'mailgun' | 'email_alias' | 'api_call' | 'webhook' | etc
  severity?: string;      // 'error' | 'warning' | 'info' — default 'error'
  component: string;      // Edge Function name
  action: string;         // What was being attempted
  message: string;        // Human-readable error message
  user_id?: string | null;
  company_id?: string | null;
  stack_trace?: string;
  context?: Record<string, unknown>;
}

/**
 * Log an error to `app_error_logs` using a service_role Supabase client.
 * Non-blocking: catches its own errors so it never disrupts the main flow.
 */
export async function logError(
  supabase: SupabaseClient,
  entry: ErrorLogEntry
): Promise<void> {
  try {
    await supabase.from("app_error_logs").insert({
      error_type: entry.error_type,
      severity: entry.severity || "error",
      component: entry.component,
      action: entry.action,
      message: entry.message.substring(0, 2000), // Truncate
      stack_trace: entry.stack_trace?.substring(0, 5000),
      user_id: entry.user_id || null,
      company_id: entry.company_id || null,
      context: entry.context || {},
      url: null,        // Not applicable for Edge Functions
      user_agent: null, // Not applicable for Edge Functions
    });
  } catch (err) {
    // Never let logging break the main flow
    console.error("[error-logger] Failed to write to app_error_logs:", err);
  }
}

/**
 * Create a service_role Supabase client for error logging.
 * Use this when you only have an anon-key client in scope.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}
