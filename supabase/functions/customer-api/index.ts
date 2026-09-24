import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { OPENAPI_SPEC } from "./openapi-spec.ts";
import { NavIngestionService } from "../_shared/nav/index.ts";

// ─── CORS ────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

// ─── Helpers ─────────────────────────────────────────
let lastResponsePayload: unknown = null;

const json = (body: unknown, status = 200) => {
  lastResponsePayload = body;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

const errorResponse = (code: string, message: string, status = 400, details?: unknown) => {
  const body = { success: false, error: { code, message, details } };
  lastResponsePayload = body;
  const res = new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  (res as any)._errorMessage = details
    ? `${code}: ${message} (${typeof details === "object" ? JSON.stringify(details) : details})`
    : `${code}: ${message}`;
  return res;
};

// ─── Query Param Validator ────────────────────────────
function validateQueryParams(url: URL, allowedParams: string[]): Response | null {
  const allowed = new Set(["action", "company_id", ...allowedParams]);
  const unknown: string[] = [];
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) {
      unknown.push(key);
    }
  }
  if (unknown.length > 0) {
    return errorResponse(
      "INVALID_QUERY_PARAMETER",
      `Ismeretlen vagy nem támogatott lekérdezési paraméter(ek): ${unknown.join(", ")}. Megengedett paraméterek: ${allowedParams.join(", ") || "nincsenek"}.`,
      400,
      { unknown_parameters: unknown, allowed_parameters: allowedParams }
    );
  }
  return null;
}

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

// ─── Input Validators & Resolvers ────────────────────
function validateTaxNumber(taxNumber: string): boolean {
  const regex = /^(HU)?\d{8}-?[1-5]-?\d{2}$/i;
  return regex.test(taxNumber.trim());
}

function validateTime(timeStr: string): boolean {
  const regex = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;
  return regex.test(timeStr.trim());
}

async function resolveEffectiveUserId(
  admin: ReturnType<typeof createClient>,
  authUserId: string | null | undefined,
  companyId?: string | null,
  apiKeyId?: string | null,
  bodyUserId?: string | null,
  bodyUserEmail?: string | null
): Promise<string | null> {
  // 1. Az API kulcshoz közvetlenül tartozó felhasználói fiók (akinek az accountjából küldik a kérést)
  if (authUserId) return authUserId;

  // 2. Ha az API kulcs alapján határozzuk meg a fiókot (user_id vagy created_by)
  if (apiKeyId) {
    const { data: keyRec } = await admin
      .from("api_keys")
      .select("user_id, created_by")
      .eq("id", apiKeyId)
      .maybeSingle();
    if (keyRec?.user_id) return keyRec.user_id;
    if (keyRec?.created_by) return keyRec.created_by;
  }

  // 3. Ha a külső kérés törzsében expliciten megadtak létező felhasználói azonosítót
  if (bodyUserId) {
    const { data: userProfile } = await admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", bodyUserId)
      .maybeSingle();
    if (userProfile?.user_id) return userProfile.user_id;
  }

  // 4. Ha a külső kérés törzsében expliciten megadtak létező email címet
  if (bodyUserEmail) {
    try {
      const { data: authUsers } = await admin.rpc("get_auth_emails");
      const matched = authUsers?.find((u: { id: string; email: string }) => u.email?.toLowerCase() === bodyUserEmail.trim().toLowerCase());
      if (matched?.id) return matched.id;
    } catch (_) {
      // Ha az RPC nem elérhető, fallback a céges tagokhoz
    }
  }

  // 5. Cégtulajdonos (owner) vagy cégtag
  if (companyId) {
    const { data: ownerMember } = await admin
      .from("company_members")
      .select("user_id")
      .eq("company_id", companyId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    if (ownerMember?.user_id) return ownerMember.user_id;

    // 6. Cég bármely adminisztrátora vagy tagja
    const { data: anyMember } = await admin
      .from("company_members")
      .select("user_id")
      .eq("company_id", companyId)
      .limit(1)
      .maybeSingle();

    if (anyMember?.user_id) return anyMember.user_id;
  }

  // 7. Végső védelmi háló: első aktív management / thinkai admin profil (feedback NOT NULL védelem)
  const { data: fallbackAdmin } = await admin
    .from("profiles")
    .select("user_id")
    .in("role", ["thinkai", "management"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallbackAdmin?.user_id) return fallbackAdmin.user_id;

  return null;
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

// ─── Help / OpenAPI Documentation ────────────────────
function getApiDocumentation() {
  return {
    api_name: "Visibill / eaisybill Customer REST API",
    version: "v2",
    base_url: "https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/customer-api",
    openapi_url: "https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/customer-api/v1/openapi.json",
    description: "Hivatalos programozási felület (M2M) cégadatok, számlák, partnerek, banki tranzakciók, kategóriák, NAV szinkron és kimutatások eléréséhez és kezeléséhez.",
    auth_header: "Authorization: Bearer vb_<40-hex-characters>",
    idempotency_header: "Idempotency-Key: <egyedi-uuid-vagy-kulcs> (opcionális POST/PATCH/DELETE hívásoknál az ismételt végrehajtás elkerülésére)",
    rate_limit: "Alapértelmezett 120 kérés/perc csúszóablakos korlát.",
    endpoints: {
      "GET /v1/openapi.json": {
        description: "Hivatalos, interaktív OpenAPI 3.0.3 specifikáció JSON formátumban (nincs szükség auth fejléc-re).",
      },
      "GET /v1/auth/me": {
        description: "Az aktív API kulcs introspekciója (jogosultságok, cég-hozzáférések, rate limit).",
      },
      "GET /v1/invoices": {
        description: "Számlák listázása szűréssel és lapozással (kimenő és bejövő/NAV számlák normalizált sémában). Támogatja a hiánylista lekérdezést has_image=false szűrővel.",
        query_params: ["company_id (kötelező, kivéve ha a kulcs egyetlen céghez van kötve)", "direction (all|inbound|outbound)", "date_from (YYYY-MM-DD)", "date_to (YYYY-MM-DD)", "has_image (true|false - false esetén HIÁNYLISTA)", "status (paid|unpaid|all)", "nav_status", "partner_tax_number", "page (default: 1)", "page_size (default: 50, max: 100)"],
      },
      "GET /v1/invoices/:id": {
        description: "Egy konkrét számla összes adata és számlaképe tételsorokkal (items) együtt.",
        query_params: ["company_id"],
      },
      "GET /v1/invoices/:id/image": {
        description: "Számlakép letöltési linkje (1 órás pre-signed URL) vagy közvetlen 302 átirányítás (?redirect=true).",
        query_params: ["company_id", "redirect (true|false)"],
      },
      "PATCH /v1/invoices/:id": {
        description: "Számla adatainak módosítása (bizonylatszám OCR-hiba javítása, számlakép és NAV tétel összekötése, fizetettség, kategória, projekt).",
        body_params: ["company_id", "invoice_number (bizonylatszám javítása)", "attachment_url (számlakép csatolása)", "file_base64 (közvetlen PDF feltöltés)", "is_paid (boolean)", "payment_date (YYYY-MM-DD)", "category_id (uuid)", "project_id (uuid)"],
        required_scope: "read_write",
      },
      "DELETE /v1/invoices/:id": {
        description: "Feltöltött számla törlése. NAV-szinkronizált számla esetén 409 Conflict hibát ad, kivéve ?force=true paraméterrel.",
        query_params: ["company_id", "force (true|false)"],
        required_scope: "read_write",
      },
      "POST /v1/invoices/upload": {
        description: "Számlakép (PDF vagy kép) feltöltése Base64 formátumban és opcionális azonnali párosítása meglévő NAV-tételhez.",
        body_params: ["company_id", "file_base64 (kötelező)", "nav_invoice_number (opcionális, azonnali NAV párosításhoz)", "file_name", "direction (INBOUND|OUTBOUND)"],
        required_scope: "read_write",
      },
      "POST /v1/invoices/link": {
        description: "Számlakép (dokumentum) és NAV-tétel közvetlen összekötése és bizonylatszám korrekció.",
        body_params: ["company_id", "invoice_id (vagy invoice_number)", "attachment_url (vagy source_invoice_id)", "target_invoice_number (opcionális)"],
        required_scope: "read_write",
      },
      "GET /v1/partners": {
        description: "Partnertörzs (vevők/szállítók) listázása és keresése.",
        query_params: ["company_id", "search", "page", "page_size"],
      },
      "POST /v1/partners": {
        description: "Új partner rögzítése.",
        body_params: ["company_id", "name", "tax_number", "address", "email", "bank_account_number", "partner_type"],
        required_scope: "read_write",
      },
      "PATCH /v1/partners/:id": {
        description: "Partner adatainak frissítése.",
        body_params: ["company_id", "name", "tax_number", "address", "email", "bank_account_number"],
        required_scope: "read_write",
      },
      "GET /v1/transactions": {
        description: "Banki tranzakciók lekérdezése számlapárosítási információkkal. Támogatja az is_matched=false és az unmatched_only=true szűrést.",
        query_params: ["company_id", "date_from", "date_to", "is_matched (true|false)", "unmatched_only (true|false)", "currency", "page", "page_size"],
      },
      "POST /v1/transactions/:id/match": {
        description: "Banki tranzakció kézi összerendelése számlával (szigorú létezés-ellenőrzéssel mindkét oldalon, hiány esetén 404).",
        body_params: ["company_id", "invoice_id (kötelező)"],
        required_scope: "read_write",
      },
      "POST /v1/transactions/:id/unmatch": {
        description: "Banki tranzakció számlapárosításának feloldása és fizetettség visszavonása.",
        required_scope: "read_write",
      },
      "DELETE /v1/transactions/:id/match": {
        description: "A POST /v1/transactions/:id/unmatch REST-megfelelője: párosítás törlése.",
        required_scope: "read_write",
      },
      "DELETE /v1/transactions/:id": {
        description: "Egyedi tranzakció törlése és kapcsolódó kötések feloldása.",
        required_scope: "read_write",
      },
      "POST /v1/transactions/bulk-delete": {
        description: "Tömeges tranzakció törlés (max. 500 ID).",
        body_params: ["company_id", "ids (string[])"],
        required_scope: "read_write",
      },
      "GET /v1/categories": {
        description: "Céghez tartozó kategóriák listája főkönyvi adatokkal.",
        query_params: ["company_id"],
      },
      "GET /v1/nav/status": {
        description: "NAV technikai felhasználó beállítások és legutóbbi szinkron naplók státusza.",
        query_params: ["company_id"],
      },
      "POST /v1/nav/sync": {
        description: "Manuális NAV számla szinkronizáció indítása megadott dátumtartományra és irányra.",
        body_params: ["company_id", "date_from (kötelező, YYYY-MM-DD)", "date_to (YYYY-MM-DD)", "direction ('inbound' | 'outbound' | 'both')", "fetch_details (boolean)"],
        required_scope: "read_write",
      },
      "GET /v1/projects": {
        description: "Aktív projektek és költségvetési keretek listája.",
        query_params: ["company_id"],
      },
      "POST /v1/projects": {
        description: "Új projekt rögzítése.",
        body_params: ["company_id", "name", "project_code", "budget", "description"],
        required_scope: "read_write",
      },
      "GET /v1/ledger": {
        description: "Sorszintű, kontírozott főkönyvi napló lekérdezése ERP feladáshoz.",
        query_params: ["company_id", "date_from", "date_to", "page", "page_size"],
      },
      "GET /v1/reports/vat": {
        description: "Időszaki ÁFA bevallási pozíció és számítási összefoglaló.",
        query_params: ["company_id", "period (YYYY-MM) vagy year (YYYY)"],
      },
      "GET /v1/reports/pnl": {
        description: "Éves eredménykimutatás (bevétel, költség, adózás előtti eredmény).",
        query_params: ["company_id", "year (YYYY)"],
      },
      "GET /v1/companies": {
        description: "Az API kulccsal elérhető összes cég listája.",
      },
      "GET /v1/company": {
        description: "Egy konkrét cég törzsadatai, beállításai, telephelyei és bankszámlái.",
        query_params: ["company_id"],
      },
      "GET /v1/tickets": {
        description: "A céghez tartozó hibajegyek listája státusz és prioritás szűréssel, lapozással.",
        query_params: ["company_id", "status", "priority", "type", "page", "page_size"],
      },
      "POST /v1/tickets": {
        description: "Új hibajegy nyitása a céghez.",
        body_params: ["company_id", "type (bug|feedback|question)", "message (kötelező)", "priority", "service", "page_url", "attachments"],
        required_scope: "read_write",
      },
      "GET /v1/tickets/:id": {
        description: "Egyedi hibajegy részletes adatlapja publikus hozzászólásokkal (UUID vagy EB-xxxx jegyszám alapján).",
        query_params: ["company_id"],
      },
      "POST /v1/tickets/:id/comments": {
        description: "Új hozzászólás / válasz beküldése meglévő hibajegyhez.",
        body_params: ["company_id", "message (kötelező)", "attachments"],
        required_scope: "read_write",
      },
      "POST /v1/tickets/:id/confirm-resolution": {
        description: "A support által kínált megoldás elfogadása és a hibajegy lezárása.",
        required_scope: "read_write",
      },
    },
  };
}

// ─── Main Handler ────────────────────────────────────
serve(async (req: Request) => {
  const startTime = Date.now();

  // 1. CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const userAgent = req.headers.get("user-agent") || "";
  const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

  // Parse path segments: e.g. /customer-api/v1/invoices -> ['v1', 'invoices']
  const normalizedPath = url.pathname.replace(/^\/customer-api/, "").replace(/\/+$/, "");
  const pathSegments = normalizedPath.split("/").filter(Boolean);
  const isV1Path = pathSegments.length > 0 && pathSegments[0] === "v1";

  // Check OpenAPI JSON endpoint (no auth required)
  if (
    normalizedPath === "/openapi.json" ||
    normalizedPath === "/v1/openapi.json" ||
    url.searchParams.get("action") === "openapi" ||
    url.searchParams.get("action") === "openapi.json"
  ) {
    return new Response(JSON.stringify(OPENAPI_SPEC, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }

  // Action resolution: path-based first, query parameter second
  let resource = isV1Path ? pathSegments[1] : (url.searchParams.get("action") || "help");
  const subResource = isV1Path ? pathSegments[2] : null;
  const subAction = isV1Path ? pathSegments[3] : null;

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

  // 2. Help action (No auth required)
  if (resource === "help" || resource === "docs" || (pathSegments.length === 0 && !url.searchParams.get("action") && req.method === "GET")) {
    return json({
      success: true,
      data: getApiDocumentation(),
    });
  }

  // 3. Authenticate API Key
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    const res = errorResponse("UNAUTHORIZED", "Hiányzó vagy érvénytelen Authorization fejléc. Használd: Bearer vb_<api_key>", 401);
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

  // Compute SHA-256 hash
  const keyHash = await sha256(bearerToken);

  // Authenticate via database RPC
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
  const rateLimit = auth.rate_limit_per_minute || 120;
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
  let requestBody: Record<string, any> = {};
  if (req.method === "POST" || req.method === "PATCH") {
    try {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const text = await req.text();
        if (text && text.trim().length > 0) {
          requestBody = JSON.parse(text);
        } else {
          requestBody = {};
        }
      }
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

  // 6. Check Idempotency-Key for mutating requests (POST, PATCH, DELETE)
  const idempotencyKey = req.headers.get("idempotency-key")?.trim();
  if (idempotencyKey && (req.method === "POST" || req.method === "PATCH" || req.method === "DELETE")) {
    const { data: cached } = await admin
      .from("api_idempotency_keys")
      .select("status_code, response_body")
      .eq("api_key_id", auth.key_id)
      .eq("idempotency_key", idempotencyKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify(cached.response_body), {
        status: cached.status_code,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Idempotency-Replayed": "true",
        },
      });
    }
  }

  // Helper: Verify write scope
  const requireWriteScope = (): Response | null => {
    if (auth.scope !== "read_write") {
      return errorResponse("FORBIDDEN_SCOPE", "A megadott API kulcs csak olvasási ('read') jogosultsággal rendelkezik. Módosításhoz 'read_write' scope szükséges.", 403);
    }
    return null;
  };

  // Helper: Verify company access
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
  let targetCompanyId: string | null = url.searchParams.get("company_id") || (requestBody?.company_id as string) || null;
  if (!targetCompanyId) {
    if (auth.company_id) {
      targetCompanyId = auth.company_id;
    } else if (accessibleCompanyIds.size === 1) {
      targetCompanyId = Array.from(accessibleCompanyIds)[0];
    }
  }

  try {
    // Normalize aliases: e.g. /v1/invoices vs ?action=invoices
    if (resource === "invoices" || resource === "invoice" || resource === "link_invoice" || resource === "upload_invoice") {
      // ──────────────────────────────────────────────────
      // DOMAIN: INVOICES
      // ──────────────────────────────────────────────────
      const invoiceId = (subResource && subResource !== "upload" && subResource !== "upload-url" && subResource !== "link") 
        ? subResource 
        : (url.searchParams.get("invoice_id") || (requestBody?.invoice_id as string));

      // CASE: Link attachment / fix invoice pairing (POST /v1/invoices/link or /v1/invoices/:id/link)
      if (req.method === "POST" && (subResource === "link" || subAction === "link" || resource === "link_invoice")) {
        const scopeErr = requireWriteScope();
        if (scopeErr) { response = scopeErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
            const targetId = (invoiceId && invoiceId !== "link") ? invoiceId : requestBody.invoice_id;
            const invoiceNumber = requestBody.invoice_number || requestBody.nav_invoice_number;
            const attachmentUrl = requestBody.attachment_url || requestBody.melleklet_url;
            const sourceInvoiceId = requestBody.source_invoice_id;

            let effectiveAttachmentUrl = attachmentUrl;
            if (!effectiveAttachmentUrl && sourceInvoiceId) {
              const { data: srcInv } = await admin
                .from("invoices")
                .select("melleklet_url, image_url")
                .eq("id", sourceInvoiceId)
                .maybeSingle();
              effectiveAttachmentUrl = srcInv?.melleklet_url || srcInv?.image_url;
            }

            const updates: Record<string, any> = { frissitve: new Date().toISOString() };
            if (requestBody.invoice_number !== undefined) updates.bizonylatsorszam = String(requestBody.invoice_number).trim();
            if (effectiveAttachmentUrl !== undefined) updates.melleklet_url = effectiveAttachmentUrl;
            if (requestBody.status !== undefined || requestBody.statusz !== undefined) {
              updates.statusz = requestBody.status || requestBody.statusz;
            }

            if (!targetId && !invoiceNumber) {
              response = errorResponse("MISSING_TARGET", "Add meg az 'invoice_id'-t vagy 'invoice_number'-t az összekötéshez.", 400);
            } else {
              let query = admin.from("invoices").update(updates).eq("company_id", targetCompanyId);
              if (targetId) {
                query = query.eq("id", targetId);
              } else if (invoiceNumber) {
                query = query.ilike("bizonylatsorszam", String(invoiceNumber).trim());
              }

              const { data: linkedInv, error: linkErr } = await query
                .select("id, bizonylatsorszam, statusz, nav_status, melleklet_url, image_url, frissitve")
                .maybeSingle();

              if (linkErr || !linkedInv) {
                response = errorResponse("LINK_FAILED", linkErr?.message || "Nem található a cél számla a megadott azonosítóval.", 404);
              } else {
                response = json({
                  success: true,
                  message: "Számlakép és NAV-tétel sikeresen összekötve / bizonylatszám javítva.",
                  data: {
                    invoice: {
                      id: linkedInv.id,
                      invoice_number: linkedInv.bizonylatsorszam,
                      status: linkedInv.statusz,
                      nav_status: linkedInv.nav_status,
                      has_image: Boolean(linkedInv.melleklet_url || linkedInv.image_url),
                      attachment_url: linkedInv.melleklet_url || linkedInv.image_url || null,
                      updated_at: linkedInv.frissitve,
                    }
                  },
                });
              }
            }
          }
        }
      }
      // CASE: Upload invoice PDF / image for OCR or direct NAV pairing
      else if (req.method === "POST" && (subResource === "upload" || resource === "upload_invoice")) {
        const scopeErr = requireWriteScope();
        if (scopeErr) { response = scopeErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
            const fileBase64 = requestBody.file_base64;
            const fileName = requestBody.file_name || `upload_${Date.now()}.pdf`;
            const direction = (requestBody.direction || "INBOUND").toUpperCase();
            const navInvoiceNumber = (requestBody.nav_invoice_number || requestBody.invoice_number || "").toString().trim();
            const targetInvoiceId = (requestBody.invoice_id || "").toString().trim();

            if (!fileBase64) {
              response = errorResponse("MISSING_FILE", "A 'file_base64' paraméter megadása kötelező.", 400);
            } else {
              try {
                // Decode base64 to binary
                const binaryStr = atob(fileBase64);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }

                const storagePath = `${auth.user_id}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                const { data: uploadData, error: uploadErr } = await admin.storage
                  .from("invoice-uploads")
                  .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });

                if (uploadErr) {
                  response = errorResponse("UPLOAD_FAILED", uploadErr.message, 500);
                } else {
                  const publicUrl = `${supabaseUrl}/storage/v1/object/public/invoice-uploads/${storagePath}`;

                  // Scenario 1: Target invoice ID explicitly given
                  if (targetInvoiceId) {
                    const { data: updatedById, error: updateByIdErr } = await admin
                      .from("invoices")
                      .update({ melleklet_url: publicUrl, frissitve: new Date().toISOString() })
                      .eq("id", targetInvoiceId)
                      .eq("company_id", targetCompanyId)
                      .select("id, bizonylatsorszam, statusz, nav_status, invoice_direction, melleklet_url, letrehozva")
                      .maybeSingle();

                    if (updatedById) {
                      response = json({
                        success: true,
                        message: "Számlakép sikeresen feltöltve és hozzárendelve a megadott számlához.",
                        data: {
                          matched: true,
                          invoice_id: updatedById.id,
                          invoice_number: updatedById.bizonylatsorszam,
                          has_image: true,
                          attachment_url: publicUrl,
                          status: updatedById.statusz,
                          nav_status: updatedById.nav_status,
                        },
                      }, 200);
                    } else {
                      response = errorResponse("INVOICE_NOT_FOUND", "A megadott számla nem található a cégnél.", 404);
                    }
                  }
                  // Scenario 2: NAV invoice number provided -> Attempt immediate matching
                  else if (navInvoiceNumber) {
                    const { data: existingInv } = await admin
                      .from("invoices")
                      .select("id, bizonylatsorszam, statusz, nav_status, invoice_direction, melleklet_url, letrehozva")
                      .eq("company_id", targetCompanyId)
                      .ilike("bizonylatsorszam", navInvoiceNumber)
                      .maybeSingle();

                    if (existingInv) {
                      const { data: updatedInv } = await admin
                        .from("invoices")
                        .update({ melleklet_url: publicUrl, frissitve: new Date().toISOString() })
                        .eq("id", existingInv.id)
                        .select("id, bizonylatsorszam, statusz, nav_status, invoice_direction, melleklet_url, letrehozva")
                        .single();

                      response = json({
                        success: true,
                        message: "Számlakép sikeresen feltöltve és azonnal összekapcsolva a meglévő NAV-tétellel.",
                        data: {
                          matched: true,
                          invoice_id: (updatedInv || existingInv).id,
                          invoice_number: (updatedInv || existingInv).bizonylatsorszam,
                          has_image: true,
                          attachment_url: publicUrl,
                          status: (updatedInv || existingInv).statusz,
                          nav_status: (updatedInv || existingInv).nav_status,
                        },
                      }, 200);
                    } else {
                      // Pre-insert invoice with that invoice_number ready for future NAV sync
                      const { data: newInv, error: insertErr } = await admin
                        .from("invoices")
                        .insert({
                          company_id: targetCompanyId,
                          user_id: auth.user_id,
                          invoice_direction: direction,
                          statusz: "feldolgozas_alatt",
                          nav_status: "pending_match",
                          melleklet_url: publicUrl,
                          bizonylatsorszam: navInvoiceNumber,
                          kibocsatas_datuma: new Date().toISOString().slice(0, 10),
                          teljesites_datuma: new Date().toISOString().slice(0, 10),
                          adoalap_osszesen: 0,
                          afa_osszeg_osszesen: 0,
                          brutto_vegosszeg: 0,
                        })
                        .select("id, bizonylatsorszam, statusz, nav_status, invoice_direction, melleklet_url, letrehozva")
                        .single();

                      if (insertErr) {
                        response = errorResponse("DB_INSERT_FAILED", insertErr.message, 500);
                      } else {
                        response = json({
                          success: true,
                          message: "Számlakép rögzítve a megadott bizonylatszámmal (NAV szinkronizációra előkészítve).",
                          data: {
                            matched: false,
                            invoice_id: newInv.id,
                            invoice_number: newInv.bizonylatsorszam,
                            has_image: true,
                            attachment_url: publicUrl,
                            status: newInv.statusz,
                            nav_status: newInv.nav_status,
                          },
                        }, 201);
                      }
                    }
                  }
                  // Scenario 3: Standard unlinked upload for OCR
                  else {
                    const { data: newInv, error: insertErr } = await admin
                      .from("invoices")
                      .insert({
                        company_id: targetCompanyId,
                        user_id: auth.user_id,
                        invoice_direction: direction,
                        statusz: "feldolgozas_alatt",
                        melleklet_url: publicUrl,
                        bizonylatsorszam: `UPLOAD-${Date.now().toString().slice(-6)}`,
                        kibocsatas_datuma: new Date().toISOString().slice(0, 10),
                        teljesites_datuma: new Date().toISOString().slice(0, 10),
                        adoalap_osszesen: 0,
                        afa_osszeg_osszesen: 0,
                        brutto_vegosszeg: 0,
                      })
                      .select("id, bizonylatsorszam, statusz, nav_status, invoice_direction, melleklet_url, letrehozva")
                      .single();

                    if (insertErr) {
                      response = errorResponse("DB_INSERT_FAILED", insertErr.message, 500);
                    } else {
                      response = json({
                        success: true,
                        message: "Számla sikeresen feltöltve, feldolgozás indítva.",
                        data: {
                          matched: false,
                          invoice_id: newInv.id,
                          invoice_number: newInv.bizonylatsorszam,
                          has_image: true,
                          attachment_url: publicUrl,
                          status: newInv.statusz,
                        },
                      }, 201);
                    }
                  }
                }
              } catch (decodeErr: any) {
                response = errorResponse("INVALID_BASE64", decodeErr.message || "Hibás base64 kódolás.", 400);
              }
            }
          }
        }
      }
      // CASE: Invoice image signed URL (GET /v1/invoices/:id/image or /v1/invoices/:id/download)
      else if (req.method === "GET" && invoiceId && (subAction === "image" || subAction === "download")) {
        const queryErr = validateQueryParams(url, ["invoice_id", "redirect"]);
        if (queryErr) { response = queryErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
            const { data: inv, error: invErr } = await admin
              .from("invoices")
              .select("id, bizonylatsorszam, melleklet_url, image_url")
              .eq("id", invoiceId)
              .eq("company_id", targetCompanyId)
              .maybeSingle();

            if (invErr || !inv) {
              response = errorResponse("INVOICE_NOT_FOUND", "A számla nem található a megadott cégnél.", 404);
            } else {
              const rawUrl = inv.melleklet_url || inv.image_url;
              if (!rawUrl) {
                response = errorResponse("IMAGE_NOT_FOUND", "A számlához nem tartozik csatolt számlakép vagy bizonylat.", 404);
              } else {
                let finalUrl = rawUrl;
                let expiresIn = 3600;

                const storageMatch = rawUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
                if (storageMatch) {
                  const bucket = storageMatch[1];
                  const objectPath = decodeURIComponent(storageMatch[2].split("?")[0]);
                  const { data: signedData } = await admin.storage.from(bucket).createSignedUrl(objectPath, expiresIn);
                  if (signedData?.signedUrl) {
                    finalUrl = signedData.signedUrl;
                  }
                }

                if (url.searchParams.get("redirect") === "true") {
                  response = new Response(null, {
                    status: 302,
                    headers: {
                      ...corsHeaders,
                      "Location": finalUrl,
                    },
                  });
                } else {
                  response = json({
                    success: true,
                    data: {
                      invoice_id: inv.id,
                      invoice_number: inv.bizonylatsorszam,
                      image_url: finalUrl,
                      expires_in_seconds: expiresIn,
                    }
                  });
                }
              }
            }
          }
        }
      }
      // CASE: Single invoice details with items (GET /v1/invoices/:id)
      else if (req.method === "GET" && invoiceId) {
        const queryErr = validateQueryParams(url, ["invoice_id"]);
        if (queryErr) { response = queryErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
            const [invRes, itemsRes] = await Promise.all([
            admin
              .from("invoices")
              .select("*")
              .eq("id", invoiceId)
              .eq("company_id", targetCompanyId)
              .maybeSingle(),
            admin
              .from("invoice_items")
              .select("*")
              .eq("invoice_id", invoiceId)
              .order("line_number", { ascending: true })
          ]);

          if (invRes.error || !invRes.data) {
            response = errorResponse("INVOICE_NOT_FOUND", "A számla nem található a megadott cégnél.", 404);
          } else {
            const inv = invRes.data;
            const attachment = inv.melleklet_url || inv.image_url || null;
            const isNavSynced = Boolean(inv.nav_status && inv.nav_status !== "missing_nav");

            response = json({
              success: true,
              data: {
                invoice: {
                  id: inv.id,
                  invoice_number: inv.bizonylatsorszam,
                  direction: (inv.invoice_direction || "INBOUND").toLowerCase(),
                  partner_name: (inv.invoice_direction || "").toUpperCase() === "OUTBOUND" ? (inv.vevo_nev || "") : (inv.elado_nev || ""),
                  partner_tax_number: (inv.invoice_direction || "").toUpperCase() === "OUTBOUND" ? inv.vevo_vat_id : inv.elado_vat_id,
                  gross_amount: inv.brutto_vegosszeg,
                  net_amount: inv.adoalap_osszesen,
                  currency: inv.penznem || "HUF",
                  is_paid: inv.fizetve || false,
                  issue_date: inv.kibocsatas_datuma,
                  fulfillment_date: inv.teljesites_datuma,
                  due_date: inv.fizetesi_hatarido,
                  has_image: Boolean(attachment),
                  attachment_url: attachment,
                  is_nav_synced: isNavSynced,
                  nav_status: inv.nav_status || null,
                  processing_status: inv.statusz || "feldolgozott",
                  supplier: {
                    name: inv.elado_nev,
                    tax_number: inv.elado_vat_id,
                    address: inv.elado_cim,
                  },
                  customer: {
                    name: inv.vevo_nev,
                    tax_number: inv.vevo_vat_id,
                    address: inv.vevo_cim,
                  },
                  amounts: {
                    net: inv.adoalap_osszesen,
                    vat: inv.afa_osszeg_osszesen,
                    gross: inv.brutto_vegosszeg,
                    payable: inv.fizetendo_osszeg ?? inv.brutto_vegosszeg,
                    currency: inv.penznem || "HUF",
                  },
                  payment: {
                    is_paid: inv.fizetve || false,
                    payment_method: inv.fizetesi_mod,
                    matched_transaction_id: inv.transaction_id || null,
                  },
                  category_id: inv.category_id,
                  project_id: inv.project_id,
                  status: inv.statusz,
                  created_at: inv.letrehozva,
                  items: (itemsRes.data || []).map((it: any) => ({
                    id: it.id,
                    line_number: it.line_number,
                    description: it.line_description,
                    quantity: it.quantity,
                    unit: it.unit_of_measure,
                    unit_price: it.unit_price,
                    net_amount: it.net_amount,
                    vat_rate: it.vat_rate,
                    vat_amount: it.vat_amount,
                    gross_amount: it.gross_amount,
                    product_code: it.product_code,
                  })),
                },
              },
            });
          }
        }
      }
    }
      // CASE: Update invoice details / fix OCR errors / pair image (PATCH /v1/invoices/:id)
      else if (req.method === "PATCH" && invoiceId) {
        const scopeErr = requireWriteScope();
        if (scopeErr) { response = scopeErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
            const updates: Record<string, any> = { frissitve: new Date().toISOString() };
            if (requestBody.is_paid !== undefined) updates.fizetve = Boolean(requestBody.is_paid);
            if (requestBody.payment_date !== undefined) {
              updates.manual_payment_date = requestBody.payment_date;
              updates.is_manual_payment = true;
            }
            if (requestBody.category_id !== undefined) updates.category_id = requestBody.category_id || null;
            if (requestBody.project_id !== undefined) updates.project_id = requestBody.project_id || null;
            
            // Fix OCR typo in invoice number
            if (requestBody.invoice_number !== undefined) {
              const num = String(requestBody.invoice_number).trim();
              if (!num) {
                response = errorResponse("VALIDATION_ERROR", "A bizonylatszám nem lehet üres.", 400);
                return;
              }
              updates.bizonylatsorszam = num;
            }

            // Link image URL
            if (requestBody.attachment_url !== undefined) {
              updates.melleklet_url = requestBody.attachment_url || null;
            }
            if (requestBody.status !== undefined || requestBody.statusz !== undefined) {
              updates.statusz = requestBody.status || requestBody.statusz;
            }

            // Direct base64 upload & link inside PATCH
            if (requestBody.file_base64) {
              try {
                const binaryStr = atob(requestBody.file_base64);
                const bytes = new Uint8Array(binaryStr.length);
                for (let i = 0; i < binaryStr.length; i++) {
                  bytes[i] = binaryStr.charCodeAt(i);
                }
                const fileName = requestBody.file_name || `patch_${Date.now()}.pdf`;
                const storagePath = `${auth.user_id}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                const { error: uploadErr } = await admin.storage
                  .from("invoice-uploads")
                  .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });

                if (!uploadErr) {
                  updates.melleklet_url = `${supabaseUrl}/storage/v1/object/public/invoice-uploads/${storagePath}`;
                }
              } catch {
                response = errorResponse("INVALID_BASE64", "Hibás base64 kép adat.", 400);
                return;
              }
            }

            const { data: updatedInv, error: patchErr } = await admin
              .from("invoices")
              .update(updates)
              .eq("id", invoiceId)
              .eq("company_id", targetCompanyId)
              .select("id, bizonylatsorszam, fizetve, category_id, project_id, statusz, nav_status, melleklet_url, image_url, frissitve")
              .maybeSingle();

            if (patchErr || !updatedInv) {
              response = errorResponse("UPDATE_FAILED", patchErr?.message || "Nem sikerült frissíteni a számlát.", 500);
            } else {
              response = json({
                success: true,
                message: "Számla adatai / bizonylatszáma / számlaképe sikeresen frissítve.",
                data: {
                  invoice: {
                    id: updatedInv.id,
                    invoice_number: updatedInv.bizonylatsorszam,
                    is_paid: updatedInv.fizetve,
                    category_id: updatedInv.category_id,
                    project_id: updatedInv.project_id,
                    status: updatedInv.statusz,
                    nav_status: updatedInv.nav_status,
                    has_image: Boolean(updatedInv.melleklet_url || updatedInv.image_url),
                    attachment_url: updatedInv.melleklet_url || updatedInv.image_url || null,
                    updated_at: updatedInv.frissitve,
                  }
                },
              });
            }
          }
        }
      }
      // CASE: Delete invoice (DELETE /v1/invoices/:id)
      else if (req.method === "DELETE" && invoiceId) {
        const queryErr = validateQueryParams(url, ["invoice_id", "force"]);
        if (queryErr) { response = queryErr; }
        else {
          const scopeErr = requireWriteScope();
          if (scopeErr) { response = scopeErr; }
          else {
            const accessErr = verifyCompanyAccess(targetCompanyId);
            if (accessErr) { response = accessErr; }
            else {
              const { data: invRecord, error: findInvErr } = await admin
                .from("invoices")
                .select("id, bizonylatsorszam, nav_status, transaction_id")
                .eq("id", invoiceId)
                .eq("company_id", targetCompanyId)
                .maybeSingle();

              if (findInvErr || !invRecord) {
                response = errorResponse("INVOICE_NOT_FOUND", "A számla nem található a megadott cégnél.", 404);
              } else {
                const isNavSynced = Boolean(invRecord.nav_status && invRecord.nav_status !== "missing_nav");
                const force = url.searchParams.get("force") === "true";

                if (isNavSynced && !force) {
                  response = errorResponse(
                    "NAV_INVOICE_CANNOT_BE_DELETED",
                    "A NAV által szinkronizált számla integritási okokból nem törölhető az adatbázisból. Csak manuálisan rögzített számlák törölhetők, vagy ?force=true paraméter szükséges.",
                    409,
                    { invoice_number: invRecord.bizonylatsorszam, nav_status: invRecord.nav_status }
                  );
                } else {
                  if (invRecord.transaction_id) {
                    await Promise.all([
                      admin.from("transactions").update({ matched_invoice_id: null, match_type: null, is_verified: false }).eq("id", invRecord.transaction_id),
                      admin.from("transaction_invoice_matches").delete().eq("invoice_id", invoiceId),
                    ]);
                  }

                  await admin.from("invoice_items").delete().eq("invoice_id", invoiceId);
                  const { error: delErr } = await admin.from("invoices").delete().eq("id", invoiceId).eq("company_id", targetCompanyId);

                  if (delErr) {
                    response = errorResponse("DELETE_FAILED", delErr.message, 500);
                  } else {
                    response = json({
                      success: true,
                      message: "Számla sikeresen törölve.",
                      data: { id: invoiceId, invoice_number: invRecord.bizonylatsorszam }
                    });
                  }
                }
              }
            }
          }
        }
      }
      // CASE: List invoices (GET /v1/invoices) with Missing-Image (Hiánylista) support
      else if (req.method === "GET") {
        const queryErr = validateQueryParams(url, ["direction", "date_from", "date_to", "status", "partner_tax_number", "has_image", "missing_image", "nav_status", "page", "page_size"]);
        if (queryErr) { response = queryErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
          const direction = url.searchParams.get("direction")?.toLowerCase() || "all";
          const dateFrom = url.searchParams.get("date_from");
          const dateTo = url.searchParams.get("date_to");
          const status = url.searchParams.get("status")?.toLowerCase();
          const partnerTaxNumber = url.searchParams.get("partner_tax_number");
          const hasImageParam = url.searchParams.get("has_image")?.toLowerCase();
          const navStatusParam = url.searchParams.get("nav_status")?.toLowerCase();
          const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
          const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "50", 10)));
          const offset = (page - 1) * pageSize;

          let query = admin
            .from("invoices")
            .select("id, bizonylatsorszam, invoice_direction, kibocsatas_datuma, teljesites_datuma, fizetesi_hatarido, elado_nev, elado_vat_id, elado_cim, vevo_nev, vevo_vat_id, vevo_cim, adoalap_osszesen, afa_osszeg_osszesen, brutto_vegosszeg, fizetendo_osszeg, penznem, fizetve, fizetesi_mod, category_id, project_id, statusz, nav_status, melleklet_url, image_url, letrehozva", { count: "exact" })
            .eq("company_id", targetCompanyId);

          if (direction === "inbound") query = query.ilike("invoice_direction", "inbound");
          if (direction === "outbound") query = query.ilike("invoice_direction", "outbound");
          if (dateFrom) query = query.gte("kibocsatas_datuma", dateFrom);
          if (dateTo) query = query.lte("kibocsatas_datuma", dateTo);
          if (status === "paid") query = query.eq("fizetve", true);
          if (status === "unpaid") query = query.eq("fizetve", false);
          if (partnerTaxNumber) {
            query = query.or(`elado_vat_id.ilike.%${partnerTaxNumber}%,vevo_vat_id.ilike.%${partnerTaxNumber}%`);
          }

          // Requirement b: Hiánylista (számlakép nélküli számlák szűrése)
          if (hasImageParam === "false" || url.searchParams.get("missing_image") === "true") {
            query = query.is("melleklet_url", null).is("image_url", null);
          } else if (hasImageParam === "true") {
            query = query.or("melleklet_url.not.is.null,image_url.not.is.null");
          }

          if (navStatusParam) {
            query = query.eq("nav_status", navStatusParam);
          }

          const { data: invoices, count, error: listErr } = await query
            .order("kibocsatas_datuma", { ascending: false })
            .range(offset, offset + pageSize - 1);

          if (listErr) {
            response = errorResponse("QUERY_FAILED", listErr.message, 500);
          } else {
            const normalizedInvoices = (invoices || []).map((inv: any) => {
              const attachment = inv.melleklet_url || inv.image_url || null;
              const isNavSynced = Boolean(inv.nav_status && inv.nav_status !== "missing_nav");
              return {
                id: inv.id,
                invoice_number: inv.bizonylatsorszam,
                direction: (inv.invoice_direction || "inbound").toLowerCase(),
                partner_name: (inv.invoice_direction || "").toUpperCase() === "OUTBOUND" ? (inv.vevo_nev || "") : (inv.elado_nev || ""),
                partner_tax_number: (inv.invoice_direction || "").toUpperCase() === "OUTBOUND" ? inv.vevo_vat_id : inv.elado_vat_id,
                gross_amount: inv.brutto_vegosszeg,
                net_amount: inv.adoalap_osszesen,
                currency: inv.penznem || "HUF",
                is_paid: inv.fizetve || false,
                issue_date: inv.kibocsatas_datuma,
                fulfillment_date: inv.teljesites_datuma,
                due_date: inv.fizetesi_hatarido,
                has_image: Boolean(attachment),
                attachment_url: attachment,
                is_nav_synced: isNavSynced,
                nav_status: inv.nav_status || null,
                processing_status: inv.statusz || "feldolgozott",
                supplier: {
                  name: inv.elado_nev,
                  tax_number: inv.elado_vat_id,
                  address: inv.elado_cim,
                },
                customer: {
                  name: inv.vevo_nev,
                  tax_number: inv.vevo_vat_id,
                  address: inv.vevo_cim,
                },
                amounts: {
                  net: inv.adoalap_osszesen,
                  vat: inv.afa_osszeg_osszesen,
                  gross: inv.brutto_vegosszeg,
                  payable: inv.fizetendo_osszeg ?? inv.brutto_vegosszeg,
                  currency: inv.penznem || "HUF",
                },
                payment: {
                  is_paid: inv.fizetve || false,
                  payment_method: inv.fizetesi_mod,
                },
                category_id: inv.category_id,
                project_id: inv.project_id,
                status: inv.statusz,
                created_at: inv.letrehozva,
              };
            });

            response = json({
              success: true,
              data: {
                invoices: normalizedInvoices,
                pagination: {
                  page,
                  page_size: pageSize,
                  total_items: count || 0,
                  total_pages: Math.ceil((count || 0) / pageSize),
                },
              },
            });
          }
        }
      }
    } else {
      response = errorResponse("METHOD_NOT_ALLOWED", "Nem támogatott HTTP metódus számlákhoz.", 405);
    }
    }
    // ──────────────────────────────────────────────────
    // DOMAIN: PARTNERS
    // ──────────────────────────────────────────────────
    else if (resource === "partners" || resource === "partner") {
      const partnerId = subResource || url.searchParams.get("partner_id");

      if (req.method === "GET") {
        const accessErr = verifyCompanyAccess(targetCompanyId);
        if (accessErr) { response = accessErr; }
        else {
          const search = url.searchParams.get("search");
          let query = admin
            .from("partners")
            .select("id, name, tax_number, partner_type, address, email, bank_account_number, created_at, updated_at")
            .eq("company_id", targetCompanyId);

          if (search) {
            query = query.or(`name.ilike.%${search}%,tax_number.ilike.%${search}%`);
          }

          const { data: partners, error: partErr } = await query.order("name", { ascending: true }).limit(100);
          if (partErr) { response = errorResponse("QUERY_FAILED", partErr.message, 500); }
          else {
            response = json({ success: true, data: { partners: partners || [], count: partners?.length || 0 } });
          }
        }
      } else if (req.method === "POST") {
        const scopeErr = requireWriteScope();
        if (scopeErr) { response = scopeErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else if (!requestBody.name) {
            response = errorResponse("MISSING_NAME", "A partner neve kötelező.", 400);
          } else {
            const { data: newPartner, error: createErr } = await admin
              .from("partners")
              .insert({
                company_id: targetCompanyId,
                user_id: auth.user_id,
                name: String(requestBody.name).trim(),
                tax_number: requestBody.tax_number ? String(requestBody.tax_number).trim() : null,
                partner_type: requestBody.partner_type || "both",
                address: requestBody.address ? String(requestBody.address).trim() : null,
                email: requestBody.email ? String(requestBody.email).trim() : null,
                bank_account_number: requestBody.bank_account_number ? String(requestBody.bank_account_number).trim() : null,
              })
              .select("*")
              .single();

            if (createErr) { response = errorResponse("CREATE_FAILED", createErr.message, 500); }
            else { response = json({ success: true, message: "Partner sikeresen létrehozva.", data: { partner: newPartner } }, 201); }
          }
        }
      } else if (req.method === "PATCH" && partnerId) {
        const scopeErr = requireWriteScope();
        if (scopeErr) { response = scopeErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
            const updates: Record<string, any> = { updated_at: new Date().toISOString() };
            if (requestBody.name) updates.name = String(requestBody.name).trim();
            if (requestBody.tax_number !== undefined) updates.tax_number = requestBody.tax_number;
            if (requestBody.address !== undefined) updates.address = requestBody.address;
            if (requestBody.email !== undefined) updates.email = requestBody.email;
            if (requestBody.bank_account_number !== undefined) updates.bank_account_number = requestBody.bank_account_number;

            const { data: updatedPart, error: updatePartErr } = await admin
              .from("partners")
              .update(updates)
              .eq("id", partnerId)
              .eq("company_id", targetCompanyId)
              .select("*")
              .single();

            if (updatePartErr) { response = errorResponse("UPDATE_FAILED", updatePartErr.message, 500); }
            else { response = json({ success: true, message: "Partner sikeresen frissítve.", data: { partner: updatedPart } }); }
          }
        }
      } else {
        response = errorResponse("METHOD_NOT_ALLOWED", "Nem támogatott HTTP metódus partnerekhez.", 405);
      }
    }
    // ──────────────────────────────────────────────────
    // DOMAIN: TRANSACTIONS
    // ──────────────────────────────────────────────────
    else if (resource === "transactions" || resource === "transaction") {
      const isBulkDelete = subResource === "bulk-delete";
      const transactionId = isBulkDelete ? null : (subResource || url.searchParams.get("transaction_id"));

      // Bulk delete transactions (POST /v1/transactions/bulk-delete)
      if (req.method === "POST" && isBulkDelete) {
        const queryErr = validateQueryParams(url, []);
        if (queryErr) { response = queryErr; }
        else {
          const scopeErr = requireWriteScope();
          if (scopeErr) { response = scopeErr; }
          else {
            const accessErr = verifyCompanyAccess(targetCompanyId);
            if (accessErr) { response = accessErr; }
            else {
              const ids: string[] = Array.isArray(requestBody.ids) ? requestBody.ids : [];
              if (ids.length === 0) {
                response = errorResponse("INVALID_PAYLOAD", "Az 'ids' tömb megadása kötelező és legalább 1 azonosítót kell tartalmaznia.", 400);
              } else if (ids.length > 500) {
                response = errorResponse("PAYLOAD_TOO_LARGE", "Egyszerre legfeljebb 500 tranzakció törölhető egyetlen kéréssel.", 400);
              } else {
                const { data: foundTxs, error: findErr } = await admin
                  .from("transactions")
                  .select("id, matched_invoice_id")
                  .eq("company_id", targetCompanyId)
                  .in("id", ids);

                if (findErr) {
                  response = errorResponse("QUERY_FAILED", findErr.message, 500);
                } else {
                  const foundIds = (foundTxs || []).map((t: any) => t.id);
                  const matchedInvoiceIds = (foundTxs || []).map((t: any) => t.matched_invoice_id).filter(Boolean);

                  if (foundIds.length > 0) {
                    if (matchedInvoiceIds.length > 0) {
                      await Promise.all([
                        admin.from("invoices").update({ transaction_id: null, fizetve: false }).in("id", matchedInvoiceIds).in("transaction_id", foundIds),
                        admin.from("nav_invoices").update({ transaction_id: null, paid: false }).in("id", matchedInvoiceIds).in("transaction_id", foundIds),
                        admin.from("salary").update({ transaction_id: null }).in("transaction_id", foundIds),
                        admin.from("transaction_invoice_matches").delete().in("transaction_id", foundIds),
                      ]);
                    }

                    const { error: delErr } = await admin
                      .from("transactions")
                      .delete()
                      .eq("company_id", targetCompanyId)
                      .in("id", foundIds);

                    if (delErr) {
                      response = errorResponse("DELETE_FAILED", delErr.message, 500);
                    } else {
                      response = json({
                        success: true,
                        message: `${foundIds.length} tranzakció sikeresen törölve.`,
                        data: {
                          requested_count: ids.length,
                          deleted_count: foundIds.length,
                          deleted_ids: foundIds,
                        }
                      });
                    }
                  } else {
                    response = json({
                      success: true,
                      message: "Nem található törölhető tranzakció a megadott azonosítókkal ennél a cégnél.",
                      data: {
                        requested_count: ids.length,
                        deleted_count: 0,
                        deleted_ids: [],
                      }
                    });
                  }
                }
              }
            }
          }
        }
      }
      // Unmatch transaction (POST /v1/transactions/:id/unmatch OR DELETE /v1/transactions/:id/match)
      else if (
        transactionId &&
        ((req.method === "POST" && subAction === "unmatch") || (req.method === "DELETE" && subAction === "match"))
      ) {
        const queryErr = validateQueryParams(url, ["transaction_id"]);
        if (queryErr) { response = queryErr; }
        else {
          const scopeErr = requireWriteScope();
          if (scopeErr) { response = scopeErr; }
          else {
            const accessErr = verifyCompanyAccess(targetCompanyId);
            if (accessErr) { response = accessErr; }
            else {
              const { data: txRecord, error: txErr } = await admin
                .from("transactions")
                .select("id, company_id, matched_invoice_id")
                .eq("id", transactionId)
                .eq("company_id", targetCompanyId)
                .maybeSingle();

              if (txErr || !txRecord) {
                response = errorResponse("TRANSACTION_NOT_FOUND", "A megadott tranzakció nem található a megadott cégnél.", 404, { transaction_id: transactionId });
              } else if (!txRecord.matched_invoice_id) {
                response = errorResponse("NOT_MATCHED", "A megadott tranzakció jelenleg nincs számlához párosítva.", 400, { transaction_id: transactionId });
              } else {
                const previousInvoiceId = txRecord.matched_invoice_id;
                await Promise.all([
                  admin
                    .from("transactions")
                    .update({ matched_invoice_id: null, match_type: null, is_verified: false })
                    .eq("id", transactionId)
                    .eq("company_id", targetCompanyId),
                  admin
                    .from("invoices")
                    .update({ transaction_id: null, fizetve: false })
                    .eq("id", previousInvoiceId)
                    .eq("transaction_id", transactionId),
                  admin
                    .from("nav_invoices")
                    .update({ transaction_id: null, paid: false })
                    .eq("id", previousInvoiceId)
                    .eq("transaction_id", transactionId),
                  admin
                    .from("salary")
                    .update({ transaction_id: null })
                    .eq("transaction_id", transactionId),
                  admin
                    .from("transaction_invoice_matches")
                    .delete()
                    .eq("transaction_id", transactionId),
                ]);

                response = json({
                  success: true,
                  message: "Párosítás sikeresen visszavonva.",
                  data: {
                    transaction_id: transactionId,
                    unmatched_invoice_id: previousInvoiceId,
                  }
                });
              }
            }
          }
        }
      }
      // Match transaction to invoice (POST /v1/transactions/:id/match) - Strict validation
      else if (req.method === "POST" && subAction === "match" && transactionId) {
        const queryErr = validateQueryParams(url, ["transaction_id"]);
        if (queryErr) { response = queryErr; }
        else {
          const scopeErr = requireWriteScope();
          if (scopeErr) { response = scopeErr; }
          else {
            const accessErr = verifyCompanyAccess(targetCompanyId);
            if (accessErr) { response = accessErr; }
            else if (!requestBody.invoice_id) {
              response = errorResponse("MISSING_INVOICE_ID", "Az 'invoice_id' megadása kötelező a párosításhoz.", 400);
            } else {
              const targetInvoiceId = String(requestBody.invoice_id).trim();

              // 1. Verify transaction exists and belongs to company
              const { data: txRecord, error: txErr } = await admin
                .from("transactions")
                .select("id, company_id, matched_invoice_id")
                .eq("id", transactionId)
                .eq("company_id", targetCompanyId)
                .maybeSingle();

              if (txErr || !txRecord) {
                response = errorResponse("TRANSACTION_NOT_FOUND", "A megadott tranzakció nem található a megadott cégnél.", 404, { transaction_id: transactionId });
              } else {
                // 2. Verify target invoice exists and belongs to company (check invoices, then nav_invoices)
                const { data: invRecord, error: invErr } = await admin
                  .from("invoices")
                  .select("id, company_id, bizonylatsorszam, brutto_vegosszeg, fizetve")
                  .eq("id", targetInvoiceId)
                  .eq("company_id", targetCompanyId)
                  .maybeSingle();

                let isNavTable = false;
                if (!invRecord) {
                  const { data: navInvRecord } = await admin
                    .from("nav_invoices")
                    .select("id, company_id, invoice_number, invoice_gross_amount, paid")
                    .eq("id", targetInvoiceId)
                    .eq("company_id", targetCompanyId)
                    .maybeSingle();

                  if (!navInvRecord) {
                    response = errorResponse("INVOICE_NOT_FOUND", "A megadott számla nem található a megadott cégnél.", 404, { invoice_id: targetInvoiceId });
                  } else {
                    isNavTable = true;
                  }
                }

                if (!response!) {
                  // Perform atomic link updates
                  const updatePromises: Promise<any>[] = [
                    admin
                      .from("transactions")
                      .update({ matched_invoice_id: targetInvoiceId, match_type: "manual", is_verified: true })
                      .eq("id", transactionId)
                      .eq("company_id", targetCompanyId),
                  ];

                  if (isNavTable) {
                    updatePromises.push(
                      admin
                        .from("nav_invoices")
                        .update({ transaction_id: transactionId, paid: true })
                        .eq("id", targetInvoiceId)
                        .eq("company_id", targetCompanyId)
                    );
                  } else {
                    updatePromises.push(
                      admin
                        .from("invoices")
                        .update({ transaction_id: transactionId, fizetve: true })
                        .eq("id", targetInvoiceId)
                        .eq("company_id", targetCompanyId)
                    );
                  }

                  updatePromises.push(
                    admin
                      .from("transaction_invoice_matches")
                      .upsert({
                        transaction_id: transactionId,
                        invoice_id: targetInvoiceId,
                        confidence_score: 1.0,
                        match_type: "manual",
                        status: "confirmed",
                        updated_at: new Date().toISOString(),
                      }, { onConflict: "transaction_id" })
                  );

                  await Promise.all(updatePromises);

                  response = json({
                    success: true,
                    message: "Tranzakció és számla sikeresen összerendelve.",
                    data: {
                      transaction_id: transactionId,
                      invoice_id: targetInvoiceId,
                      match_type: "manual",
                      is_verified: true,
                    }
                  });
                }
              }
            }
          }
        }
      }
      // Delete single transaction (DELETE /v1/transactions/:id)
      else if (req.method === "DELETE" && transactionId && !subAction) {
        const queryErr = validateQueryParams(url, ["transaction_id"]);
        if (queryErr) { response = queryErr; }
        else {
          const scopeErr = requireWriteScope();
          if (scopeErr) { response = scopeErr; }
          else {
            const accessErr = verifyCompanyAccess(targetCompanyId);
            if (accessErr) { response = accessErr; }
            else {
              const { data: txRecord, error: findErr } = await admin
                .from("transactions")
                .select("id, matched_invoice_id")
                .eq("id", transactionId)
                .eq("company_id", targetCompanyId)
                .maybeSingle();

              if (findErr || !txRecord) {
                response = errorResponse("TRANSACTION_NOT_FOUND", "A megadott tranzakció nem található a megadott cégnél.", 404, { transaction_id: transactionId });
              } else {
                if (txRecord.matched_invoice_id) {
                  await Promise.all([
                    admin.from("invoices").update({ transaction_id: null, fizetve: false }).eq("id", txRecord.matched_invoice_id).eq("transaction_id", transactionId),
                    admin.from("nav_invoices").update({ transaction_id: null, paid: false }).eq("id", txRecord.matched_invoice_id).eq("transaction_id", transactionId),
                    admin.from("salary").update({ transaction_id: null }).eq("transaction_id", transactionId),
                    admin.from("transaction_invoice_matches").delete().eq("transaction_id", transactionId),
                  ]);
                }

                const { error: delErr } = await admin
                  .from("transactions")
                  .delete()
                  .eq("id", transactionId)
                  .eq("company_id", targetCompanyId);

                if (delErr) {
                  response = errorResponse("DELETE_FAILED", delErr.message, 500);
                } else {
                  response = json({
                    success: true,
                    message: "Tranzakció sikeresen törölve.",
                    data: { id: transactionId }
                  });
                }
              }
            }
          }
        }
      }
      // List transactions (GET /v1/transactions) with unmatched_only alias and param validation
      else if (req.method === "GET") {
        const queryErr = validateQueryParams(url, ["date_from", "date_to", "is_matched", "unmatched_only", "currency", "page", "page_size"]);
        if (queryErr) { response = queryErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
            const dateFrom = url.searchParams.get("date_from");
            const dateTo = url.searchParams.get("date_to");
            const isMatchedParam = url.searchParams.get("is_matched");
            const unmatchedOnlyParam = url.searchParams.get("unmatched_only");
            const currencyParam = url.searchParams.get("currency");
            const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
            const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "50", 10)));
            const offset = (page - 1) * pageSize;

            // Handle unmatched_only alias and conflict check
            let effectiveIsMatched = isMatchedParam;
            if (unmatchedOnlyParam !== null) {
              const uBool = unmatchedOnlyParam.toLowerCase() === "true";
              if (isMatchedParam !== null) {
                const mBool = isMatchedParam.toLowerCase() === "true";
                if (uBool === mBool) {
                  response = errorResponse("CONFLICTING_PARAMETERS", "Az 'unmatched_only' és az 'is_matched' paraméterek ellentmondanak egymásnak.", 400);
                }
              }
              if (!response!) {
                effectiveIsMatched = uBool ? "false" : "true";
              }
            }

            if (!response!) {
              let query = admin
                .from("transactions")
                .select("id, transaction_date, description, amount, currency, type, matched_invoice_id, match_type, is_verified, created_at", { count: "exact" })
                .eq("company_id", targetCompanyId);

              if (dateFrom) query = query.gte("transaction_date", dateFrom);
              if (dateTo) query = query.lte("transaction_date", dateTo);
              if (effectiveIsMatched === "true") query = query.not("matched_invoice_id", "is", null);
              if (effectiveIsMatched === "false") query = query.is("matched_invoice_id", null);
              if (currencyParam) query = query.eq("currency", currencyParam.toUpperCase());

              const { data: txs, count, error: txErr } = await query
                .order("transaction_date", { ascending: false })
                .range(offset, offset + pageSize - 1);

              if (txErr) { response = errorResponse("QUERY_FAILED", txErr.message, 500); }
              else {
                const normalizedTxs = (txs || []).map((tx: any) => ({
                  id: tx.id,
                  transaction_date: tx.transaction_date,
                  booking_date: tx.transaction_date,
                  date: tx.transaction_date,
                  description: tx.description,
                  comment: tx.description,
                  amount: tx.amount,
                  currency: tx.currency,
                  type: tx.type,
                  matched_invoice_id: tx.matched_invoice_id,
                  is_matched: Boolean(tx.matched_invoice_id),
                  match_type: tx.match_type,
                  is_verified: tx.is_verified,
                  created_at: tx.created_at,
                }));

                response = json({
                  success: true,
                  data: {
                    transactions: normalizedTxs,
                    pagination: { page, page_size: pageSize, total_items: count || 0, total_pages: Math.ceil((count || 0) / pageSize) },
                  },
                });
              }
            }
          }
        }
      } else {
        response = errorResponse("METHOD_NOT_ALLOWED", "Nem támogatott metódus tranzakciókhoz.", 405);
      }
    }
    // ──────────────────────────────────────────────────
    // DOMAIN: GENERAL LEDGER (Főkönyvi napló)
    // ──────────────────────────────────────────────────
    else if (resource === "ledger" || resource === "general_ledger") {
      if (req.method === "GET") {
        const accessErr = verifyCompanyAccess(targetCompanyId);
        if (accessErr) { response = accessErr; }
        else {
          const dateFrom = url.searchParams.get("date_from");
          const dateTo = url.searchParams.get("date_to");
          const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
          const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "50", 10)));
          const offset = (page - 1) * pageSize;

          let headersQuery = admin
            .from("acc_journal_headers")
            .select("id, journal_number, document_id, posting_date, document_date, description, currency, status, entry_type, source", { count: "exact" })
            .eq("company_id", targetCompanyId);

          if (dateFrom) headersQuery = headersQuery.gte("posting_date", dateFrom);
          if (dateTo) headersQuery = headersQuery.lte("posting_date", dateTo);

          const { data: headers, count, error: hErr } = await headersQuery
            .order("posting_date", { ascending: false })
            .range(offset, offset + pageSize - 1);

          if (hErr) { response = errorResponse("QUERY_FAILED", hErr.message, 500); }
          else if (!headers || headers.length === 0) {
            response = json({ success: true, data: { ledger_entries: [], pagination: { page, page_size: pageSize, total_items: 0, total_pages: 0 } } });
          } else {
            const headerIds = headers.map((h: any) => h.id);
            const { data: lines } = await admin
              .from("acc_journal_lines")
              .select("id, header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description")
              .in("header_id", headerIds);

            const linesByHeader = new Map<string, any[]>();
            (lines || []).forEach((l: any) => {
              const arr = linesByHeader.get(l.header_id) || [];
              arr.push({
                id: l.id,
                sequence_number: l.sequence_number,
                gl_account_id: l.gl_account_id,
                side: l.dc_type === "T" ? "debit" : "credit",
                amount: l.amount,
                foreign_amount: l.foreign_amount,
                vat_code: l.vat_code,
                vat_role: l.vat_role,
                description: l.description,
              });
              linesByHeader.set(l.header_id, arr);
            });

            const entries = headers.map((h: any) => ({
              ...h,
              lines: linesByHeader.get(h.id) || [],
            }));

            response = json({
              success: true,
              data: {
                ledger_entries: entries,
                pagination: { page, page_size: pageSize, total_items: count || 0, total_pages: Math.ceil((count || 0) / pageSize) },
              },
            });
          }
        }
      } else {
        response = errorResponse("METHOD_NOT_ALLOWED", "A főkönyv csak GET metódussal kérdezhető le.", 405);
      }
    }
    // ──────────────────────────────────────────────────
    // DOMAIN: REPORTS (ÁFA & P&L)
    // ──────────────────────────────────────────────────
    else if (resource === "reports" || resource === "report") {
      const reportType = subResource || url.searchParams.get("report_type");

      if (reportType === "vat") {
        const queryErr = validateQueryParams(url, ["report_type", "period", "year", "month", "quarter"]);
        if (queryErr) { response = queryErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
            const period = url.searchParams.get("period"); // YYYY-MM
            const yearParam = url.searchParams.get("year");
            const monthParam = url.searchParams.get("month");
            const quarterParam = url.searchParams.get("quarter");

            let query = admin
              .from("vat_returns")
              .select("period_year, period_month, period_quarter, frequency, status, total_payable_tax, total_deductible_tax, net_result, amount_to_pay, amount_reclaimable, finalized_at")
              .eq("company_id", targetCompanyId);

            if (period && period.includes("-")) {
              const [y, m] = period.split("-");
              query = query.eq("period_year", parseInt(y, 10)).eq("period_month", parseInt(m, 10));
            } else if (yearParam) {
              query = query.eq("period_year", parseInt(yearParam, 10));
              if (monthParam) query = query.eq("period_month", parseInt(monthParam, 10));
              if (quarterParam) query = query.eq("period_quarter", parseInt(quarterParam, 10));
            }

            const { data: vatData, error: vatErr } = await query
              .order("period_year", { ascending: false })
              .order("period_month", { ascending: false })
              .limit(12);

            if (vatErr) { response = errorResponse("QUERY_FAILED", vatErr.message, 500); }
            else { response = json({ success: true, data: { vat_reports: vatData || [] } }); }
          }
        }
      } else if (reportType === "pnl") {
        const queryErr = validateQueryParams(url, ["report_type", "year"]);
        if (queryErr) { response = queryErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
            const year = url.searchParams.get("year") || String(new Date().getFullYear());
            const startDate = `${year}-01-01`;
            const endDate = `${year}-12-31`;

            const { data: invs, error: pnlErr } = await admin
              .from("invoices")
              .select("invoice_direction, adoalap_osszesen, penznem")
              .eq("company_id", targetCompanyId)
              .gte("kibocsatas_datuma", startDate)
              .lte("kibocsatas_datuma", endDate);

            if (pnlErr) { response = errorResponse("QUERY_FAILED", pnlErr.message, 500); }
            else {
              let totalRevenueHuf = 0;
              let totalExpenseHuf = 0;

              (invs || []).forEach((inv: any) => {
                const amount = Number(inv.adoalap_osszesen) || 0;
                if (inv.invoice_direction?.toUpperCase() === "OUTBOUND") {
                  totalRevenueHuf += amount;
                } else {
                  totalExpenseHuf += amount;
                }
              });

              const pnlData = {
                year: parseInt(year, 10),
                revenue_net: Math.round(totalRevenueHuf),
                expense_net: Math.round(totalExpenseHuf),
                operating_result_net: Math.round(totalRevenueHuf - totalExpenseHuf),
                currency: "HUF",
                invoice_count: invs?.length || 0,
              };

              response = json({
                success: true,
                data: {
                  ...pnlData,
                  pnl: pnlData,
                },
              });
            }
          }
        }
      } else {
        response = errorResponse("UNKNOWN_REPORT", "Ismeretlen riport típus. Használd: ?action=reports&report_type=vat vagy =pnl", 400);
      }
    }
    // ──────────────────────────────────────────────────
    // DOMAIN: CATEGORIES (Kategóriák)
    // ──────────────────────────────────────────────────
    else if (resource === "categories" || resource === "category") {
      if (req.method === "GET") {
        const queryErr = validateQueryParams(url, []);
        if (queryErr) { response = queryErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
            const { data: cats, error: catErr } = await admin
              .from("categories")
              .select("id, name, description, icon, color, gl_accounts, created_at, updated_at")
              .or(`company_id.eq.${targetCompanyId},company_id.is.null`)
              .order("name", { ascending: true });

            if (catErr) {
              response = errorResponse("QUERY_FAILED", catErr.message, 500);
            } else {
              response = json({
                success: true,
                data: {
                  categories: cats || [],
                  count: cats?.length || 0,
                },
              });
            }
          }
        }
      } else {
        response = errorResponse("METHOD_NOT_ALLOWED", "A kategóriák végpont csak GET metódust támogat.", 405);
      }
    }
    // ──────────────────────────────────────────────────
    // DOMAIN: NAV INTEGRATION STATUS
    // ──────────────────────────────────────────────────
    else if (resource === "nav") {
      if (req.method === "GET") {
        const queryErr = validateQueryParams(url, []);
        if (queryErr) { response = queryErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
            const [credRes, logsRes] = await Promise.all([
              admin
                .from("user_nav_credentials")
                .select("nav_username, nav_tax_number, is_test_environment, last_validated_at, validation_status, validation_error, auto_sync_enabled, sync_frequency")
                .eq("company_id", targetCompanyId)
                .maybeSingle(),
              admin
                .from("nav_sync_logs")
                .select("id, sync_type, invoice_direction, date_from, date_to, invoices_fetched, status, error_message, duration_ms, started_at, completed_at, created_at")
                .eq("company_id", targetCompanyId)
                .order("created_at", { ascending: false })
                .limit(5),
            ]);

            const cred = credRes.data;
            const logs = logsRes.data || [];
            const lastSync = logs.length > 0 ? logs[0] : null;

            let maskedUser = null;
            if (cred?.nav_username) {
              const u = cred.nav_username;
              maskedUser = u.length > 3 ? `${u.slice(0, 3)}***` : `${u}***`;
            }

            response = json({
              success: true,
              data: {
                company_id: targetCompanyId,
                nav_configured: Boolean(cred),
                is_configured: Boolean(cred),
                technical_user: maskedUser,
                nav_tax_number: cred?.nav_tax_number || null,
                environment: cred?.is_test_environment ? "test" : "production",
                auto_sync_enabled: cred?.auto_sync_enabled ?? false,
                sync_frequency: cred?.sync_frequency || null,
                last_validated_at: cred?.last_validated_at || null,
                validation_status: cred?.validation_status || "unknown",
                validation_error: cred?.validation_error || null,
                last_sync: lastSync ? {
                  timestamp: lastSync.created_at || lastSync.completed_at,
                  status: lastSync.status,
                  invoices_fetched: lastSync.invoices_fetched,
                  sync_type: lastSync.sync_type,
                  error: lastSync.error_message,
                } : null,
                recent_logs: logs,
                recent_syncs: logs,
              },
            });
          }
        }
      } else if (req.method === "POST" && (subResource === "sync" || !subResource)) {
        const queryErr = validateQueryParams(url, []);
        if (queryErr) { response = queryErr; }
        else {
          const scopeErr = requireWriteScope();
          if (scopeErr) { response = scopeErr; }
          else {
            const accessErr = verifyCompanyAccess(targetCompanyId);
            if (accessErr) { response = accessErr; }
            else {
              // 1. Validate date_from
              const dateFrom = String(requestBody.date_from || "").trim();
              if (!dateFrom) {
                response = errorResponse("MISSING_FIELD", "A 'date_from' (kezdő dátum: YYYY-MM-DD) mező megadása kötelező.", 400);
              } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || isNaN(Date.parse(dateFrom))) {
                response = errorResponse("VALIDATION_ERROR", "A 'date_from' formátuma érvénytelen. Elvárt formátum: YYYY-MM-DD (pl. 2026-04-01).", 400);
              } else {
                // 2. Validate date_to (defaults to today)
                const todayStr = new Date().toISOString().split("T")[0];
                const dateTo = requestBody.date_to ? String(requestBody.date_to).trim() : todayStr;
                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTo) || isNaN(Date.parse(dateTo))) {
                  response = errorResponse("VALIDATION_ERROR", "A 'date_to' formátuma érvénytelen. Elvárt formátum: YYYY-MM-DD (pl. 2026-04-30).", 400);
                } else if (dateTo < dateFrom) {
                  response = errorResponse("VALIDATION_ERROR", "A 'date_to' nem lehet korábbi dátum, mint a 'date_from'.", 400);
                } else {
                  // 3. Validate direction
                  const rawDir = String(requestBody.direction || "both").toLowerCase();
                  if (!["inbound", "outbound", "both"].includes(rawDir)) {
                    response = errorResponse("VALIDATION_ERROR", "A 'direction' mező értéke kizárólag 'inbound', 'outbound' vagy 'both' lehet.", 400);
                  } else {
                    const fetchDetails = requestBody.fetch_details !== false;
                    const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
                    const { data: recentSync } = await admin
                      .from("nav_sync_logs")
                      .select("id, started_at")
                      .eq("company_id", targetCompanyId)
                      .gte("started_at", sixtySecondsAgo)
                      .order("started_at", { ascending: false })
                      .limit(1)
                      .maybeSingle();

                    if (recentSync && recentSync.started_at) {
                      const startedAtMs = new Date(recentSync.started_at).getTime();
                      const waitSec = Math.max(1, Math.ceil((60_000 - (Date.now() - startedAtMs)) / 1000));
                      response = errorResponse(
                        "NAV_SYNC_COOLDOWN",
                        `A cégnél már folyamatban van egy NAV szinkronizáció, vagy nemrég fejeződött be. Kérjük, várj még ${waitSec} másodpercet az újabb lekérés előtt.`,
                        429,
                        { retry_after_seconds: waitSec }
                      );
                    } else {
                      const ingestionService = new NavIngestionService(admin);

                    try {
                      const effectiveUserId = auth.user_id || (targetCompanyId ? await resolveEffectiveUserId(admin, auth.user_id, targetCompanyId, auth.key_id) : null) || "system";
                      const credentials = await ingestionService.getCredentials(effectiveUserId, targetCompanyId || null);

                      let inboundResult: any = null;
                      let outboundResult: any = null;

                      if (rawDir === "inbound" || rawDir === "both") {
                        inboundResult = await ingestionService.executeSync({
                          userId: effectiveUserId,
                          companyId: targetCompanyId!,
                          direction: "INBOUND",
                          dateFrom,
                          dateTo,
                          fetchDetailedItems: fetchDetails,
                          syncType: "manual",
                        });
                      }

                      if (rawDir === "outbound" || rawDir === "both") {
                        outboundResult = await ingestionService.executeSync({
                          userId: effectiveUserId,
                          companyId: targetCompanyId!,
                          direction: "OUTBOUND",
                          dateFrom,
                          dateTo,
                          fetchDetailedItems: fetchDetails,
                          syncType: "manual",
                        });
                      }

                      const totalFetched = (inboundResult?.totalFetched || 0) + (outboundResult?.totalFetched || 0);
                      const totalInserted = (inboundResult?.totalInserted || 0) + (outboundResult?.totalInserted || 0);

                      response = json({
                        success: true,
                        message: "A manuális NAV szinkronizáció sikeresen lefutott.",
                        data: {
                          company_id: targetCompanyId,
                          date_from: dateFrom,
                          date_to: dateTo,
                          direction: rawDir,
                          inbound: inboundResult ? {
                            status: "completed",
                            total_fetched: inboundResult.totalFetched,
                            total_inserted: inboundResult.totalInserted,
                            sync_log_id: inboundResult.syncLogId || null,
                          } : null,
                          outbound: outboundResult ? {
                            status: "completed",
                            total_fetched: outboundResult.totalFetched,
                            total_inserted: outboundResult.totalInserted,
                            sync_log_id: outboundResult.syncLogId || null,
                          } : null,
                          total_invoices_fetched: totalFetched,
                          total_invoices_inserted: totalInserted,
                        },
                      });
                    } catch (navErr: any) {
                      const msg = navErr?.message || String(navErr);
                      if (msg.includes("Credentials not found") || msg.includes("nem találhatók")) {
                        response = errorResponse("NAV_NOT_CONFIGURED", "A megadott céghez nincsenek érvényes NAV technikai felhasználói adatok beállítva.", 422);
                      } else {
                        response = errorResponse("NAV_SYNC_FAILED", `NAV szinkronizációs hiba: ${msg}`, 502);
                      }
                    }
                  }
                }
              }
            }
          }
          }
        }
      } else {
        response = errorResponse("METHOD_NOT_ALLOWED", "A NAV végpont csak GET (/status) és POST (/sync) metódust támogat.", 405);
      }
    }
    // ──────────────────────────────────────────────────
    // DOMAIN: AUTH / ME (Kulcs Introspekció)
    // ──────────────────────────────────────────────────
    else if (resource === "auth" && (subResource === "me" || url.searchParams.get("action") === "auth_me")) {
      if (req.method === "GET") {
        const queryErr = validateQueryParams(url, []);
        if (queryErr) { response = queryErr; }
        else {
          const { data: compList } = await admin
            .from("companies")
            .select("id, name, tax_number")
            .in("id", Array.from(accessibleCompanyIds));

          const boundCompany = auth.company_id
            ? (compList || []).find((c: any) => c.id === auth.company_id) || { id: auth.company_id }
            : null;

          response = json({
            success: true,
            data: {
              key_id: auth.key_id,
              name: auth.name,
              scope: auth.scope,
              user_id: auth.user_id,
              bound_company_id: auth.company_id || null,
              company_id: auth.company_id || null,
              rate_limit_per_minute: auth.rate_limit_per_minute || 120,
              key: {
                id: auth.key_id,
                name: auth.name,
                scope: auth.scope,
                rate_limit_per_minute: auth.rate_limit_per_minute || 120,
              },
              company: boundCompany,
              accessible_companies: compList || [],
            },
          });
        }
      } else {
        response = errorResponse("METHOD_NOT_ALLOWED", "Csak GET metódus támogatott az auth introspekcióhoz.", 405);
      }
    }
    // ──────────────────────────────────────────────────
    // DOMAIN: PROJECTS
    // ──────────────────────────────────────────────────
    else if (resource === "projects" || resource === "project") {
      if (req.method === "GET") {
        const queryErr = validateQueryParams(url, []);
        if (queryErr) { response = queryErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
            const { data: projs, error: projErr } = await admin
              .from("projects")
              .select("id, name, project_code, description, status, budget, created_at")
              .eq("company_id", targetCompanyId)
              .order("name", { ascending: true });

            if (projErr) { response = errorResponse("QUERY_FAILED", projErr.message, 500); }
            else { response = json({ success: true, data: { projects: projs || [] } }); }
          }
        }
      } else if (req.method === "POST") {
        const queryErr = validateQueryParams(url, []);
        if (queryErr) { response = queryErr; }
        else {
          const scopeErr = requireWriteScope();
          if (scopeErr) { response = scopeErr; }
          else {
            const accessErr = verifyCompanyAccess(targetCompanyId);
            if (accessErr) { response = accessErr; }
            else if (!requestBody.name) {
              response = errorResponse("MISSING_NAME", "A projekt neve kötelező.", 400);
            } else {
              const { data: newProj, error: createProjErr } = await admin
                .from("projects")
                .insert({
                  company_id: targetCompanyId,
                  user_id: auth.user_id,
                  name: String(requestBody.name).trim(),
                  project_code: requestBody.project_code || null,
                  budget: requestBody.budget ? Number(requestBody.budget) : null,
                  description: requestBody.description || null,
                  status: requestBody.status || "active",
                })
                .select("*")
                .single();

              if (createProjErr) { response = errorResponse("CREATE_FAILED", createProjErr.message, 500); }
              else { response = json({ success: true, message: "Projekt sikeresen létrehozva.", data: { project: newProj } }, 201); }
            }
          }
        }
      } else {
        response = errorResponse("METHOD_NOT_ALLOWED", "Nem támogatott metódus projektekhez.", 405);
      }
    }
    // ──────────────────────────────────────────────────
    // DOMAIN: TICKETS (Support & Feedback)
    // ──────────────────────────────────────────────────
    else if (resource === "tickets" || resource === "ticket") {
      const ticketIdentifier = subResource || url.searchParams.get("ticket_id");

      // CASE: List tickets (GET /v1/tickets)
      if (req.method === "GET" && !ticketIdentifier) {
        const queryErr = validateQueryParams(url, ["status", "priority", "type", "page", "page_size"]);
        if (queryErr) { response = queryErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
            const statusParam = url.searchParams.get("status")?.toLowerCase();
            const priorityParam = url.searchParams.get("priority")?.toLowerCase();
            const typeParam = url.searchParams.get("type")?.toLowerCase();
            const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
            const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "20", 10)));
            const offset = (page - 1) * pageSize;

            let query = admin
              .from("feedback")
              .select("id, ticket_number, type, category, service, priority, status, message, company_id, company_name, user_email, user_name, page_url, attachments, waiting_for_user_confirmation, needs_staff_response, created_at, updated_at", { count: "exact" })
              .eq("company_id", targetCompanyId);

            if (statusParam && statusParam !== "all") {
              if (statusParam === "created" || statusParam === "open" || statusParam === "new") {
                query = query.in("status", ["created", "open", "new"]);
              } else {
                query = query.eq("status", statusParam);
              }
            }
            if (priorityParam) {
              query = query.eq("priority", priorityParam);
            }
            if (typeParam) {
              query = query.eq("type", typeParam);
            }

            const { data: tickets, count, error: listErr } = await query
              .order("created_at", { ascending: false })
              .range(offset, offset + pageSize - 1);

            if (listErr) {
              response = errorResponse("QUERY_FAILED", listErr.message, 500);
            } else {
              // Fetch comment counts for these tickets
              const ticketIds = (tickets || []).map((t: any) => t.id);
              let commentCounts: Record<string, number> = {};
              if (ticketIds.length > 0) {
                const { data: comments } = await admin
                  .from("ticket_comments")
                  .select("feedback_id")
                  .in("feedback_id", ticketIds)
                  .or("is_internal.is.null,is_internal.eq.false");
                (comments || []).forEach((c: any) => {
                  commentCounts[c.feedback_id] = (commentCounts[c.feedback_id] || 0) + 1;
                });
              }

              const normalizedTickets = (tickets || []).map((t: any) => ({
                id: t.id,
                ticket_number: t.ticket_number,
                type: t.type,
                service: t.service,
                priority: t.priority,
                status: t.status,
                message: t.message,
                page_url: t.page_url,
                attachments: t.attachments || [],
                comment_count: commentCounts[t.id] || 0,
                waiting_for_user_confirmation: Boolean(t.waiting_for_user_confirmation),
                needs_staff_response: Boolean(t.needs_staff_response),
                created_at: t.created_at,
                updated_at: t.updated_at,
              }));

              response = json({
                success: true,
                data: {
                  tickets: normalizedTickets,
                  pagination: {
                    page,
                    page_size: pageSize,
                    total_items: count || 0,
                    total_pages: Math.ceil((count || 0) / pageSize),
                  },
                },
              });
            }
          }
        }
      }
      // CASE: Create ticket (POST /v1/tickets)
      else if (req.method === "POST" && !ticketIdentifier) {
        const queryErr = validateQueryParams(url, []);
        if (queryErr) { response = queryErr; }
        else {
          const scopeErr = requireWriteScope();
          if (scopeErr) { response = scopeErr; }
          else {
            const accessErr = verifyCompanyAccess(targetCompanyId);
            if (accessErr) { response = accessErr; }
            else if (!requestBody.message || String(requestBody.message).trim().length === 0) {
              response = errorResponse("VALIDATION_ERROR", "A 'message' (leírás) mező megadása kötelező.", 400);
            } else {
              const allowedTypes = ["bug", "feedback", "question"];
              const ticketType = requestBody.type ? String(requestBody.type).toLowerCase() : "bug";
              if (!allowedTypes.includes(ticketType)) {
                response = errorResponse("VALIDATION_ERROR", `Érvénytelen 'type' mező: ${ticketType}. Megengedett értékek: ${allowedTypes.join(", ")}`, 400);
              } else {
                const allowedPriorities = ["low", "medium", "high", "critical"];
                const ticketPriority = requestBody.priority ? String(requestBody.priority).toLowerCase() : "medium";
                if (!allowedPriorities.includes(ticketPriority)) {
                  response = errorResponse("VALIDATION_ERROR", `Érvénytelen 'priority' mező: ${ticketPriority}. Megengedett értékek: ${allowedPriorities.join(", ")}`, 400);
                } else {
                  const effectiveUserId = await resolveEffectiveUserId(
                    admin,
                    auth.user_id,
                    targetCompanyId,
                    auth.key_id,
                    requestBody.user_id ? String(requestBody.user_id).trim() : null,
                    requestBody.user_email ? String(requestBody.user_email).trim() : null
                  );
                  if (!auth.user_id && effectiveUserId) {
                    auth.user_id = effectiveUserId;
                  }
                  if (!effectiveUserId) {
                    response = errorResponse("USER_CONTEXT_REQUIRED", "Nem található érvényes felhasználó vagy cégtulajdonos a hibajegy rögzítéséhez.", 400);
                  } else {
                    const [userRes, compRes] = await Promise.all([
                      admin.from("profiles").select("name").eq("user_id", effectiveUserId).maybeSingle(),
                      admin.from("companies").select("name").eq("id", targetCompanyId).maybeSingle(),
                    ]);

                    let resolvedUserEmail = requestBody.user_email ? String(requestBody.user_email).trim() : null;
                    if (!resolvedUserEmail) {
                      try {
                        const { data: authUser } = await admin.auth.admin.getUserById(effectiveUserId);
                        resolvedUserEmail = authUser?.user?.email || null;
                      } catch (_) {
                        // ignore
                      }
                    }

                    const ticketId = crypto.randomUUID();
                    const userName = requestBody.user_name || userRes.data?.name || auth.name || "API Felhasználó";
                    const userEmail = resolvedUserEmail;
                    const companyName = compRes.data?.name || null;

                    const { data: newTicket, error: insertErr } = await admin
                      .from("feedback")
                      .insert({
                        id: ticketId,
                        user_id: effectiveUserId,
                        created_by: effectiveUserId,
                        company_id: targetCompanyId,
                        company_name: companyName,
                        type: ticketType,
                        category: requestBody.category ? String(requestBody.category).trim() : null,
                        service: requestBody.service ? String(requestBody.service).toLowerCase() : "eaisybill",
                        priority: ticketPriority,
                        message: String(requestBody.message).trim(),
                        user_email: userEmail,
                        user_name: userName,
                        page_url: requestBody.page_url || null,
                        status: "created",
                        attachments: Array.isArray(requestBody.attachments) ? requestBody.attachments : [],
                      })
                      .select("id, ticket_number, type, category, service, priority, status, message, company_id, company_name, user_email, user_name, page_url, attachments, created_at, updated_at")
                      .single();

                    if (insertErr) {
                      response = errorResponse("CREATE_FAILED", insertErr.message, 500);
                    } else {
                      response = json({
                        success: true,
                        message: "Hibajegy sikeresen létrehozva.",
                        data: {
                          ticket: newTicket,
                        },
                      }, 201);
                    }
                  }
                }
              }
            }
          }
        }
      }
      // Helper for finding a ticket by UUID or ticket_number
      else if (ticketIdentifier) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticketIdentifier);
        let findQuery = admin
          .from("feedback")
          .select("id, ticket_number, type, service, priority, status, message, company_id, company_name, user_email, user_name, page_url, attachments, waiting_for_user_confirmation, needs_staff_response, created_at, updated_at")
          .eq("company_id", targetCompanyId);

        if (isUuid) {
          findQuery = findQuery.eq("id", ticketIdentifier);
        } else {
          findQuery = findQuery.ilike("ticket_number", ticketIdentifier.replace(/^#/, "").trim());
        }

        // CASE: Add comment (POST /v1/tickets/:id/comments)
        if (req.method === "POST" && subAction === "comments") {
          const queryErr = validateQueryParams(url, ["ticket_id"]);
          if (queryErr) { response = queryErr; }
          else {
            const scopeErr = requireWriteScope();
            if (scopeErr) { response = scopeErr; }
            else {
              const accessErr = verifyCompanyAccess(targetCompanyId);
              if (accessErr) { response = accessErr; }
              else if (!requestBody.message || String(requestBody.message).trim().length === 0) {
                response = errorResponse("VALIDATION_ERROR", "A 'message' (hozzászólás) mező megadása kötelező.", 400);
              } else {
                const { data: ticketRecord, error: findErr } = await findQuery.maybeSingle();
                if (findErr || !ticketRecord) {
                  response = errorResponse("TICKET_NOT_FOUND", "A hibajegy nem található a megadott cégnél.", 404);
                } else if (ticketRecord.status === "resolved" || ticketRecord.status === "closed") {
                  response = errorResponse(
                    "TICKET_CLOSED",
                    "A hibajegy már lezárásra került, ezért további hozzászólás nem küldhető hozzá. Kérjük, nyisson új hibajegyet a korábbi jegyszámra hivatkozva.",
                    400,
                    { ticket_id: ticketRecord.id, ticket_number: ticketRecord.ticket_number, status: ticketRecord.status }
                  );
                } else {
                  const effectiveUserId = await resolveEffectiveUserId(
                    admin,
                    auth.user_id,
                    targetCompanyId,
                    auth.key_id,
                    requestBody.user_id ? String(requestBody.user_id).trim() : null,
                    requestBody.user_email ? String(requestBody.user_email).trim() : null
                  );
                  if (!auth.user_id && effectiveUserId) {
                    auth.user_id = effectiveUserId;
                  }
                  if (!effectiveUserId) {
                    response = errorResponse("USER_CONTEXT_REQUIRED", "Nem található érvényes felhasználó vagy cégtulajdonos a hozzászólás rögzítéséhez.", 400);
                  } else {
                    const { data: userProfile } = await admin
                      .from("profiles")
                      .select("name")
                      .eq("user_id", effectiveUserId)
                      .maybeSingle();

                    let resolvedCommentEmail = requestBody.user_email ? String(requestBody.user_email).trim() : null;
                    if (!resolvedCommentEmail) {
                      try {
                        const { data: authUser } = await admin.auth.admin.getUserById(effectiveUserId);
                        resolvedCommentEmail = authUser?.user?.email || null;
                      } catch (_) {
                        // ignore
                      }
                    }

                    const commentId = crypto.randomUUID();
                    const { data: newComment, error: commentErr } = await admin
                      .from("ticket_comments")
                      .insert({
                        id: commentId,
                        feedback_id: ticketRecord.id,
                        user_id: effectiveUserId,
                        user_name: requestBody.user_name || userProfile?.name || auth.name || "API Felhasználó",
                        user_email: resolvedCommentEmail,
                        is_admin: false,
                        is_internal: false,
                        message: String(requestBody.message).trim(),
                        attachments: Array.isArray(requestBody.attachments) ? requestBody.attachments : [],
                      })
                      .select("id, feedback_id, user_id, user_name, user_email, is_admin, message, attachments, created_at")
                      .single();

                    if (commentErr) {
                      response = errorResponse("CREATE_FAILED", commentErr.message, 500);
                    } else {
                      await admin
                        .from("feedback")
                        .update({
                          needs_staff_response: true,
                          last_customer_message_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        })
                        .eq("id", ticketRecord.id);

                      response = json({
                        success: true,
                        message: "Hozzászólás sikeresen elküldve.",
                        data: { comment: newComment },
                      }, 201);
                    }
                  }
                }
              }
            }
          }
        }
        // CASE: Confirm resolution (POST /v1/tickets/:id/confirm-resolution OR resolve)
        else if (req.method === "POST" && (subAction === "confirm-resolution" || subAction === "resolve")) {
          const queryErr = validateQueryParams(url, ["ticket_id"]);
          if (queryErr) { response = queryErr; }
          else {
            const scopeErr = requireWriteScope();
            if (scopeErr) { response = scopeErr; }
            else {
              const accessErr = verifyCompanyAccess(targetCompanyId);
              if (accessErr) { response = accessErr; }
              else {
                const { data: ticketRecord, error: findErr } = await findQuery.maybeSingle();
                if (findErr || !ticketRecord) {
                  response = errorResponse("TICKET_NOT_FOUND", "A hibajegy nem található a megadott cégnél.", 404);
                } else {
                  const effectiveUserId = await resolveEffectiveUserId(admin, auth.user_id, targetCompanyId, auth.key_id);
                  if (!auth.user_id && effectiveUserId) {
                    auth.user_id = effectiveUserId;
                  }
                  const activeUserId = effectiveUserId || auth.user_id;

                  const { data: userProfile } = await admin
                    .from("profiles")
                    .select("name")
                    .eq("user_id", activeUserId)
                    .maybeSingle();

                  let userEmail: string | null = null;
                  try {
                    const { data: authUser } = await admin.auth.admin.getUserById(activeUserId);
                    userEmail = authUser?.user?.email || null;
                  } catch (_) {
                    // ignore
                  }

                  const userName = userProfile?.name || auth.name || "Ügyfél";

                  await Promise.all([
                    admin
                      .from("feedback")
                      .update({
                        status: "resolved",
                        waiting_for_user_confirmation: false,
                        resolution_confirmed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      })
                      .eq("id", ticketRecord.id),
                    admin
                      .from("ticket_comments")
                      .insert({
                        feedback_id: ticketRecord.id,
                        user_id: activeUserId,
                        user_name: userName,
                        user_email: userEmail,
                        is_admin: false,
                        is_internal: false,
                        message: "Az ügyfél API-n keresztül megerősítette: a probléma megoldódott. A hibajegy sikeresen lezárásra került.",
                      }),
                    admin
                      .from("ticket_events")
                      .insert({
                        feedback_id: ticketRecord.id,
                        actor_id: activeUserId,
                        actor_email: userEmail,
                        actor_name: userName,
                        event_type: "resolution_confirmed",
                        old_value: ticketRecord.status,
                        new_value: "resolved",
                        metadata: { source: "customer_api" },
                      }),
                  ]);

                  response = json({
                    success: true,
                    message: "Megoldás megerősítve, a hibajegy lezárásra került.",
                    data: {
                      id: ticketRecord.id,
                      ticket_number: ticketRecord.ticket_number,
                      status: "resolved",
                    },
                  });
                }
              }
            }
          }
        }
        // CASE: Single ticket details (GET /v1/tickets/:id)
        else if (req.method === "GET" && !subAction) {
          const queryErr = validateQueryParams(url, ["ticket_id"]);
          if (queryErr) { response = queryErr; }
          else {
            const accessErr = verifyCompanyAccess(targetCompanyId);
            if (accessErr) { response = accessErr; }
            else {
              const { data: ticketRecord, error: findErr } = await findQuery.maybeSingle();
              if (findErr || !ticketRecord) {
                response = errorResponse("TICKET_NOT_FOUND", "A hibajegy nem található a megadott cégnél.", 404);
              } else {
                // Comments: strictly public only
                const { data: comments, error: commErr } = await admin
                  .from("ticket_comments")
                  .select("id, feedback_id, user_id, user_name, user_email, is_admin, message, attachments, created_at")
                  .eq("feedback_id", ticketRecord.id)
                  .or("is_internal.is.null,is_internal.eq.false")
                  .order("created_at", { ascending: true });

                if (commErr) {
                  response = errorResponse("QUERY_FAILED", commErr.message, 500);
                } else {
                  response = json({
                    success: true,
                    data: {
                      ticket: {
                        id: ticketRecord.id,
                        ticket_number: ticketRecord.ticket_number,
                        type: ticketRecord.type,
                        service: ticketRecord.service,
                        priority: ticketRecord.priority,
                        status: ticketRecord.status,
                        message: ticketRecord.message,
                        page_url: ticketRecord.page_url,
                        attachments: ticketRecord.attachments || [],
                        waiting_for_user_confirmation: Boolean(ticketRecord.waiting_for_user_confirmation),
                        needs_staff_response: Boolean(ticketRecord.needs_staff_response),
                        created_at: ticketRecord.created_at,
                        updated_at: ticketRecord.updated_at,
                      },
                      comments: comments || [],
                    },
                  });
                }
              }
            }
          }
        } else {
          response = errorResponse("METHOD_NOT_ALLOWED", "Nem támogatott metódus vagy alútvonal hibajegyekhez.", 405);
        }
      } else {
        response = errorResponse("METHOD_NOT_ALLOWED", "Nem támogatott metódus hibajegyekhez.", 405);
      }
    }
    // ──────────────────────────────────────────────────
    // DOMAIN: COMPANIES & COMPANY MASTER DATA (Legacy / Base)
    // ──────────────────────────────────────────────────
    else if (resource === "companies") {
      const queryErr = validateQueryParams(url, []);
      if (queryErr) { response = queryErr; }
      else if (accessibleCompanyIds.size === 0) {
        response = json({ success: true, data: { companies: [], count: 0 } });
      } else {
        const { data: companies, error: compErr } = await admin
          .from("companies")
          .select("id, name, tax_number, address, vat_regime, vat_regime_effective_from, description, primary_teaor, created_at, updated_at")
          .in("id", Array.from(accessibleCompanyIds))
          .order("name", { ascending: true });

        if (compErr) { response = errorResponse("QUERY_FAILED", compErr.message, 500); }
        else { response = json({ success: true, data: { companies: companies || [], count: companies?.length || 0, key_scope: auth.scope } }); }
      }
    } else if (resource === "company") {
      const queryErr = validateQueryParams(url, []);
      if (queryErr) { response = queryErr; }
      else {
        const accessErr = verifyCompanyAccess(targetCompanyId);
        if (accessErr) { response = accessErr; }
        else {
          const [companyRes, settingsRes, locationsRes, bankAccountsRes] = await Promise.all([
            admin.from("companies").select("*").eq("id", targetCompanyId).maybeSingle(),
            admin.from("company_settings").select("*").eq("company_id", targetCompanyId).maybeSingle(),
            admin.from("company_locations").select("*").eq("company_id", targetCompanyId).order("is_default", { ascending: false }),
            admin.from("company_bank_accounts").select("*").eq("company_id", targetCompanyId),
          ]);

          if (companyRes.error || !companyRes.data) {
            response = errorResponse("COMPANY_NOT_FOUND", "A megadott cég nem található.", 404);
          } else {
            response = json({
              success: true,
              data: {
                company: companyRes.data,
                settings: settingsRes.data || {},
                locations: locationsRes.data || [],
                bank_accounts: bankAccountsRes.data || [],
              },
            });
          }
        }
      }
    } else if (resource === "update_company") {
      const scopeErr = requireWriteScope();
      if (scopeErr) { response = scopeErr; }
      else {
        const accessErr = verifyCompanyAccess(targetCompanyId);
        if (accessErr) { response = accessErr; }
        else {
          const updates: Record<string, any> = { updated_at: new Date().toISOString() };
          if (requestBody.name !== undefined) updates.name = String(requestBody.name).trim();
          if (requestBody.tax_number !== undefined) {
            const taxStr = String(requestBody.tax_number).trim();
            if (taxStr && !validateTaxNumber(taxStr)) {
              response = errorResponse("VALIDATION_ERROR", "Érvénytelen magyar adószám formátum (pl. 12345678-1-23).", 400);
            } else {
              updates.tax_number = taxStr || null;
            }
          }
          if (requestBody.address !== undefined) updates.address = String(requestBody.address).trim() || null;
          if (requestBody.description !== undefined) updates.description = String(requestBody.description).trim() || null;
          if (requestBody.primary_teaor !== undefined) updates.primary_teaor = String(requestBody.primary_teaor).trim() || null;
          if (requestBody.vat_regime !== undefined) updates.vat_regime = String(requestBody.vat_regime).toLowerCase().trim();

          if (!response!) {
            const { data: updatedComp, error: updateErr } = await admin
              .from("companies")
              .update(updates)
              .eq("id", targetCompanyId)
              .select("*")
              .single();

            if (updateErr) { response = errorResponse("UPDATE_FAILED", updateErr.message, 500); }
            else { response = json({ success: true, message: "Cégadatok sikeresen frissítve.", data: { company: updatedComp } }); }
          }
        }
      }
    } else if (resource === "update_settings") {
      const scopeErr = requireWriteScope();
      if (scopeErr) { response = scopeErr; }
      else {
        const accessErr = verifyCompanyAccess(targetCompanyId);
        if (accessErr) { response = accessErr; }
        else {
          const settingsPayload: Record<string, any> = {
            company_id: targetCompanyId,
            updated_at: new Date().toISOString(),
          };
          if (requestBody.work_start_time !== undefined) settingsPayload.work_start_time = requestBody.work_start_time;
          if (requestBody.work_end_time !== undefined) settingsPayload.work_end_time = requestBody.work_end_time;
          if (requestBody.admin_deadline !== undefined) settingsPayload.admin_deadline = requestBody.admin_deadline;
          if (requestBody.monthly_working_hours !== undefined) settingsPayload.monthly_working_hours = requestBody.monthly_working_hours;
          if (requestBody.gl_date_basis !== undefined) settingsPayload.gl_date_basis = requestBody.gl_date_basis;

          const { data: updatedSettings, error: upsertErr } = await admin
            .from("company_settings")
            .upsert(settingsPayload, { onConflict: "company_id" })
            .select("*")
            .single();

          if (upsertErr) { response = errorResponse("UPDATE_FAILED", upsertErr.message, 500); }
          else { response = json({ success: true, message: "Cégbeállítások sikeresen mentve.", data: { settings: updatedSettings } }); }
        }
      }
    } else {
      response = errorResponse("UNKNOWN_RESOURCE", `Ismeretlen végpont: '${resource}'. Használd a ?action=help végpontot a leíráshoz vagy tekintsd meg az /v1/openapi.json specifikációt.`, 404);
    }
  } catch (err: any) {
    console.error("[CUSTOMER-API] Execution error:", err);
    response = errorResponse("INTERNAL_ERROR", "Váratlan szerverhiba történt az API kérés feldolgozása közben.", 500, err?.message);
  }

  // 6. Log request to api_request_logs
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
    errorMessage: (response as any)?._errorMessage || (response.status >= 400 ? `Status ${response.status}` : null),
    durationMs,
  });

  // 7. Save Idempotency response if key was provided and operation succeeded (200..499)
  if (
    idempotencyKey &&
    lastResponsePayload &&
    (req.method === "POST" || req.method === "PATCH" || req.method === "DELETE") &&
    response.status >= 200 && response.status < 500
  ) {
    try {
      await admin.from("api_idempotency_keys").upsert({
        api_key_id: auth.key_id,
        idempotency_key: idempotencyKey,
        endpoint: url.pathname,
        request_hash: await sha256(JSON.stringify(requestBody || {})),
        status_code: response.status,
        response_body: lastResponsePayload,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }, { onConflict: "api_key_id,idempotency_key" });
    } catch (idempErr) {
      console.error("[CUSTOMER-API] Failed to store idempotency key:", idempErr);
    }
  }

  return response;
});
