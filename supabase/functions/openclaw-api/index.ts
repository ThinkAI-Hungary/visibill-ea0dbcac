import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { logError, createServiceClient } from "../_shared/error-logger.ts";

// ─── CORS ────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// ─── Helpers ─────────────────────────────────────────
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const errorResponse = (code: string, message: string, status = 400) =>
  json({ success: false, error: { code, message } }, status);

// ─── Rate Limiter (in-memory, resets on cold start) ──
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(keyHash: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(keyHash);
  const windowMs = 60_000; // 1 minute

  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitMap.set(keyHash, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

// ─── Table allowlist ─────────────────────────────────
// All public tables that can be queried via the API.
// Security: only tables in this set are queryable.
const ALLOWED_TABLES = new Set([
  "companies",
  "company_members",
  "company_settings",
  "company_locations",
  "profiles",
  "invoices",
  "invoice_items",
  "invoice_uploads",
  "nav_invoices",
  "nav_invoice_items",
  "nav_sync_logs",
  "transactions",
  "transaction_uploads",
  "transaction_invoice_matches",
  "partners",
  "categories",
  "projects",
  "salary",
  "salary_files",
  "employee_rates",
  "tax",
  "gl_accounts",
  "gl_overrides_log",
  "gl_upload_notifications",
  "gl_journal_entries",
  "gl_audit_imports",
  "gl_audit_accounts",
  "gl_audit_partners",
  "chart_of_accounts_presets",
  "fixed_assets",
  "asset_events",
  "tao_depreciation_templates",
  "dunning_sends",
  "audit_logs",
  "time_entries",
  "leave_requests",
  "settings",
  "email_aliases",
  "user_email_preferences",
  "courier_reports",
  "report_uploads",
  "bank_statements",
  "bank_transactions",
  "bank_statement_uploads",
  "petty_cash_registers",
  "petty_cash_opening_balances",
  "petty_cash_entries",
  "petty_cash_routing_rules",
  "pnl_structure",
  "pnl_mapping",
  "bs_structure",
  "bs_mapping",
  "bs_prior_year",
  "annual_reports",
  "annual_report_notes_templates",
  "vat_codes",
  "vat_returns",
  "vat_return_lines",
  "vat_return_m_lines",
  "vat_form_rows",
  "daily_exchange_rates",
  "company_fx_settings",
  "reverse_charge_entries",
  "llm_koltsegek",
  "feedback",
  "shipment_import_batches",
  "shipments",
  "transport_documents",
  "shipment_matches",
  "match_transaction_overrides_log",
  // Accounty tables
  "accounty_assignments",
  "accounty_tax_profiles",
  "accounty_deadlines",
  "accounty_missing_items",
  "accounty_communication_preferences",
  "accounty_portal_tokens",
  "accounty_audit_log",
  "accounty_employees",
  "accounty_employments",
  "accounty_payroll_cycles",
  "accounty_payroll_items",
  "accounty_payroll_calculations",
  "accounty_declarations",
  "accounty_tax_parameters",
  "accounty_filings",
  "accounty_job_codes",
  "accounty_leaves",
  "accounty_cafeteria",
  "accounty_garnishments",
  "accounty_timesheets",
  "accounty_messages",
  "accounty_uploads",
  "accounty_gdpr_requests",
  "accounty_templates",
  "accounty_template_versions",
  "accounty_tax_params_global",
  "accounty_legal_updates",
  "accounty_tao_yearly",
  "accounty_cegkapu_settings",
  "accounty_nav_representations",
  "accounty_retention_rules",
  "accounty_data_contracts",
  "accounty_sites",
  "accounty_cost_centers",
  "accounty_departments",
  "accounty_year_end_tasks",
  "accounty_office_settings",
  "accounty_employee_jobs",
  "accounty_job_modifications",
  "accounty_documents",
  "accounty_transfers",
  "accounty_module_permissions",
  // Access & permissions
  "user_company_access_cache",
  "eaisybill_module_permissions",
  // Tickets
  "ticket_comments",
  "ticket_reads",
  "ticket_events",
]);

// Tables with sensitive data that are NEVER exposed
const BLOCKED_TABLES = new Set([
  "user_nav_credentials",    // NAV API credentials (encrypted)
  "user_subscriptions",      // Subscription/payment data
  "api_keys",                // API keys themselves
  "app_error_logs",          // Internal error logs
  "nylas_tokens",            // OAuth tokens
  "outgoing_emails",         // Email content
]);

// ─── SHA-256 hash (Web Crypto API) ───────────────────
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── API Key Authentication ──────────────────────────
interface ApiKeyRecord {
  id: string;
  company_id: string | null;
  scope: string;
  is_active: boolean;
  expires_at: string | null;
  rate_limit_per_minute: number;
  key_hash: string;
}

async function authenticateApiKey(
  admin: ReturnType<typeof createClient>,
  bearerToken: string
): Promise<{ key: ApiKeyRecord } | { error: string }> {
  const keyHash = await sha256(bearerToken);

  const { data, error } = await admin
    .from("api_keys")
    .select("id, company_id, scope, is_active, expires_at, rate_limit_per_minute, key_hash")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (error || !data) {
    return { error: "Invalid API key" };
  }

  if (!data.is_active) {
    return { error: "API key has been revoked" };
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { error: "API key has expired" };
  }

  // Update last_used_at (non-blocking)
  admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return { key: data as ApiKeyRecord };
}

// ─── Sanitize filter values (prevent injection) ──────
function sanitizeFilterValue(value: string): string {
  // Remove any PostgREST operators that could be injected
  return value.replace(/[;'"\\]/g, "");
}

// ─── Main Handler ────────────────────────────────────
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return errorResponse("METHOD_NOT_ALLOWED", "Only GET and POST are supported", 405);
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "help";

    // ── Env vars ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[OPENCLAW-API] Missing Supabase environment variables");
      return errorResponse("SERVER_ERROR", "Server configuration error", 500);
    }

    // ── Auth: Extract Bearer token ──
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return errorResponse("UNAUTHORIZED", "Missing Authorization header. Use: Bearer <api_key>", 401);
    }

    const bearerToken = authHeader.replace(/^Bearer\s+/i, "");
    if (!bearerToken || bearerToken.length < 10) {
      return errorResponse("UNAUTHORIZED", "Invalid API key format", 401);
    }

    // ── Service role client (RLS bypass) ──
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // ── Authenticate API key ──
    const authResult = await authenticateApiKey(admin, bearerToken);
    if ("error" in authResult) {
      return errorResponse("UNAUTHORIZED", authResult.error, 401);
    }

    const apiKey = authResult.key;

    // ── Rate limiting ──
    if (!checkRateLimit(apiKey.key_hash, apiKey.rate_limit_per_minute)) {
      return errorResponse(
        "RATE_LIMITED",
        `Rate limit exceeded (${apiKey.rate_limit_per_minute} req/min). Try again later.`,
        429
      );
    }

    // ── Route actions ──
    switch (action) {
      case "help":
        return json({
          success: true,
          data: {
            api_version: "1.0",
            description: "eaisybill Read-Only API for OpenClaw integration",
            actions: {
              help: "This help message",
              "list-tables": "List all queryable tables with row counts",
              query: "Query any table. Params: table (required), select, limit, offset, order_by, order_dir, filters (column=value)",
              schema: "Get column info for a table. Params: table (required)",
            },
            auth: "Bearer <api_key> in Authorization header",
            example: "?action=query&table=invoices&limit=10&order_by=created_at&order_dir=desc",
          },
        });

      case "list-tables":
        return json(await listTables(admin, apiKey));

      case "schema":
        return json(await getTableSchema(admin, url));

      case "query":
        return json(await queryTable(admin, apiKey, url));

      default:
        return errorResponse("UNKNOWN_ACTION", `Unknown action: ${action}. Use ?action=help for available actions.`, 400);
    }
  } catch (error) {
    console.error("[OPENCLAW-API] Unexpected error:", error);

    // Log to app_error_logs
    try {
      const svc = createServiceClient();
      await logError(svc, {
        error_type: "api_call",
        component: "openclaw-api",
        action: "request",
        message: error instanceof Error ? error.message : String(error),
        stack_trace: error instanceof Error ? error.stack : undefined,
      });
    } catch (_) {
      // Never let logging break
    }

    return errorResponse("SERVER_ERROR", "An unexpected error occurred", 500);
  }
});

// ─── Action: list-tables ─────────────────────────────
async function listTables(
  admin: ReturnType<typeof createClient>,
  apiKey: ApiKeyRecord
) {
  const tables: Array<{ name: string; row_count: number | null }> = [];

  // Query row counts for all allowed tables
  for (const tableName of ALLOWED_TABLES) {
    try {
      let query = admin.from(tableName).select("id", { count: "exact", head: true });

      // If company-scoped key, filter by company_id (if the table has it)
      if (apiKey.company_id) {
        // We try to filter by company_id — if the table doesn't have it, we skip the filter
        query = query.eq("company_id", apiKey.company_id);
      }

      const { count, error } = await query;
      if (!error) {
        tables.push({ name: tableName, row_count: count });
      } else {
        // Table might not have company_id column — retry without filter
        if (apiKey.company_id && error.message?.includes("company_id")) {
          const { count: retryCount } = await admin
            .from(tableName)
            .select("id", { count: "exact", head: true });
          tables.push({ name: tableName, row_count: retryCount ?? null });
        } else {
          tables.push({ name: tableName, row_count: null });
        }
      }
    } catch {
      tables.push({ name: tableName, row_count: null });
    }
  }

  return {
    success: true,
    data: {
      tables,
      total_tables: tables.length,
      scope: apiKey.company_id ? "company" : "project-wide",
      company_id: apiKey.company_id,
    },
  };
}

// ─── Action: schema ──────────────────────────────────
async function getTableSchema(
  admin: ReturnType<typeof createClient>,
  url: URL
) {
  const tableName = url.searchParams.get("table");
  if (!tableName) {
    return { success: false, error: { code: "MISSING_PARAM", message: "table parameter is required" } };
  }

  if (!ALLOWED_TABLES.has(tableName)) {
    return {
      success: false,
      error: {
        code: "TABLE_NOT_FOUND",
        message: BLOCKED_TABLES.has(tableName)
          ? `Table '${tableName}' is restricted for security reasons`
          : `Table '${tableName}' not found. Use ?action=list-tables to see available tables.`,
      },
    };
  }

  // Use information_schema to get column info
  const { data, error } = await admin.rpc("get_table_columns_info", {
    p_table_name: tableName,
  });

  // Fallback: if RPC doesn't exist, query a single row to infer schema
  if (error) {
    const { data: sampleRow, error: sampleError } = await admin
      .from(tableName)
      .select("*")
      .limit(1)
      .maybeSingle();

    if (sampleError || !sampleRow) {
      return {
        success: true,
        data: {
          table: tableName,
          columns: [],
          note: "Could not determine schema. The table might be empty.",
        },
      };
    }

    const columns = Object.keys(sampleRow).map((col) => ({
      name: col,
      type: typeof sampleRow[col],
      sample: sampleRow[col],
    }));

    return {
      success: true,
      data: { table: tableName, columns },
    };
  }

  return {
    success: true,
    data: { table: tableName, columns: data },
  };
}

// ─── Action: query ───────────────────────────────────
async function queryTable(
  admin: ReturnType<typeof createClient>,
  apiKey: ApiKeyRecord,
  url: URL
) {
  const tableName = url.searchParams.get("table");
  if (!tableName) {
    return { success: false, error: { code: "MISSING_PARAM", message: "table parameter is required" } };
  }

  if (!ALLOWED_TABLES.has(tableName)) {
    return {
      success: false,
      error: {
        code: "TABLE_NOT_FOUND",
        message: BLOCKED_TABLES.has(tableName)
          ? `Table '${tableName}' is restricted for security reasons`
          : `Table '${tableName}' not found. Use ?action=list-tables to see available tables.`,
      },
    };
  }

  // Parse query params
  const selectCols = url.searchParams.get("select") || "*";
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const orderBy = url.searchParams.get("order_by") || "created_at";
  const orderDir = url.searchParams.get("order_dir") || "desc";

  // Build query
  let query = admin.from(tableName).select(selectCols, { count: "exact" });

  // Company scope filter
  if (apiKey.company_id) {
    // Try adding company_id filter — some tables may not have it
    query = query.eq("company_id", apiKey.company_id);
  }

  // Parse additional filters from query params
  // Supported filter patterns: column=value, column__gte=value, column__lte=value, column__like=value
  const filterPrefixes = ["__gte", "__lte", "__like", "__neq", "__is"];
  for (const [key, value] of url.searchParams.entries()) {
    // Skip known params
    if (["action", "table", "select", "limit", "offset", "order_by", "order_dir"].includes(key)) {
      continue;
    }

    const sanitized = sanitizeFilterValue(value);

    // Check for operator suffixes
    let handled = false;
    for (const suffix of filterPrefixes) {
      if (key.endsWith(suffix)) {
        const column = key.slice(0, -suffix.length);
        switch (suffix) {
          case "__gte":
            query = query.gte(column, sanitized);
            break;
          case "__lte":
            query = query.lte(column, sanitized);
            break;
          case "__like":
            query = query.ilike(column, `%${sanitized}%`);
            break;
          case "__neq":
            query = query.neq(column, sanitized);
            break;
          case "__is":
            if (sanitized === "null") query = query.is(column, null);
            else if (sanitized === "true") query = query.is(column, true);
            else if (sanitized === "false") query = query.is(column, false);
            break;
        }
        handled = true;
        break;
      }
    }

    // Default: exact match
    if (!handled) {
      query = query.eq(key, sanitized);
    }
  }

  // Order
  query = query.order(orderBy, { ascending: orderDir === "asc" });

  // Pagination
  query = query.range(offset, offset + limit - 1);

  // Execute
  const { data, error, count } = await query;

  if (error) {
    // If the error is about company_id not existing, retry without it
    if (apiKey.company_id && error.message?.includes("company_id")) {
      let retryQuery = admin.from(tableName).select(selectCols, { count: "exact" });

      // Re-apply non-company filters
      for (const [key, value] of url.searchParams.entries()) {
        if (["action", "table", "select", "limit", "offset", "order_by", "order_dir"].includes(key)) continue;
        const sanitized = sanitizeFilterValue(value);

        let handled = false;
        for (const suffix of filterPrefixes) {
          if (key.endsWith(suffix)) {
            const column = key.slice(0, -suffix.length);
            switch (suffix) {
              case "__gte": retryQuery = retryQuery.gte(column, sanitized); break;
              case "__lte": retryQuery = retryQuery.lte(column, sanitized); break;
              case "__like": retryQuery = retryQuery.ilike(column, `%${sanitized}%`); break;
              case "__neq": retryQuery = retryQuery.neq(column, sanitized); break;
              case "__is":
                if (sanitized === "null") retryQuery = retryQuery.is(column, null);
                else if (sanitized === "true") retryQuery = retryQuery.is(column, true);
                else if (sanitized === "false") retryQuery = retryQuery.is(column, false);
                break;
            }
            handled = true;
            break;
          }
        }
        if (!handled) retryQuery = retryQuery.eq(key, sanitized);
      }

      retryQuery = retryQuery.order(orderBy, { ascending: orderDir === "asc" });
      retryQuery = retryQuery.range(offset, offset + limit - 1);

      const { data: retryData, error: retryError, count: retryCount } = await retryQuery;

      if (retryError) {
        return {
          success: false,
          error: { code: "QUERY_ERROR", message: retryError.message },
        };
      }

      return {
        success: true,
        data: {
          table: tableName,
          items: retryData || [],
          total_count: retryCount ?? 0,
          limit,
          offset,
          has_more: (retryCount ?? 0) > offset + limit,
        },
      };
    }

    return {
      success: false,
      error: { code: "QUERY_ERROR", message: error.message },
    };
  }

  return {
    success: true,
    data: {
      table: tableName,
      items: data || [],
      total_count: count ?? 0,
      limit,
      offset,
      has_more: (count ?? 0) > offset + limit,
    },
  };
}
