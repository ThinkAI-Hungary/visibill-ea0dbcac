import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

// ─── CORS ────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

// ─── Helpers ─────────────────────────────────────────
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const errorResponse = (code: string, message: string, status = 400, details?: unknown) =>
  json({ success: false, error: { code, message, details } }, status);

// ─── Rate Limiter (in-memory per key hash, 60s sliding window) ──
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

// ─── SHA-256 hash (Web Crypto API) ───────────────────
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Types ───────────────────────────────────────────
interface AuthResult {
  authenticated: boolean;
  error?: string;
  key_id?: string;
  name?: string;
  user_id?: string;
  company_id?: string | null;
  scope?: string;
  rate_limit_per_minute?: number;
  accessible_company_ids?: string[];
}

// ─── Input Validators ────────────────────────────────
function validateTaxNumber(taxNumber: string): boolean {
  // Hungarian tax number format: optional HU prefix + 8 digits - 1 digit (VAT code 1-5) - 2 digits (county)
  // e.g. 12345678-1-23, HU12345678-1-23, or 12345678123
  const regex = /^(HU)?\d{8}-?[1-5]-?\d{2}$/i;
  return regex.test(taxNumber.trim());
}

function validateTime(timeStr: string): boolean {
  // HH:MM or HH:MM:SS
  const regex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
  return regex.test(timeStr.trim());
}

// ─── Request Logger ──────────────────────────────────
async function logApiRequest(
  admin: ReturnType<typeof createClient>,
  data: {
    apiKeyId?: string | null;
    userId?: string | null;
    companyId?: string | null;
    endpoint: string;
    method: string;
    statusCode: number;
    ipAddress?: string | null;
    userAgent?: string | null;
    requestParams?: Record<string, unknown>;
    requestBody?: unknown;
    responseSummary?: unknown;
    errorMessage?: string | null;
    durationMs: number;
  }
) {
  try {
    await admin.from("api_request_logs").insert({
      api_key_id: data.apiKeyId || null,
      user_id: data.userId || null,
      company_id: data.companyId || null,
      endpoint: data.endpoint,
      method: data.method,
      status_code: data.statusCode,
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null,
      request_params: data.requestParams || {},
      request_body: data.requestBody ? data.requestBody : null,
      response_summary: data.responseSummary ? data.responseSummary : null,
      error_message: data.errorMessage || null,
      duration_ms: data.durationMs,
    });
  } catch (err) {
    console.error("[CUSTOMER-API] Failed to save api_request_log:", err);
  }
}

// ─── Main Handler ────────────────────────────────────
serve(async (req) => {
  const startTime = Date.now();

  // 1. CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "help";
  const userAgent = req.headers.get("user-agent") || "";
  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

  // Configuration
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[CUSTOMER-API] Missing environment variables");
    return errorResponse("SERVER_ERROR", "Szerver konfigurációs hiba", 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 2. Help action: accessible without authentication for documentation
  if (action === "help" && req.method === "GET") {
    return json({
      success: true,
      data: {
        api_name: "eaisybill Customer REST API",
        version: "v1",
        description: "Hivatalos programozási felület cégadatok és beállítások biztonságos lekérdezéséhez és módosításához.",
        auth_header: "Authorization: Bearer vb_<40-hex-characters>",
        actions: {
          "companies": "Lekérdezi az API kulccsal elérhető összes cég alapadatait (GET)",
          "company": "Lekérdezi egy konkrét cég összes adatát, beállításait, bankszámláit és telephelyeit (GET ?action=company&company_id=<uuid>)",
          "update_company": "Módosítja egy cég adatait (PATCH ?action=update_company&company_id=<uuid>). Módosítható mezők: name, tax_number, address, description, primary_teaor, vat_regime, vat_regime_effective_from",
          "update_settings": "Módosítja egy cég konfigurációs beállításait (PATCH ?action=update_settings&company_id=<uuid>). Módosítható mezők: work_start_time, work_end_time, admin_deadline, monthly_working_hours, gl_date_basis",
        },
        scopes: {
          "read": "Csak olvasási műveletek (companies, company)",
          "read_write": "Olvasási és módosítási műveletek (companies, company, update_company, update_settings)",
        },
      },
    });
  }

  // 3. Authenticate API Key
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    const res = errorResponse("UNAUTHORIZED", "Hiányzó vagy érvénytelen Authorization fejléc. Használd: Bearer <api_key>", 401);
    await logApiRequest(admin, {
      endpoint: url.pathname + url.search,
      method: req.method,
      statusCode: 401,
      ipAddress,
      userAgent,
      errorMessage: "Missing bearer token",
      durationMs: Date.now() - startTime,
    });
    return res;
  }

  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!bearerToken.startsWith("vb_") || bearerToken.length < 15) {
    const res = errorResponse("UNAUTHORIZED", "Érvénytelen API kulcs formátum. A kulcsnak 'vb_' előtaggal kell kezdődnie.", 401);
    await logApiRequest(admin, {
      endpoint: url.pathname + url.search,
      method: req.method,
      statusCode: 401,
      ipAddress,
      userAgent,
      errorMessage: "Invalid key format",
      durationMs: Date.now() - startTime,
    });
    return res;
  }

  // Compute SHA-256
  const keyHash = await sha256(bearerToken);

  // Authenticate via RPC
  const { data: authData, error: authRpcError } = await admin.rpc("authenticate_customer_api_key", {
    p_key_hash: keyHash,
  });

  if (authRpcError || !authData || !authData.authenticated) {
    const errCode = authData?.error || "INVALID_API_KEY";
    const errMsg = 
      errCode === "KEY_REVOKED" ? "Az API kulcs vissza lett vonva." :
      errCode === "KEY_EXPIRED" ? "Az API kulcs lejárt." :
      "Érvénytelen API kulcs.";

    const res = errorResponse(errCode, errMsg, 401);
    await logApiRequest(admin, {
      endpoint: url.pathname + url.search,
      method: req.method,
      statusCode: 401,
      ipAddress,
      userAgent,
      errorMessage: errMsg,
      durationMs: Date.now() - startTime,
    });
    return res;
  }

  const auth = authData as AuthResult;
  const accessibleCompanyIds = new Set(auth.accessible_company_ids || []);

  // 4. Rate Limiting
  const rateLimit = auth.rate_limit_per_minute || 100;
  if (!checkRateLimit(keyHash, rateLimit)) {
    const res = errorResponse("RATE_LIMITED", `Kérésszám korlát túllépve (${rateLimit} kérés/perc). Kérjük várj egy percet.`, 429);
    await logApiRequest(admin, {
      apiKeyId: auth.key_id,
      userId: auth.user_id,
      endpoint: url.pathname + url.search,
      method: req.method,
      statusCode: 429,
      ipAddress,
      userAgent,
      errorMessage: "Rate limit exceeded",
      durationMs: Date.now() - startTime,
    });
    return res;
  }

  // 5. Read Request Body if applicable
  let requestBody: Record<string, unknown> = {};
  if (req.method === "POST" || req.method === "PATCH") {
    try {
      requestBody = await req.json();
    } catch {
      const res = errorResponse("INVALID_JSON", "Érvénytelen JSON kéréstörzs.", 400);
      await logApiRequest(admin, {
        apiKeyId: auth.key_id,
        userId: auth.user_id,
        endpoint: url.pathname + url.search,
        method: req.method,
        statusCode: 400,
        ipAddress,
        userAgent,
        errorMessage: "Malformed JSON body",
        durationMs: Date.now() - startTime,
      });
      return res;
    }
  }

  // Helper for checking write scope
  const requireWriteScope = (): Response | null => {
    if (auth.scope !== "read_write") {
      return errorResponse("FORBIDDEN_SCOPE", "A megadott API kulcs csak olvasási ('read') jogosultsággal rendelkezik. Módosításhoz 'read_write' scope szükséges.", 403);
    }
    return null;
  };

  // Helper for verifying company access
  const verifyCompanyAccess = (companyId: string | null): Response | null => {
    if (!companyId) {
      return errorResponse("MISSING_COMPANY_ID", "A 'company_id' paraméter megadása kötelező.", 400);
    }
    if (!accessibleCompanyIds.has(companyId)) {
      return errorResponse("ACCESS_DENIED", "Nincs jogosultságod a megadott cég adataihoz, vagy a cég nem létezik.", 403);
    }
    return null;
  };

  let response: Response;
  let targetCompanyId: string | null = null;

  try {
    // 6. Action Dispatcher
    switch (action) {
      // ──────────────────────────────────────────────────
      // ACTION: companies — List all accessible companies
      // ──────────────────────────────────────────────────
      case "companies": {
        if (accessibleCompanyIds.size === 0) {
          response = json({ success: true, data: { companies: [], count: 0 } });
          break;
        }

        const { data: companies, error: compErr } = await admin
          .from("companies")
          .select("id, name, tax_number, address, vat_regime, vat_regime_effective_from, description, primary_teaor, created_at, updated_at")
          .in("id", Array.from(accessibleCompanyIds))
          .order("name", { ascending: true });

        if (compErr) {
          response = errorResponse("QUERY_FAILED", compErr.message, 500);
          break;
        }

        response = json({
          success: true,
          data: {
            companies: companies || [],
            count: companies?.length || 0,
            key_scope: auth.scope,
          },
        });
        break;
      }

      // ──────────────────────────────────────────────────
      // ACTION: company — Full details of a single company
      // ──────────────────────────────────────────────────
      case "company": {
        const companyId = url.searchParams.get("company_id") || (requestBody?.company_id as string);
        targetCompanyId = companyId;

        const accessErr = verifyCompanyAccess(companyId);
        if (accessErr) {
          response = accessErr;
          break;
        }

        // Fetch company, settings, locations, and bank accounts in parallel
        const [companyRes, settingsRes, locationsRes, bankAccountsRes] = await Promise.all([
          admin.from("companies").select("id, name, tax_number, address, vat_regime, vat_regime_effective_from, description, primary_teaor, created_at, updated_at").eq("id", companyId).maybeSingle(),
          admin.from("company_settings").select("work_start_time, work_end_time, admin_deadline, monthly_working_hours, gl_date_basis, updated_at").eq("company_id", companyId).maybeSingle(),
          admin.from("company_locations").select("id, name, address, location_type, is_default, created_at").eq("company_id", companyId).order("is_default", { ascending: false }),
          admin.from("company_bank_accounts").select("id, bank_name, account_number, currency, created_at").eq("company_id", companyId),
        ]);

        if (companyRes.error || !companyRes.data) {
          response = errorResponse("COMPANY_NOT_FOUND", "A megadott cég nem található.", 404);
          break;
        }

        response = json({
          success: true,
          data: {
            company: companyRes.data,
            settings: settingsRes.data || {
              work_start_time: "09:00:00",
              work_end_time: "17:00:00",
              admin_deadline: "20:00:00",
              monthly_working_hours: 168,
              gl_date_basis: "kibocsatas",
            },
            locations: locationsRes.data || [],
            bank_accounts: bankAccountsRes.data || [],
          },
        });
        break;
      }

      // ──────────────────────────────────────────────────
      // ACTION: update_company — Update company master data
      // ──────────────────────────────────────────────────
      case "update_company": {
        const scopeErr = requireWriteScope();
        if (scopeErr) {
          response = scopeErr;
          break;
        }

        const companyId = url.searchParams.get("company_id") || (requestBody?.company_id as string);
        targetCompanyId = companyId;

        const accessErr = verifyCompanyAccess(companyId);
        if (accessErr) {
          response = accessErr;
          break;
        }

        // Whitelist extract & validation
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (requestBody.name !== undefined) {
          const nameStr = String(requestBody.name).trim();
          if (!nameStr) {
            response = errorResponse("VALIDATION_ERROR", "A cég neve nem lehet üres.", 400);
            break;
          }
          updates.name = nameStr;
        }

        if (requestBody.tax_number !== undefined) {
          const taxStr = String(requestBody.tax_number).trim();
          if (taxStr && !validateTaxNumber(taxStr)) {
            response = errorResponse("VALIDATION_ERROR", "Érvénytelen magyar adószám formátum (pl. 12345678-1-23 vagy HU12345678-1-23).", 400);
            break;
          }
          updates.tax_number = taxStr || null;
        }

        if (requestBody.address !== undefined) {
          updates.address = String(requestBody.address).trim() || null;
        }

        if (requestBody.description !== undefined) {
          updates.description = String(requestBody.description).trim() || null;
        }

        if (requestBody.primary_teaor !== undefined) {
          updates.primary_teaor = String(requestBody.primary_teaor).trim() || null;
        }

        if (requestBody.vat_regime !== undefined) {
          const allowedVatRegimes = ["alanyi_mentes", "afa_koros", "penzforgalmi", "eva", "kata"];
          const regime = String(requestBody.vat_regime).toLowerCase().trim();
          if (!allowedVatRegimes.includes(regime)) {
            response = errorResponse("VALIDATION_ERROR", `Érvénytelen ÁFA rendszer. Megengedett értékek: ${allowedVatRegimes.join(", ")}`, 400);
            break;
          }
          updates.vat_regime = regime;
        }

        if (requestBody.vat_regime_effective_from !== undefined) {
          const dateStr = String(requestBody.vat_regime_effective_from).trim();
          if (dateStr && isNaN(Date.parse(dateStr))) {
            response = errorResponse("VALIDATION_ERROR", "Érvénytelen dátum formátum az ÁFA hatálybalépéshez (YYYY-MM-DD).", 400);
            break;
          }
          updates.vat_regime_effective_from = dateStr || null;
        }

        // Perform update
        const { data: updatedComp, error: updateErr } = await admin
          .from("companies")
          .update(updates)
          .eq("id", companyId)
          .select("id, name, tax_number, address, vat_regime, vat_regime_effective_from, description, primary_teaor, updated_at")
          .single();

        if (updateErr) {
          response = errorResponse("UPDATE_FAILED", updateErr.message, 500);
          break;
        }

        response = json({
          success: true,
          message: "Cégadatok sikeresen frissítve.",
          data: { company: updatedComp },
        });
        break;
      }

      // ──────────────────────────────────────────────────
      // ACTION: update_settings — Update company settings
      // ──────────────────────────────────────────────────
      case "update_settings": {
        const scopeErr = requireWriteScope();
        if (scopeErr) {
          response = scopeErr;
          break;
        }

        const companyId = url.searchParams.get("company_id") || (requestBody?.company_id as string);
        targetCompanyId = companyId;

        const accessErr = verifyCompanyAccess(companyId);
        if (accessErr) {
          response = accessErr;
          break;
        }

        // Whitelist & validation (following A-093 atomic upsert pattern)
        const settingsPayload: Record<string, unknown> = {
          company_id: companyId,
          updated_at: new Date().toISOString(),
        };

        if (requestBody.work_start_time !== undefined) {
          const t = String(requestBody.work_start_time).trim();
          if (!validateTime(t)) {
            response = errorResponse("VALIDATION_ERROR", "Érvénytelen work_start_time formátum (HH:mm vagy HH:mm:ss).", 400);
            break;
          }
          settingsPayload.work_start_time = t;
        }

        if (requestBody.work_end_time !== undefined) {
          const t = String(requestBody.work_end_time).trim();
          if (!validateTime(t)) {
            response = errorResponse("VALIDATION_ERROR", "Érvénytelen work_end_time formátum (HH:mm vagy HH:mm:ss).", 400);
            break;
          }
          settingsPayload.work_end_time = t;
        }

        if (requestBody.admin_deadline !== undefined) {
          const t = String(requestBody.admin_deadline).trim();
          if (!validateTime(t)) {
            response = errorResponse("VALIDATION_ERROR", "Érvénytelen admin_deadline formátum (HH:mm vagy HH:mm:ss).", 400);
            break;
          }
          settingsPayload.admin_deadline = t;
        }

        if (requestBody.monthly_working_hours !== undefined) {
          const hours = Number(requestBody.monthly_working_hours);
          if (isNaN(hours) || hours < 0 || hours > 744) {
            response = errorResponse("VALIDATION_ERROR", "A havi munkaóraszám 0 és 744 óra közötti szám kell legyen.", 400);
            break;
          }
          settingsPayload.monthly_working_hours = hours;
        }

        if (requestBody.gl_date_basis !== undefined) {
          const basis = String(requestBody.gl_date_basis).toLowerCase().trim();
          if (basis !== "kibocsatas" && basis !== "teljesites") {
            response = errorResponse("VALIDATION_ERROR", "A gl_date_basis kizárólag 'kibocsatas' vagy 'teljesites' lehet.", 400);
            break;
          }
          settingsPayload.gl_date_basis = basis;
        }

        // Atomic upsert on company_id (A-093)
        const { data: updatedSettings, error: upsertErr } = await admin
          .from("company_settings")
          .upsert(settingsPayload, { onConflict: "company_id" })
          .select("work_start_time, work_end_time, admin_deadline, monthly_working_hours, gl_date_basis, updated_at")
          .single();

        if (upsertErr) {
          response = errorResponse("UPDATE_FAILED", upsertErr.message, 500);
          break;
        }

        response = json({
          success: true,
          message: "Cégbeállítások sikeresen mentve (atomi upsert).",
          data: { settings: updatedSettings },
        });
        break;
      }

      default:
        response = errorResponse("UNKNOWN_ACTION", `Ismeretlen akció: '${action}'. Használd az ?action=help végpontot a leíráshoz.`, 400);
        break;
    }
  } catch (err) {
    console.error("[CUSTOMER-API] Unexpected execution error:", err);
    response = errorResponse("INTERNAL_ERROR", "Váratlan szerverhiba történt az API kérés feldolgozása közben.", 500);
  }

  // 7. Log completion to api_request_logs
  const durationMs = Date.now() - startTime;
  await logApiRequest(admin, {
    apiKeyId: auth.key_id,
    userId: auth.user_id,
    companyId: targetCompanyId,
    endpoint: url.pathname + url.search,
    method: req.method,
    statusCode: response.status,
    ipAddress,
    userAgent,
    requestParams: Object.fromEntries(url.searchParams.entries()),
    requestBody: req.method === "GET" ? null : requestBody,
    errorMessage: response.status >= 400 ? `Status ${response.status}` : null,
    durationMs,
  });

  return response;
});
