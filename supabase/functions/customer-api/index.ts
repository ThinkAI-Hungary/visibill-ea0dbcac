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
  const regex = /^(HU)?\d{8}-?[1-5]-?\d{2}$/i;
  return regex.test(taxNumber.trim());
}

function validateTime(timeStr: string): boolean {
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

// ─── Help / OpenAPI Documentation ────────────────────
function getApiDocumentation() {
  return {
    api_name: "Visibill / eaisybill Customer REST API",
    version: "v2",
    base_url: "https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/customer-api",
    description: "Hivatalos programozási felület (M2M) cégadatok, számlák, partnerek, banki tranzakciók, főkönyvi adatok és kimutatások eléréséhez és kezeléséhez.",
    auth_header: "Authorization: Bearer vb_<40-hex-characters>",
    rate_limit: "Alapértelmezett 120 kérés/perc csúszóablakos korlát.",
    endpoints: {
      "GET /v1/invoices": {
        description: "Számlák listázása szűréssel és lapozással (kimenő és bejövő/NAV számlák normalizált sémában).",
        query_params: ["company_id (kötelező)", "direction (all|inbound|outbound)", "date_from (YYYY-MM-DD)", "date_to (YYYY-MM-DD)", "status (paid|unpaid|all)", "partner_tax_number", "page (default: 1)", "page_size (default: 50, max: 100)"],
      },
      "GET /v1/invoices/:id": {
        description: "Egy konkrét számla összes adata tételsorokkal (items) együtt.",
        query_params: ["company_id (kötelező)"],
      },
      "PATCH /v1/invoices/:id": {
        description: "Számla adatainak módosítása (fizetettség, kategória, projekt).",
        body_params: ["company_id", "is_paid (boolean)", "payment_date (YYYY-MM-DD)", "category_id (uuid)", "project_id (uuid)"],
        required_scope: "read_write",
      },
      "POST /v1/invoices/upload": {
        description: "Számla PDF / kép feltöltése automatikus OCR feldolgozásra.",
        body_params: ["company_id", "file_base64", "file_name", "direction (INBOUND|OUTBOUND)"],
        required_scope: "read_write",
      },
      "GET /v1/partners": {
        description: "Partnertörzs (vevők/szállítók) listázása és keresése.",
        query_params: ["company_id (kötelező)", "search", "page", "page_size"],
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
        description: "Banki tranzakciók lekérdezése számlapárosítási információkkal.",
        query_params: ["company_id (kötelező)", "date_from", "date_to", "is_matched (true|false)", "currency", "page", "page_size"],
      },
      "POST /v1/transactions/:id/match": {
        description: "Banki tranzakció kézi összerendelése számlával.",
        body_params: ["company_id", "invoice_id"],
        required_scope: "read_write",
      },
      "GET /v1/projects": {
        description: "Aktív projektek és költségvetési keretek listája.",
        query_params: ["company_id (kötelező)"],
      },
      "POST /v1/projects": {
        description: "Új projekt rögzítése.",
        body_params: ["company_id", "name", "project_code", "budget", "description"],
        required_scope: "read_write",
      },
      "GET /v1/ledger": {
        description: "Sorszintű, kontírozott főkönyvi napló lekérdezése ERP feladáshoz.",
        query_params: ["company_id (kötelező)", "date_from", "date_to", "page", "page_size"],
      },
      "GET /v1/reports/vat": {
        description: "Időszaki ÁFA bevallási pozíció és számítási összefoglaló.",
        query_params: ["company_id (kötelező)", "period (YYYY-MM)"],
      },
      "GET /v1/reports/pnl": {
        description: "Éves eredménykimutatás (bevétel, költség, adózás előtti eredmény).",
        query_params: ["company_id (kötelező)", "year (YYYY)"],
      },
      "GET /v1/companies": {
        description: "Az API kulccsal elérhető összes cég listája.",
      },
      "GET /v1/company": {
        description: "Egy konkrét cég törzsadatai, beállításai, telephelyei és bankszámlái.",
        query_params: ["company_id (kötelező)"],
      },
    },
  };
}

// ─── Main Handler ────────────────────────────────────
serve(async (req) => {
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
        requestBody = await req.json();
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
    if (resource === "invoices" || resource === "invoice") {
      // ──────────────────────────────────────────────────
      // DOMAIN: INVOICES
      // ──────────────────────────────────────────────────
      const invoiceId = (subResource && subResource !== "upload" && subResource !== "upload-url") 
        ? subResource 
        : (url.searchParams.get("invoice_id") || (requestBody?.invoice_id as string));

      // CASE: Upload invoice PDF / image for OCR
      if (req.method === "POST" && (subResource === "upload" || resource === "upload_invoice")) {
        const scopeErr = requireWriteScope();
        if (scopeErr) { response = scopeErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else {
            const fileBase64 = requestBody.file_base64;
            const fileName = requestBody.file_name || `api_upload_${Date.now()}.pdf`;
            const direction = (requestBody.direction || "INBOUND").toUpperCase();

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

                const storagePath = `${targetCompanyId}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                const { data: uploadData, error: uploadErr } = await admin.storage
                  .from("documents")
                  .upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });

                if (uploadErr) {
                  response = errorResponse("UPLOAD_FAILED", uploadErr.message, 500);
                } else {
                  // Insert placeholder in invoices table
                  const { data: newInv, error: insertErr } = await admin
                    .from("invoices")
                    .insert({
                      company_id: targetCompanyId,
                      user_id: auth.user_id,
                      invoice_direction: direction,
                      statusz: "feldolgozas_alatt",
                      melleklet_url: uploadData?.path,
                      bizonylatsorszam: `UPLOAD-${Date.now().toString().slice(-6)}`,
                      kibocsatas_datuma: new Date().toISOString().slice(0, 10),
                      teljesites_datuma: new Date().toISOString().slice(0, 10),
                      adoalap_osszesen: 0,
                      afa_osszeg_osszesen: 0,
                      brutto_vegosszeg: 0,
                    })
                    .select("id, bizonylatsorszam, statusz, invoice_direction, created_at")
                    .single();

                  if (insertErr) {
                    response = errorResponse("DB_INSERT_FAILED", insertErr.message, 500);
                  } else {
                    response = json({
                      success: true,
                      message: "Számla sikeresen feltöltve, feldolgozás indítva.",
                      data: { invoice: newInv, storage_path: uploadData?.path },
                    }, 201);
                  }
                }
              } catch (decodeErr: any) {
                response = errorResponse("INVALID_BASE64", decodeErr.message || "Hibás base64 kódolás.", 400);
              }
            }
          }
        }
      }
      // CASE: Single invoice details with items (GET /v1/invoices/:id)
      else if (req.method === "GET" && invoiceId) {
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
                  nav_status: inv.nav_status,
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
      // CASE: Update invoice status / category / project (PATCH /v1/invoices/:id)
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

            const { data: updatedInv, error: patchErr } = await admin
              .from("invoices")
              .update(updates)
              .eq("id", invoiceId)
              .eq("company_id", targetCompanyId)
              .select("id, bizonylatsorszam, fizetve, category_id, project_id, frissitve")
              .maybeSingle();

            if (patchErr || !updatedInv) {
              response = errorResponse("UPDATE_FAILED", patchErr?.message || "Nem sikerült frissíteni a számlát.", 500);
            } else {
              response = json({
                success: true,
                message: "Számla sikeresen frissítve.",
                data: { invoice: updatedInv },
              });
            }
          }
        }
      }
      // CASE: List invoices (GET /v1/invoices)
      else if (req.method === "GET") {
        const accessErr = verifyCompanyAccess(targetCompanyId);
        if (accessErr) { response = accessErr; }
        else {
          const direction = url.searchParams.get("direction")?.toLowerCase() || "all";
          const dateFrom = url.searchParams.get("date_from");
          const dateTo = url.searchParams.get("date_to");
          const status = url.searchParams.get("status")?.toLowerCase();
          const partnerTaxNumber = url.searchParams.get("partner_tax_number");
          const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
          const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "50", 10)));
          const offset = (page - 1) * pageSize;

          let query = admin
            .from("invoices")
            .select("id, bizonylatsorszam, invoice_direction, kibocsatas_datuma, teljesites_datuma, fizetesi_hatarido, elado_nev, elado_vat_id, elado_cim, vevo_nev, vevo_vat_id, vevo_cim, adoalap_osszesen, afa_osszeg_osszesen, brutto_vegosszeg, fizetendo_osszeg, penznem, fizetve, fizetesi_mod, category_id, project_id, statusz, nav_status, letrehozva", { count: "exact" })
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

          const { data: invoices, count, error: listErr } = await query
            .order("kibocsatas_datuma", { ascending: false })
            .range(offset, offset + pageSize - 1);

          if (listErr) {
            response = errorResponse("QUERY_FAILED", listErr.message, 500);
          } else {
            const normalizedInvoices = (invoices || []).map((inv: any) => ({
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
              nav_status: inv.nav_status,
              created_at: inv.letrehozva,
            }));

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
      const transactionId = subResource || url.searchParams.get("transaction_id");

      // Match transaction to invoice (POST /v1/transactions/:id/match)
      if (req.method === "POST" && subAction === "match" && transactionId) {
        const scopeErr = requireWriteScope();
        if (scopeErr) { response = scopeErr; }
        else {
          const accessErr = verifyCompanyAccess(targetCompanyId);
          if (accessErr) { response = accessErr; }
          else if (!requestBody.invoice_id) {
            response = errorResponse("MISSING_INVOICE_ID", "Az 'invoice_id' megadása kötelező.", 400);
          } else {
            // Update transaction and invoice link
            const [txRes, invRes] = await Promise.all([
              admin
                .from("transactions")
                .update({ matched_invoice_id: requestBody.invoice_id, match_type: "manual", is_verified: true })
                .eq("id", transactionId)
                .eq("company_id", targetCompanyId),
              admin
                .from("invoices")
                .update({ transaction_id: transactionId, fizetve: true })
                .eq("id", requestBody.invoice_id)
                .eq("company_id", targetCompanyId)
            ]);

            if (txRes.error || invRes.error) {
              response = errorResponse("MATCH_FAILED", txRes.error?.message || invRes.error?.message || "Párosítás sikertelen.", 500);
            } else {
              response = json({ success: true, message: "Tranzakció és számla sikeresen összerendelve." });
            }
          }
        }
      }
      // List transactions (GET /v1/transactions)
      else if (req.method === "GET") {
        const accessErr = verifyCompanyAccess(targetCompanyId);
        if (accessErr) { response = accessErr; }
        else {
          const dateFrom = url.searchParams.get("date_from");
          const dateTo = url.searchParams.get("date_to");
          const isMatched = url.searchParams.get("is_matched");
          const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
          const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "50", 10)));
          const offset = (page - 1) * pageSize;

          let query = admin
            .from("transactions")
            .select("id, transaction_date, description, amount, currency, type, matched_invoice_id, match_type, is_verified, created_at", { count: "exact" })
            .eq("company_id", targetCompanyId);

          if (dateFrom) query = query.gte("transaction_date", dateFrom);
          if (dateTo) query = query.lte("transaction_date", dateTo);
          if (isMatched === "true") query = query.not("matched_invoice_id", "is", null);
          if (isMatched === "false") query = query.is("matched_invoice_id", null);

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
        const accessErr = verifyCompanyAccess(targetCompanyId);
        if (accessErr) { response = accessErr; }
        else {
          const period = url.searchParams.get("period"); // YYYY-MM
          let query = admin
            .from("vat_returns")
            .select("period_year, period_month, period_quarter, frequency, status, total_payable_tax, total_deductible_tax, net_result, amount_to_pay, amount_reclaimable, finalized_at")
            .eq("company_id", targetCompanyId);

          if (period && period.includes("-")) {
            const [y, m] = period.split("-");
            query = query.eq("period_year", parseInt(y, 10)).eq("period_month", parseInt(m, 10));
          }

          const { data: vatData, error: vatErr } = await query.order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(12);
          if (vatErr) { response = errorResponse("QUERY_FAILED", vatErr.message, 500); }
          else { response = json({ success: true, data: { vat_reports: vatData || [] } }); }
        }
      } else if (reportType === "pnl") {
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
      } else {
        response = errorResponse("UNKNOWN_REPORT", "Ismeretlen riport típus. Használd: ?action=reports&report_type=vat vagy =pnl", 400);
      }
    }
    // ──────────────────────────────────────────────────
    // DOMAIN: PROJECTS
    // ──────────────────────────────────────────────────
    else if (resource === "projects" || resource === "project") {
      if (req.method === "GET") {
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
      } else if (req.method === "POST") {
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
      } else {
        response = errorResponse("METHOD_NOT_ALLOWED", "Nem támogatott metódus projektekhez.", 405);
      }
    }
    // ──────────────────────────────────────────────────
    // DOMAIN: COMPANIES & COMPANY MASTER DATA (Legacy / Base)
    // ──────────────────────────────────────────────────
    else if (resource === "companies") {
      if (accessibleCompanyIds.size === 0) {
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
      response = errorResponse("UNKNOWN_RESOURCE", `Ismeretlen végpont: '${resource}'. Használd a ?action=help végpontot a leíráshoz.`, 404);
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
    errorMessage: response.status >= 400 ? `Status ${response.status}` : null,
    durationMs,
  });

  return response;
});
