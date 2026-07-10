import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const emptyOverview = {
  usersCount: 0,
  companiesCount: 0,
  companies: [],
  users: [],
  llmOverview: {
    totalMonthlyCostUsd: 0,
    totalMonthlyInputTokens: 0,
    totalMonthlyOutputTokens: 0,
    mostExpensiveCompany: null,
  },
};

const emptyCompanyDetail = {
  invoiceCount: 0,
  submittedInvoiceCount: 0,
  navInvoiceCount: 0,
  members: [],
  lastActivity: null,
  llmCosts: {
    totalCostUsd: 0,
    totalTokens: 0,
    callCount: 0,
    totalRows: 0,
    details: [],
  },
};

const emptyUserDetail = {
  companyCount: 0,
  companies: [],
};

const emptyErrors = {
  totalErrors: 0,
  last24hErrors: 0,
  mostAffectedCompany: null,
  topErrorCategory: null,
  totalRows: 0,
  errors: [],
};

const emptyFiles = {
  totalRows: 0,
  files: [],
  stats: {
    totalCount: 0,
    successCount: 0,
    errorCount: 0,
    pendingCount: 0,
  },
};

const emptyWorkerStatus = {
  containers: [],
  queues: [],
  pipelines: [],
  recent_jobs: [],
  summary: {
    healthy_containers: 0,
    total_containers: 0,
    total_queue_pending: 0,
    total_jobs_24h: 0,
    total_cost_24h: 0,
    total_errors_24h: 0,
  },
};

const emptyLLMCosts = {
  kpi: { total_cost: 0, total_jobs: 0, avg_cost_per_job: 0, total_tokens: 0 },
  by_pipeline: [],
  by_project: [],
  top_companies: [],
  daily_trend: [],
  by_model: [],
};

function emptyForAction(action: string) {
  if (action === "company-detail") return emptyCompanyDetail;
  if (action === "user-detail") return emptyUserDetail;
  if (action === "errors") return emptyErrors;
  if (action === "files") return emptyFiles;
  if (action === "worker-status") return emptyWorkerStatus;
  if (action === "llm-costs") return emptyLLMCosts;
  return emptyOverview;
}

type CompanyMemberRow = {
  company_id: string;
  user_id: string;
  role: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  user_id: string;
  name: string | null;
  role: string;
};

type CompanyRow = {
  id: string;
  name: string;
  tax_number: string | null;
  created_at: string;
};

function roleLabel(role: string | null | undefined) {
  const normalized = `${role || ""}`.toLowerCase();
  if (normalized === "owner") return "CEO";
  if (normalized === "admin") return "ADMIN";
  if (normalized === "employee") return "EMPLOYEE";
  if (normalized === "member") return "MEMBER";
  return role || "MEMBER";
}

function startOfMonthIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Paginate through all auth users (Supabase Admin API returns max 1000/page). */
async function listAllAuthUsers(admin: ReturnType<typeof createClient>): Promise<Map<string, string>> {
  const emailByUserId = new Map<string, string>();
  const PAGE_SIZE = 1000;
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error || !data?.users?.length) break;

    for (const u of data.users) {
      emailByUserId.set(u.id, u.email || "");
    }

    hasMore = data.users.length === PAGE_SIZE;
    page++;
  }

  return emailByUserId;
}

function sortLlmRows(rows: any[], sortBy: string, sortDir: string) {
  const allowed = new Set(["created_at", "input_tokens", "output_tokens", "estimated_cost_usd"]);
  const key = allowed.has(sortBy) ? sortBy : "created_at";
  const direction = sortDir === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const av = key === "created_at" ? new Date(a.created_at).getTime() : Number(a[key] || 0);
    const bv = key === "created_at" ? new Date(b.created_at).getTime() : Number(b[key] || 0);
    return (av - bv) * direction;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return json({ error: "Method not allowed" });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "overview";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("[MANAGEMENT-STATS] Missing Supabase environment variables");
      return json(emptyForAction(action));
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized", ...emptyForAction(action) });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    const userId = userData.user?.id;

    if (userError || !userId) {
      console.warn("[MANAGEMENT-STATS] JWT validation failed", userError?.message);
      return json({ error: "Unauthorized", ...emptyForAction(action) });
    }

    const { data: requesterProfile, error: profileError } = await admin
      .from("profiles")
      .select("user_id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError || (requesterProfile?.role !== "management" && requesterProfile?.role !== "thinkai")) {
      console.warn("[MANAGEMENT-STATS] Management role check failed", {
        userId,
        role: requesterProfile?.role ?? null,
        error: profileError?.message,
      });
      return json({ error: "Unauthorized", ...emptyForAction(action) });
    }

    if (action === "overview") {
      return json(await buildOverview(admin));
    }

    if (action === "company-detail") {
      const companyId = url.searchParams.get("companyId");
      if (!companyId) return json(emptyCompanyDetail);
      return json(await buildCompanyDetail(admin, companyId, url));
    }

    if (action === "errors") {
      return json(await buildErrors(admin, url));
    }

    if (action === "delete-errors") {
      if (req.method !== "POST") return json({ error: "POST required" });
      const body = await req.json().catch(() => ({}));
      return json(await deleteErrors(admin, body));
    }

    if (action === "retry-errors") {
      if (req.method !== "POST") return json({ error: "POST required" });
      const body = await req.json().catch(() => ({}));
      return json(await retryErrors(admin, body));
    }

    if (action === "delete-all-errors") {
      if (req.method !== "POST") return json({ error: "POST required" });
      return json(await deleteAllErrors(admin));
    }

    if (action === "user-detail") {
      const selectedUserId = url.searchParams.get("userId");
      if (!selectedUserId) return json(emptyUserDetail);
      return json(await buildUserDetail(admin, selectedUserId));
    }

    if (action === "user-permissions") {
      const targetUserId = url.searchParams.get("userId");
      if (!targetUserId) return json({ error: "userId required" });
      return json(await buildUserPermissions(admin, targetUserId));
    }

    if (action === "update-permissions") {
      if (req.method !== "POST") return json({ error: "POST required" });
      const body = await req.json().catch(() => ({}));
      return json(await updatePermissions(admin, body));
    }

    if (action === "superadmin-module-data") {
      const companyId = url.searchParams.get("companyId");
      if (!companyId || !/^[0-9a-f-]{36}$/.test(companyId)) {
        return json({ error: "Invalid companyId" }, 400);
      }
      return json(await buildSuperadminData(admin, companyId, url));
    }

    if (action === "files") {
      return json(await buildFiles(admin, url));
    }

    if (action === "update-file-status") {
      if (req.method !== "POST") return json({ error: "POST required" });
      const body = await req.json().catch(() => ({}));
      return json(await updateFileStatus(admin, body));
    }

    if (action === "delete-files") {
      if (req.method !== "POST") return json({ error: "POST required" });
      const body = await req.json().catch(() => ({}));
      return json(await deleteFiles(admin, body));
    }

    if (action === "worker-status") {
      const period = url.searchParams.get("period") || "all";
      return json(await buildWorkerStatus(admin, period));
    }

    if (action === "llm-costs") {
      const period = url.searchParams.get("period") || "7d";
      return json(await buildLLMCosts(admin, period));
    }

    return json({ error: "Unknown action", ...emptyOverview });
  } catch (error) {
    console.error("[MANAGEMENT-STATS] Unexpected error", error);
    const action = new URL(req.url).searchParams.get("action") || "overview";
    return json(emptyForAction(action));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN: per-module paginated read-only data for a given company
// ─────────────────────────────────────────────────────────────────────────────
async function buildSuperadminData(
  admin: ReturnType<typeof createClient>,
  companyId: string,
  url: URL
) {
  const module = url.searchParams.get("module") || "invoices";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get("pageSize") || "25", 10)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const safeDate = (s: string | null) => {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : s;
  };
  const dateFrom = safeDate(url.searchParams.get("dateFrom"));
  const dateTo = safeDate(url.searchParams.get("dateTo"));
  const search = (url.searchParams.get("search") || "").trim();

  type ModuleResult = { totalCount: number; rows: unknown[] };
  const empty: ModuleResult = { totalCount: 0, rows: [] };

  try {
    // ── Eaisybill: Számlák (invoices table has Hungarian column names) ──
    if (module === "invoices") {
      let q = admin
        .from("invoices")
        .select(
          "id,kibocsatas_datuma,bizonylatsorszam,elado_nev,adoalap_osszesen,brutto_vegosszeg,invoice_type,invoice_direction,statusz,letrehozva",
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .order("kibocsatas_datuma", { ascending: false })
        .range(from, to);
      if (dateFrom) q = q.gte("kibocsatas_datuma", dateFrom);
      if (dateTo) q = q.lte("kibocsatas_datuma", dateTo);
      if (search) q = q.ilike("elado_nev", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── NAV számlák ──
    if (module === "nav_invoices") {
      let q = admin
        .from("nav_invoices")
        .select(
          "id,invoice_issue_date,invoice_number,supplier_name,invoice_net_amount,invoice_gross_amount,invoice_vat_amount,created_at",
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .order("invoice_issue_date", { ascending: false })
        .range(from, to);
      if (dateFrom) q = q.gte("invoice_issue_date", dateFrom);
      if (dateTo) q = q.lte("invoice_issue_date", dateTo);
      if (search) q = q.ilike("supplier_name", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── Tranzakciók (transactions table uses type/match_type/description) ──
    if (module === "transactions") {
      let q = admin
        .from("transactions")
        .select(
          "id,transaction_date,amount,currency,description,type,match_type,created_at",
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .order("transaction_date", { ascending: false })
        .range(from, to);
      if (dateFrom) q = q.gte("transaction_date", dateFrom);
      if (dateTo) q = q.lte("transaction_date", dateTo);
      if (search) q = q.ilike("description", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── Főkönyv (gl_journal_entries uses voucher_date, voucher_number, debit_account, credit_account, no created_at) ──
    if (module === "gl_journal_entries") {
      let q = admin
        .from("gl_journal_entries")
        .select(
          "id,voucher_date,voucher_number,debit_account,credit_account,amount,description,partner_name",
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .order("voucher_date", { ascending: false })
        .range(from, to);
      if (dateFrom) q = q.gte("voucher_date", dateFrom);
      if (dateTo) q = q.lte("voucher_date", dateTo);
      if (search) q = q.ilike("description", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── Bérek (salary table has Hungarian column names: dátum, név, összeg) ──
    if (module === "salary") {
      let q = admin
        .from("salary")
        .select(
          'id,"dátum","név","összeg",statusz,tipus,created_at',
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .order("dátum", { ascending: false })
        .range(from, to);
      if (search) q = q.ilike("név", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── Pénztár (petty_cash_entries: entry_date, description, amount, currency, source_type) ──
    if (module === "petty_cash_entries") {
      let q = admin
        .from("petty_cash_entries")
        .select(
          "id,entry_date,description,amount,currency,source_type,created_at",
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .order("entry_date", { ascending: false })
        .range(from, to);
      if (dateFrom) q = q.gte("entry_date", dateFrom);
      if (dateTo) q = q.lte("entry_date", dateTo);
      if (search) q = q.ilike("description", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── Feltöltések (invoice_uploads + transaction_uploads) ──
    if (module === "uploads") {
      const invQ = admin
        .from("invoice_uploads")
        .select("id,created_at,file_name,processing_status,error_message,user_id", { count: "exact" })
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(from, to);
      const txQ = admin
        .from("transaction_uploads")
        .select("id,created_at,file_name,processing_status,error_message,user_id", { count: "exact" })
        .eq("company_id", companyId);
      const [invRes, txRes] = await Promise.all([invQ, txQ]);
      const invRows = (invRes.data || []).map((r: any) => ({ ...r, upload_type: "Számla" }));
      const txRows = (txRes.data || []).map((r: any) => ({ ...r, upload_type: "Tranzakció" }));
      const combined = [...invRows, ...txRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const total = (invRes.count ?? 0) + (txRes.count ?? 0);
      return { module, totalCount: total, rows: combined.slice(0, pageSize), page, pageSize };
    }

    // ── App hibák ──
    if (module === "app_error_logs") {
      let q = admin
        .from("app_error_logs")
        .select(
          "id,created_at,component,error_type,message,severity,action,user_id",
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo) q = q.lte("created_at", dateTo);
      if (search) q = q.ilike("message", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisyBooks modules ────────────────────────────────────────────────────

    if (module === "accounty_missing_items") {
      let q = admin
        .from("accounty_missing_items")
        .select(
          "id,created_at,category,title,status,amount,item_date,resolved_at",
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo) q = q.lte("created_at", dateTo);
      if (search) q = q.ilike("title", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    if (module === "accounty_deadlines") {
      let q = admin
        .from("accounty_deadlines")
        .select(
          "id,due_date,deadline_type,title,status,notes,created_at",
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .order("due_date", { ascending: true })
        .range(from, to);
      if (dateFrom) q = q.gte("due_date", dateFrom);
      if (dateTo) q = q.lte("due_date", dateTo);
      if (search) q = q.ilike("title", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    if (module === "accounty_employees") {
      let q = admin
        .from("accounty_employees")
        .select(
          "id,first_name,last_name,tax_id,birth_date,status,created_at",
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .order("last_name", { ascending: true })
        .range(from, to);
      if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    if (module === "accounty_payroll_cycles") {
      let q = admin
        .from("accounty_payroll_cycles")
        .select(
          "id,year,month,status,current_step,created_at",
          { count: "exact" }
        )
        .eq("company_id", companyId)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .range(from, to);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisybill: Kategóriák ──
    if (module === "categories") {
      let q = admin
        .from("categories")
        .select("id,name,icon,color,created_at", { count: "exact" })
        .eq("company_id", companyId)
        .order("name", { ascending: true })
        .range(from, to);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisybill: Projektek ──
    if (module === "projects") {
      let q = admin
        .from("projects")
        .select("id,name,project_code,project_type,client_name,status,budget,start_date,end_date,created_at", { count: "exact" })
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (search) q = q.ilike("name", `%${search}%`);
      if (dateFrom) q = q.gte("start_date", dateFrom);
      if (dateTo) q = q.lte("start_date", dateTo);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisybill: Partnertörzs ──
    if (module === "partners") {
      let q = admin
        .from("partners")
        .select("id,name,tax_number,partner_type,email,address,created_at", { count: "exact" })
        .eq("company_id", companyId)
        .order("name", { ascending: true })
        .range(from, to);
      if (search) q = q.or(`name.ilike.%${search}%,tax_number.ilike.%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisybill: TENY (Tárgyi eszközök) ──
    if (module === "fixed_assets") {
      let q = admin
        .from("fixed_assets")
        .select("id,name,inventory_number,acquisition_value,purchase_date,status,depreciation_method,supplier_name,created_at", { count: "exact" })
        .eq("company_id", companyId)
        .order("purchase_date", { ascending: false })
        .range(from, to);
      if (search) q = q.ilike("name", `%${search}%`);
      if (dateFrom) q = q.gte("purchase_date", dateFrom);
      if (dateTo) q = q.lte("purchase_date", dateTo);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisybill: Fuvarok ──
    if (module === "shipments") {
      let q = admin
        .from("shipments")
        .select("id,position_number,pickup_date,delivery_date,carrier_name,calculated_amount_huf,match_status,created_at", { count: "exact" })
        .eq("company_id", companyId)
        .order("pickup_date", { ascending: false })
        .range(from, to);
      if (search) q = q.ilike("carrier_name", `%${search}%`);
      if (dateFrom) q = q.gte("pickup_date", dateFrom);
      if (dateTo) q = q.lte("pickup_date", dateTo);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisybill: Beszámolók ──
    if (module === "annual_reports") {
      let q = admin
        .from("annual_reports")
        .select("id,company_id,status,created_at,updated_at", { count: "exact" })
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(from, to);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisyBooks: Portfólió (assignments) ──
    if (module === "accounty_assignments") {
      let q = admin
        .from("accounty_assignments")
        .select("id,company_id,accountant_user_id,accounting_firm_id,role,kanban_status,is_primary,is_main_accountant,assigned_at,created_at", { count: "exact" })
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(from, to);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisyBooks: Adó profil ──
    if (module === "accounty_tax_profiles") {
      let q = admin
        .from("accounty_tax_profiles")
        .select("id,company_id,vat_frequency,contribution_frequency,is_kata,is_kiva,tax_group,has_payroll,nav_synced,created_at", { count: "exact" })
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(from, to);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisyBooks: Bevallások ──
    if (module === "accounty_filings") {
      let q = admin
        .from("accounty_filings")
        .select("id,filing_type,period_year,period_month,status,channel,submitted_at,created_at", { count: "exact" })
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (search) q = q.ilike("filing_type", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisyBooks: TAO ──
    if (module === "accounty_tao_yearly") {
      let q = admin
        .from("accounty_tao_yearly")
        .select("id,tax_year,status,revenue,tax_base,calculated_tax,payable_tax,filing_status,created_at", { count: "exact" })
        .eq("company_id", companyId)
        .order("tax_year", { ascending: false })
        .range(from, to);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisyBooks: Audit napló ──
    if (module === "accounty_audit_log") {
      let q = admin
        .from("accounty_audit_log")
        .select("id,created_at,user_name,action,entity_type,entity_id,details", { count: "exact" })
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo) q = q.lte("created_at", dateTo);
      if (search) q = q.ilike("action", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisyBooks: Dokumentumok ──
    if (module === "accounty_documents") {
      let q = admin
        .from("accounty_documents")
        .select("id,title,doc_type,status,period,created_at", { count: "exact" })
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (search) q = q.ilike("title", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisyBooks: Sablonok (globális — nincs company_id szűrés) ──
    if (module === "accounty_templates") {
      let q = admin
        .from("accounty_templates")
        .select("id,name,category,is_active,version,updated_at,created_at", { count: "exact" })
        .order("category", { ascending: true })
        .range(from, to);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisyBooks: Jogviszonykódok (globális — nincs company_id szűrés) ──
    if (module === "accounty_job_codes") {
      let q = admin
        .from("accounty_job_codes")
        .select("id,code,name,is_insured,valid_from,is_active,description,created_at", { count: "exact" })
        .order("code", { ascending: true })
        .range(from, to);
      if (search) q = q.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    // ── eaisyBooks: Jogszabály-frissítések (globális — nincs company_id szűrés) ──
    if (module === "accounty_legal_updates") {
      let q = admin
        .from("accounty_legal_updates")
        .select("id,title,source,published_at,affected_modules,implementation_status,notes,created_at", { count: "exact" })
        .order("published_at", { ascending: false })
        .range(from, to);
      if (search) q = q.ilike("title", `%${search}%`);
      const { data, count, error } = await q;
      if (error) throw error;
      return { module, totalCount: count ?? 0, rows: data ?? [], page, pageSize };
    }

    return { ...empty, module, page, pageSize };
  } catch (err) {
    console.error(`[SUPERADMIN] Error fetching module '${module}' for company '${companyId}':`, err);
    return { ...empty, module, page, pageSize, error: String(err) };
  }
}


async function buildOverview(admin: ReturnType<typeof createClient>) {
  const monthStart = startOfMonthIso();

  const [companiesRes, membersRes, profilesRes, countsRes, monthlyLlmRes, emailByUserId,
    errInvoicesRes, errTxRes, errReportsRes, errGlRes, errNavRes, errBankRes, errAppRes,
    accountyAssignmentsRes,
  ] = await Promise.all([
    admin.from("companies").select("id, name, tax_number, created_at").order("created_at", { ascending: false }),
    admin.from("company_members").select("company_id, user_id, role, created_at"),
    admin.from("profiles").select("id, user_id, name, role, created_at"),
    // ── Single RPC replaces 4 × select("id,company_id") — avoids the PostgREST 1000-row limit ──
    admin.rpc("get_company_counts"),
    admin
      .from("llm_koltsegek")
      .select("company_id, input_tokens, output_tokens, total_tokens, estimated_cost_usd, llm_calls, created_at")
      .gte("created_at", monthStart),
    listAllAuthUsers(admin),
    // Fetch error references for company/user aggregation
    admin.from("invoice_uploads").select("company_id, user_id").eq("processing_status", "error"),
    admin.from("transaction_uploads").select("company_id, user_id").eq("processing_status", "error"),
    admin.from("report_uploads").select("company_id, user_id").eq("processing_status", "error"),
    admin.from("gl_upload_notifications").select("company_id").eq("processing_status", "error"),
    admin.from("nav_sync_logs").select("company_id").eq("status", "error"),
    admin.from("bank_statement_uploads").select("company_id, user_id").eq("processing_status", "error"),
    admin.from("app_error_logs").select("company_id, user_id").eq("severity", "error").order("created_at", { ascending: false }).limit(500),
    // ── eaisyBooks assignment lookup (distinct company_ids that have accounty access) ──
    admin.from("accounty_assignments").select("company_id"),
  ]);

  for (const res of [companiesRes, membersRes, profilesRes, countsRes, monthlyLlmRes, accountyAssignmentsRes]) {
    if (res.error) throw res.error;
  }

  // Build set of company_ids that have eaisyBooks (accounty) assignments
  const eaisyBooksCompanyIds = new Set(
    (accountyAssignmentsRes.data || []).map((r: { company_id: string }) => r.company_id)
  );

  const companies = (companiesRes.data || []) as CompanyRow[];
  const members = (membersRes.data || []) as CompanyMemberRow[];
  const profiles = (profilesRes.data || []) as (ProfileRow & { created_at: string })[];
  const monthlyLlm = monthlyLlmRes.data || [];

  // Parse RPC count maps — keyed by company_id string
  const rawCounts = (countsRes.data as { invoices: Record<string, number>; nav_invoices: Record<string, number>; transactions: Record<string, number>; salary: Record<string, number> }) || { invoices: {}, nav_invoices: {}, transactions: {}, salary: {} };
  const invoiceCounts   = new Map(Object.entries(rawCounts.invoices   || {}));
  const navInvoiceCounts = new Map(Object.entries(rawCounts.nav_invoices || {}));
  const txCounts        = new Map(Object.entries(rawCounts.transactions || {}));
  const salaryCounts    = new Map(Object.entries(rawCounts.salary || {}));

  const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const membersByCompany = new Map<string, CompanyMemberRow[]>();
  const companiesByUser = new Map<string, Array<{ id: string; name: string; role: string }>>();

  for (const member of members) {
    if (!membersByCompany.has(member.company_id)) membersByCompany.set(member.company_id, []);
    membersByCompany.get(member.company_id)!.push(member);
  }


  const monthlyCostsByCompany = new Map<string, { cost: number; input: number; output: number }>();
  for (const row of monthlyLlm) {
    if (!row.company_id) continue;
    const current = monthlyCostsByCompany.get(row.company_id) || { cost: 0, input: 0, output: 0 };
    current.cost += Number(row.estimated_cost_usd || 0);
    current.input += Number(row.input_tokens || 0);
    current.output += Number(row.output_tokens || 0);
    monthlyCostsByCompany.set(row.company_id, current);
  }

  const companySummaries = companies.map((company) => {
    const companyMembers = membersByCompany.get(company.id) || [];

    for (const member of companyMembers) {
      if (!companiesByUser.has(member.user_id)) companiesByUser.set(member.user_id, []);
      companiesByUser.get(member.user_id)!.push({ id: company.id, name: company.name, role: roleLabel(member.role) });
    }

    const llm = monthlyCostsByCompany.get(company.id) || { cost: 0, input: 0, output: 0 };

    return {
      id: company.id,
      name: company.name,
      tax_number: company.tax_number,
      created_at: company.created_at,
      members: companyMembers.map((member) => ({
        name: profileByUserId.get(member.user_id)?.name || "N/A",
        role: roleLabel(member.role),
      })),
      monthlyCostUsd: llm.cost,
      invoiceCount: invoiceCounts.get(company.id) || 0,
      navInvoiceCount: navInvoiceCounts.get(company.id) || 0,
      transactionCount: txCounts.get(company.id) || 0,
      payrollCount: salaryCounts.get(company.id) || 0,
      hasEaisyBooks: eaisyBooksCompanyIds.has(company.id),
    };
  });

  const totalMonthlyCostUsd = [...monthlyCostsByCompany.values()].reduce((sum, item) => sum + item.cost, 0);
  const totalMonthlyInputTokens = [...monthlyCostsByCompany.values()].reduce((sum, item) => sum + item.input, 0);
  const totalMonthlyOutputTokens = [...monthlyCostsByCompany.values()].reduce((sum, item) => sum + item.output, 0);
  const mostExpensiveCompany = companySummaries.reduce<typeof companySummaries[number] | null>(
    (winner, company) => (!winner || company.monthlyCostUsd > winner.monthlyCostUsd ? company : winner),
    null,
  );

  const invoiceErrors = errInvoicesRes.data || [];
  const txErrors = errTxRes.data || [];
  const reportErrors = errReportsRes.data || [];
  const glErrors = errGlRes.data || [];
  const navErrors = errNavRes.data || [];
  const bankErrors = errBankRes.data || [];
  const appErrors = errAppRes.data || [];

  const totalErrors = invoiceErrors.length + txErrors.length + reportErrors.length 
    + glErrors.length + navErrors.length + bankErrors.length + appErrors.length;

  const companyErrorCounts = new Map<string, number>();
  const userErrorCounts = new Map<string, number>();

  const addError = (companyId?: string | null, userId?: string | null) => {
    if (companyId) {
      companyErrorCounts.set(companyId, (companyErrorCounts.get(companyId) || 0) + 1);
    }
    if (userId) {
      userErrorCounts.set(userId, (userErrorCounts.get(userId) || 0) + 1);
    }
  };

  invoiceErrors.forEach((e: any) => addError(e.company_id, e.user_id));
  txErrors.forEach((e: any) => addError(e.company_id, e.user_id));
  reportErrors.forEach((e: any) => addError(e.company_id, e.user_id));
  glErrors.forEach((e: any) => addError(e.company_id, null));
  navErrors.forEach((e: any) => addError(e.company_id, null));
  bankErrors.forEach((e: any) => addError(e.company_id, e.user_id));
  appErrors.forEach((e: any) => addError(e.company_id, e.user_id));

  let maxCompanyId = "";
  let maxCompanyCount = 0;
  for (const [cid, count] of companyErrorCounts.entries()) {
    if (count > maxCompanyCount) {
      maxCompanyCount = count;
      maxCompanyId = cid;
    }
  }

  let maxUserId = "";
  let maxUserCount = 0;
  for (const [uid, count] of userErrorCounts.entries()) {
    if (count > maxUserCount) {
      maxUserCount = count;
      maxUserId = uid;
    }
  }

  const companyById = new Map(companies.map(c => [c.id, c.name]));
  const profileNameByUserId = new Map(profiles.map(p => [p.user_id, p.name]));

  const mostErrorCompany = maxCompanyId && maxCompanyCount > 0 ? {
    id: maxCompanyId,
    name: companyById.get(maxCompanyId) || "Ismeretlen cég",
    errorCount: maxCompanyCount
  } : null;

  const mostErrorUser = maxUserId && maxUserCount > 0 ? {
    id: maxUserId,
    name: profileNameByUserId.get(maxUserId) || "Ismeretlen felhasználó",
    email: emailByUserId.get(maxUserId) || "—",
    errorCount: maxUserCount
  } : null;

  return {
    usersCount: profiles.filter((profile) => profile.role !== "management" && profile.role !== "thinkai").length,
    companiesCount: companies.length,
    totalErrors,
    mostErrorCompany,
    mostErrorUser,
    companies: companySummaries,
    users: profiles
      .filter((profile) => profile.role !== "management" && profile.role !== "thinkai")
      .map((profile) => ({
        id: profile.id,
        user_id: profile.user_id,
        name: profile.name || "N/A",
        email: emailByUserId.get(profile.user_id) || "—",
        created_at: profile.created_at,
        companies: companiesByUser.get(profile.user_id) || [],
      })),
    llmOverview: {
      totalMonthlyCostUsd,
      totalMonthlyInputTokens,
      totalMonthlyOutputTokens,
      mostExpensiveCompany: mostExpensiveCompany
        ? {
            id: mostExpensiveCompany.id,
            name: mostExpensiveCompany.name,
            totalCostUsd: mostExpensiveCompany.monthlyCostUsd,
            monthlyCostUsd: mostExpensiveCompany.monthlyCostUsd,
          }
        : null,
    },
  };
}

async function buildCompanyDetail(admin: ReturnType<typeof createClient>, companyId: string, url: URL) {
  const page = Math.max(0, Number(url.searchParams.get("page") || 0));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 20)));
  const sortBy = url.searchParams.get("sortBy") || "created_at";
  const sortDir = url.searchParams.get("sortDir") || "desc";
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const dateFrom = url.searchParams.get("dateFrom") || "";
  const dateTo = url.searchParams.get("dateTo") || "";

  // Phase 1: Fetch non-LLM base data in parallel
  const [invoicesRes, navInvoicesRes, membersRes, profilesRes, auditRes, emailByUserId] = await Promise.all([
    admin.from("invoices").select("id").eq("company_id", companyId),
    admin.from("nav_invoices").select("id").eq("company_id", companyId),
    admin.from("company_members").select("company_id, user_id, role, created_at").eq("company_id", companyId),
    admin.from("profiles").select("user_id, name, role"),
    admin
      .from("audit_logs")
      .select("action, entity, entity_name, user_id, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1),
    listAllAuthUsers(admin),
  ]);

  for (const res of [invoicesRes, navInvoicesRes, membersRes, profilesRes, auditRes]) {
    if (res.error) throw res.error;
  }

  const profileByUserId = new Map(((profilesRes.data || []) as ProfileRow[]).map((profile) => [profile.user_id, profile]));
  const members = ((membersRes.data || []) as CompanyMemberRow[]).map((member) => ({
    user_id: member.user_id,
    name: profileByUserId.get(member.user_id)?.name || "N/A",
    email: emailByUserId.get(member.user_id) || "—",
    role: roleLabel(member.role),
    joined_at: member.created_at,
  }));

  const lastAudit = (auditRes.data || [])[0] || null;
  const lastActivity = lastAudit
    ? {
        action: `${lastAudit.action}`,
        entity: `${lastAudit.entity}`,
        entity_name: lastAudit.entity_name || "",
        user_name: profileByUserId.get(lastAudit.user_id || "")?.name || "Rendszer",
        created_at: lastAudit.created_at,
      }
    : null;

  // Phase 2: LLM data — DB-level filter, sort, paginate
  // Pre-lookup user_ids matching search (from already-fetched profiles)
  let searchUserIds: string[] = [];
  if (search) {
    searchUserIds = ((profilesRes.data || []) as ProfileRow[])
      .filter((p) => (p.name || "").toLowerCase().includes(search))
      .map((p) => p.user_id);
  }

  // Shared filter builder — applies company, date, and search filters at DB level
  const applyLlmFilters = (query: any) => {
    query = query.eq("company_id", companyId);
    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);
    if (search) {
      const orParts = [`model_name.ilike.%${search}%`, `file_name.ilike.%${search}%`];
      if (searchUserIds.length > 0) {
        orParts.push(`user_id.in.(${searchUserIds.join(",")})`);
      }
      query = query.or(orParts.join(","));
    }
    return query;
  };

  // Validate sort column
  const allowedSort = new Set(["created_at", "input_tokens", "output_tokens", "estimated_cost_usd"]);
  const dbSortCol = allowedSort.has(sortBy) ? sortBy : "created_at";

  // Run lightweight aggregate + paginated detail queries in parallel
  const [aggRes, detailRes] = await Promise.all([
    // Aggregate: only 3 numeric columns, no pagination — lightweight even for many rows
    applyLlmFilters(
      admin.from("llm_koltsegek").select("estimated_cost_usd, total_tokens, llm_calls"),
    ),
    // Detail: full columns, DB-level sort + pagination + count
    applyLlmFilters(
      admin
        .from("llm_koltsegek")
        .select(
          "input_tokens, output_tokens, total_tokens, estimated_cost_usd, model_name, created_at, user_id, file_name, llm_calls",
          { count: "exact" },
        ),
    )
      .order(dbSortCol, { ascending: sortDir === "asc" })
      .range(page * pageSize, page * pageSize + pageSize - 1),
  ]);

  if (aggRes.error) throw aggRes.error;
  if (detailRes.error) throw detailRes.error;

  // Aggregate totals from lightweight rows
  const aggRows = aggRes.data || [];
  const totalCostUsd = aggRows.reduce((sum: number, r: any) => sum + Number(r.estimated_cost_usd || 0), 0);
  const totalTokens = aggRows.reduce((sum: number, r: any) => sum + Number(r.total_tokens || 0), 0);
  const callCount = aggRows.reduce((sum: number, r: any) => sum + Number(r.llm_calls || 0), 0);

  // Map paginated detail rows (only one page of data)
  const pagedRows = (detailRes.data || []).map((row: any) => ({
    input_tokens: Number(row.input_tokens || 0),
    output_tokens: Number(row.output_tokens || 0),
    total_tokens: Number(row.total_tokens || 0),
    estimated_cost_usd: Number(row.estimated_cost_usd || 0),
    model_name: row.model_name || "—",
    created_at: row.created_at,
    user_name: profileByUserId.get(row.user_id || "")?.name || "—",
    file_name: row.file_name || null,
    llm_calls: Number(row.llm_calls || 0),
  }));

  return {
    invoiceCount: (invoicesRes.data || []).length + (navInvoicesRes.data || []).length,
    submittedInvoiceCount: (invoicesRes.data || []).length,
    navInvoiceCount: (navInvoicesRes.data || []).length,
    members,
    lastActivity,
    llmCosts: {
      totalCostUsd,
      totalTokens,
      callCount,
      totalRows: detailRes.count || 0,
      details: pagedRows,
    },
  };
}

async function buildUserDetail(admin: ReturnType<typeof createClient>, userId: string) {
  const [membersRes, companiesRes] = await Promise.all([
    admin.from("company_members").select("company_id, user_id, role, created_at").eq("user_id", userId),
    admin.from("companies").select("id, name"),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (companiesRes.error) throw companiesRes.error;

  const companyById = new Map<string, { id: string; name: string }>((companiesRes.data || []).map((company: any) => [company.id, company]));
  const companies = ((membersRes.data || []) as CompanyMemberRow[])
    .map((member) => {
      const company = companyById.get(member.company_id);
      if (!company) return null;
      return { id: company.id, name: company.name, role: roleLabel(member.role) };
    })
    .filter(Boolean);

  return {
    companyCount: companies.length,
    companies,
  };
}

// ─── Error categorization ────────────────────────────
// Kategorizálja az upload tábla hibáit → 3 fő csoport
function categorizeError(msg: string | null): string {
  if (!msg) return "Worker"; // upload táblás hiba → Worker
  const lower = msg.toLowerCase();
  // Application-szintű hibák (timeout, rate-limit, API)
  if (lower.includes("timeout") || lower.includes("timed out")) return "Application";
  if (lower.includes("rate limit") || lower.includes("429")) return "Application";
  if (lower.includes("apierror") || lower.includes("pgrst") || lower.includes("http error")) return "Application";
  if (lower.includes("duplicate key") || lower.includes("already exists")) return "Worker";
  // Minden egyéb upload hiba → Worker (OCR, AI, üres tartalom stb.)
  return "Worker";
}

// 3 fő kategória csoport — app_error_logs error_type értékek mapping-je
const APP_LOG_CATEGORY_MAP: Record<string, string> = {
  // Application csoport
  auth:         "Application",
  db_query:     "Application",
  api_call:     "Application",
  upload:       "Application",
  validation:   "Application",
  navigation:   "Application",
  unhandled:    "Application",
  realtime:     "Application",
  // Mailgun csoport
  webhook:      "Mailgun",
  mailgun:      "Mailgun",
  email_alias:  "Mailgun",
  // Worker csoport
  worker:       "Worker",
};

function categoryLabel(cat: string): string {
  // Az app_error_logs error_type értékek már mappelve vannak
  if (APP_LOG_CATEGORY_MAP[cat]) return APP_LOG_CATEGORY_MAP[cat];
  // Az upload táblás categorizeError() már a 3 csoportot adja vissza
  if (cat === "Application" || cat === "Mailgun" || cat === "Worker") return cat;
  // Fallback
  return "Worker";
}

const UPLOAD_SOURCES = new Set([
  "invoice_uploads", "transaction_uploads", "report_uploads",
  "gl_upload_notifications", "nav_sync_logs", "bank_statement_uploads",
]);

const SOURCE_LABELS: Record<string, string> = {
  // Feltöltések — egységes label
  invoice_uploads:          "Feltöltés",
  transaction_uploads:      "Feltöltés",
  report_uploads:           "Feltöltés",
  gl_upload_notifications:  "Feltöltés",
  nav_sync_logs:            "Feltöltés",
  bank_statement_uploads:   "Feltöltés",
  // App error log sub-source-ok (3 csoport)
  "app_error_logs:frontend": "Frontend",
  "app_error_logs:worker":   "Worker",
  "app_error_logs:mailgun":  "Mailgun",
};

// Map error_type → sub-source kulcs (Mailgun típusok összevonva)
function appLogSubSource(errorType: string): string {
  if (errorType === "worker") return "app_error_logs:worker";
  if (["webhook", "mailgun", "email_alias"].includes(errorType)) return "app_error_logs:mailgun";
  return "app_error_logs:frontend";
}

type ErrorRow = {
  id: string;
  created_at: string;
  source: string;
  source_label: string;
  error_category: string;
  error_category_label: string;
  error_message: string | null;
  file_name: string | null;
  file_url: string | null;
  company_id: string | null;
  company_name: string | null;
  user_id: string | null;
  user_name: string | null;
  context: Record<string, unknown> | null;
};

async function buildErrors(admin: ReturnType<typeof createClient>, url: URL) {
  const page = Math.max(0, Number(url.searchParams.get("page") || 0));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 25)));
  const sortBy = url.searchParams.get("sortBy") || "created_at";
  const sortDir = url.searchParams.get("sortDir") || "desc";
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const filterCompanyId = url.searchParams.get("companyId") || "";
  const filterSource = url.searchParams.get("source") || "";
  const filterCategory = url.searchParams.get("category") || "";
  const filterUserId = url.searchParams.get("userId") || "";
  const dateFrom = url.searchParams.get("dateFrom") || "";
  const dateTo = url.searchParams.get("dateTo") || "";

  // Fetch reference data + error rows from all 6 tables in parallel
  const [companiesRes, profilesRes, ...errorResults] = await Promise.all([
    admin.from("companies").select("id, name"),
    admin.from("profiles").select("user_id, name"),
    // 6 upload error source queries — include file_url where available
    admin.from("invoice_uploads")
      .select("id, created_at, error_message, file_name, file_url, company_id, user_id, metadata")
      .eq("processing_status", "error"),
    admin.from("transaction_uploads")
      .select("id, created_at, error_message, file_name, file_url, company_id, user_id, metadata")
      .eq("processing_status", "error"),
    admin.from("report_uploads")
      .select("id, created_at, error_message, file_name, file_url, company_id, user_id")
      .eq("processing_status", "error"),
    admin.from("gl_upload_notifications")
      .select("id, created_at, error_message, company_id")
      .eq("processing_status", "error"),
    admin.from("nav_sync_logs")
      .select("id, created_at, error_message, company_id")
      .eq("status", "error"),
    admin.from("bank_statement_uploads")
      .select("id, created_at, error_message, file_name, file_url, company_id, user_id, metadata")
      .eq("processing_status", "error"),
    // 7th source: frontend app error logs
    admin.from("app_error_logs")
      .select("id, created_at, message, error_type, component, action, company_id, user_id, context")
      .eq("severity", "error")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const companyById = new Map((companiesRes.data || []).map((c: any) => [c.id, c.name]));
  const profileByUserId = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.name]));

  const sourceNames = [
    "invoice_uploads", "transaction_uploads", "report_uploads",
    "gl_upload_notifications", "nav_sync_logs", "bank_statement_uploads",
    "app_error_logs",
  ];

  // Merge all error rows into unified format
  let allErrors: ErrorRow[] = [];
  for (let i = 0; i < sourceNames.length; i++) {
    const res = errorResults[i];
    if (res.error) {
      console.warn(`[MANAGEMENT-STATS] Error querying ${sourceNames[i]}:`, res.error.message);
      continue;
    }
    const source = sourceNames[i];
    for (const row of res.data || []) {
      // For app_error_logs, use error_type as category; for upload tables, categorize from message
      const isAppLog = source === "app_error_logs";
      // Ha a component 'process-mailgun-webhook' → override: Mailgun csoport, mailgun sub-source
      const isMailgunComponent = isAppLog && row.component === 'process-mailgun-webhook';
      const cat = isMailgunComponent
        ? 'Mailgun'
        : isAppLog ? (row.error_type || "unknown") : categorizeError(row.error_message ?? row.message);
      // For auth errors, prepend email from context if available
      const ctxEmail = isAppLog && row.context?.email ? ` [${row.context.email}]` : "";
      const errorMsg = isAppLog
        ? `[${row.component || '?'}/${row.action || '?'}]${ctxEmail} ${row.message || ''}`
        : (row.error_message || null);
      // For app_error_logs, derive a sub-source so Frontend/Worker/Mailgun are separate
      const effectiveSource = isMailgunComponent
        ? 'app_error_logs:mailgun'
        : isAppLog ? appLogSubSource(row.error_type || "") : source;
      allErrors.push({
        id: row.id,
        created_at: row.created_at,
        source: effectiveSource,
        source_label: SOURCE_LABELS[effectiveSource] || SOURCE_LABELS[source] || source,
        error_category: cat,
        error_category_label: categoryLabel(cat),
        error_message: errorMsg,
        file_name: isAppLog ? (row.component || null) : (row.file_name || null),
        file_url: isAppLog ? null : (row.file_url || null),
        company_id: row.company_id || null,
        company_name: row.company_id ? (companyById.get(row.company_id) as string || null) : null,
        user_id: row.user_id || null,
        user_name: (isAppLog && row.component === 'process-mailgun-webhook')
          ? 'Mailgun'
          : (!isAppLog && row.metadata?.source === 'email_alias')
            ? 'Mailgun'
            : (row.user_id ? (profileByUserId.get(row.user_id) as string || null) : null),
        context: isAppLog ? (row.context || null) : null,
      });
    }
  }

  // KPI: compute before filtering
  const totalErrors = allErrors.length;
  const now = Date.now();
  const last24hErrors = allErrors.filter(e => now - new Date(e.created_at).getTime() < 86400_000).length;

  // Most affected company
  const companyErrorCounts = new Map<string, { id: string; name: string; count: number }>();
  for (const e of allErrors) {
    if (!e.company_id) continue;
    const existing = companyErrorCounts.get(e.company_id);
    if (existing) existing.count++;
    else companyErrorCounts.set(e.company_id, { id: e.company_id, name: e.company_name || "—", count: 1 });
  }
  let mostAffectedCompany: { id: string; name: string; errorCount: number } | null = null;
  for (const v of companyErrorCounts.values()) {
    if (!mostAffectedCompany || v.count > mostAffectedCompany.errorCount) {
      mostAffectedCompany = { id: v.id, name: v.name, errorCount: v.count };
    }
  }

  // Most affected user
  const userErrorCounts = new Map<string, { id: string; name: string; count: number }>();
  for (const e of allErrors) {
    if (!e.user_id) continue;
    const existing = userErrorCounts.get(e.user_id);
    if (existing) existing.count++;
    else userErrorCounts.set(e.user_id, { id: e.user_id, name: e.user_name || "—", count: 1 });
  }
  let mostAffectedUser: { id: string; name: string; errorCount: number } | null = null;
  for (const v of userErrorCounts.values()) {
    if (!mostAffectedUser || v.count > mostAffectedUser.errorCount) {
      mostAffectedUser = { id: v.id, name: v.name, errorCount: v.count };
    }
  }

  // Top error category
  const categoryCounts = new Map<string, number>();
  for (const e of allErrors) {
    categoryCounts.set(e.error_category, (categoryCounts.get(e.error_category) || 0) + 1);
  }
  let topErrorCategory: { category: string; label: string; count: number } | null = null;
  for (const [cat, cnt] of categoryCounts) {
    if (!topErrorCategory || cnt > topErrorCategory.count) {
      topErrorCategory = { category: cat, label: categoryLabel(cat), count: cnt };
    }
  }

  // Apply filters
  if (filterCompanyId) allErrors = allErrors.filter(e => e.company_id === filterCompanyId);
  if (filterUserId) allErrors = allErrors.filter(e => e.user_id === filterUserId);
  // Source filter: 'uploads' = minden upload tábla; egyedi source: exact/prefix match
  if (filterSource) {
    if (filterSource === 'uploads') {
      allErrors = allErrors.filter(e => UPLOAD_SOURCES.has(e.source));
    } else {
      allErrors = allErrors.filter(e => e.source === filterSource || e.source.startsWith(filterSource + ':'));
    }
  }
  // filterCategory a 3 fő csoport egyike: 'Application' | 'Mailgun' | 'Worker'
  if (filterCategory) allErrors = allErrors.filter(e => e.error_category_label === filterCategory);
  if (dateFrom) {
    const d = new Date(`${dateFrom}T00:00:00.000Z`).getTime();
    allErrors = allErrors.filter(e => new Date(e.created_at).getTime() >= d);
  }
  if (dateTo) {
    const d = new Date(`${dateTo}T23:59:59.999Z`).getTime();
    allErrors = allErrors.filter(e => new Date(e.created_at).getTime() <= d);
  }
  if (search) {
    allErrors = allErrors.filter(e =>
      (e.error_message || "").toLowerCase().includes(search) ||
      (e.file_name || "").toLowerCase().includes(search) ||
      (e.company_name || "").toLowerCase().includes(search) ||
      (e.user_name || "").toLowerCase().includes(search)
    );
  }

  // Sort
  const allowedSort = new Set(["created_at", "source", "error_category"]);
  const key = allowedSort.has(sortBy) ? sortBy : "created_at";
  const dir = sortDir === "asc" ? 1 : -1;
  allErrors.sort((a, b) => {
    if (key === "created_at") {
      return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
    }
    return ((a as any)[key] || "").localeCompare((b as any)[key] || "") * dir;
  });

  const totalRows = allErrors.length;
  const paged = allErrors.slice(page * pageSize, page * pageSize + pageSize);

  return {
    totalErrors,
    last24hErrors,
    mostAffectedCompany,
    mostAffectedUser,
    topErrorCategory,
    totalRows,
    errors: paged,
  };
}

async function deleteErrors(
  admin: ReturnType<typeof createClient>,
  body: { ids?: Array<{ source: string; id: string }> },
) {
  if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return { deleted: 0, error: null };
  }

  // Group by source table
  const bySource = new Map<string, string[]>();
  for (const item of body.ids) {
    if (!item.source || !item.id) continue;
    if (!bySource.has(item.source)) bySource.set(item.source, []);
    bySource.get(item.source)!.push(item.id);
  }

  const validTables = new Set([
    "invoice_uploads", "transaction_uploads", "report_uploads",
    "gl_upload_notifications", "nav_sync_logs", "bank_statement_uploads",
    "app_error_logs",
  ]);

  let totalDeleted = 0;
  const errors: string[] = [];

  for (const [rawSource, ids] of bySource) {
    // Normalize sub-sources: 'app_error_logs:frontend' → 'app_error_logs'
    const source = rawSource.includes(':') ? rawSource.split(':')[0] : rawSource;
    if (!validTables.has(source)) {
      errors.push(`Invalid source: ${rawSource}`);
      continue;
    }

    if (source === "app_error_logs") {
      // Frontend logs: actually DELETE (no processing_status to dismiss)
      const { error, count } = await admin
        .from("app_error_logs")
        .delete()
        .in("id", ids);

      if (error) {
        errors.push(`${source}: ${error.message}`);
      } else {
        totalDeleted += count || 0;
      }
    } else {
      // Upload tables: set status to "dismissed" (preserve the record)
      const statusField = source === "nav_sync_logs" ? "status" : "processing_status";
      const { error, count } = await admin
        .from(source)
        .update({
          [statusField]: "dismissed",
          error_message: null,
        } as any)
        .in("id", ids)
        .eq(statusField, "error");

      if (error) {
        errors.push(`${source}: ${error.message}`);
      } else {
        totalDeleted += count || 0;
      }
    }
  }

  return {
    deleted: totalDeleted,
    error: errors.length > 0 ? errors.join("; ") : null,
  };
}

async function deleteAllErrors(
  admin: ReturnType<typeof createClient>,
) {
  const errors: string[] = [];
  let totalDeleted = 0;

  // 1. DELETE all app_error_logs
  const { error: appErr, count: appCount } = await admin
    .from("app_error_logs")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // match all rows
  if (appErr) errors.push(`app_error_logs: ${appErr.message}`);
  else totalDeleted += appCount || 0;

  // 2. Dismiss all error-status uploads in each source table
  const uploadTables = [
    { table: "invoice_uploads", statusField: "processing_status" },
    { table: "transaction_uploads", statusField: "processing_status" },
    { table: "report_uploads", statusField: "processing_status" },
    { table: "gl_upload_notifications", statusField: "processing_status" },
    { table: "nav_sync_logs", statusField: "status" },
    { table: "bank_statement_uploads", statusField: "processing_status" },
  ];

  for (const { table, statusField } of uploadTables) {
    const { error, count } = await admin
      .from(table)
      .update({ [statusField]: "dismissed", error_message: null } as any)
      .eq(statusField, "error");
    if (error) errors.push(`${table}: ${error.message}`);
    else totalDeleted += count || 0;
  }

  return {
    deleted: totalDeleted,
    error: errors.length > 0 ? errors.join("; ") : null,
  };
}

// ─── Retry errors ────────────────────────────────────
const QUEUE_MAP: Record<string, string> = {
  invoice_uploads: "invoice_jobs",
  transaction_uploads: "transaction_jobs",
  gl_upload_notifications: "gl_classification_jobs",
};

const RETRY_SELECT: Record<string, string> = {
  invoice_uploads: "id, user_id, company_id, file_url, file_name, document_category",
  transaction_uploads: "id, user_id, company_id, file_url, file_name",
  gl_upload_notifications: "id, company_id",
};

function buildQueuePayload(source: string, row: any): Record<string, unknown> {
  if (source === "invoice_uploads") {
    return {
      id: row.id,
      user_id: row.user_id,
      company_id: row.company_id,
      file_url: row.file_url,
      file_name: row.file_name,
      document_category: row.document_category,
      source: "invoice_uploads",
    };
  }
  if (source === "transaction_uploads") {
    return {
      id: row.id,
      user_id: row.user_id,
      company_id: row.company_id,
      file_url: row.file_url,
      file_name: row.file_name,
      source: "transaction_uploads",
    };
  }
  if (source === "gl_upload_notifications") {
    return {
      id: row.id,
      company_id: row.company_id,
      source: "gl_upload_notifications",
    };
  }
  return { id: row.id, source };
}

async function retryErrors(
  admin: ReturnType<typeof createClient>,
  body: {
    ids?: Array<{ source: string; id: string }>;
    targetQueue?: string;
    targetCategory?: string | null;
  },
) {
  if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return { retried: 0, error: null };
  }

  const validQueues = new Set(Object.values(QUEUE_MAP));
  const effectiveQueue = body.targetQueue && validQueues.has(body.targetQueue)
    ? body.targetQueue
    : null;

  // Group by source table
  const bySource = new Map<string, string[]>();
  for (const item of body.ids) {
    if (!item.source || !item.id) continue;
    if (!bySource.has(item.source)) bySource.set(item.source, []);
    bySource.get(item.source)!.push(item.id);
  }

  let totalRetried = 0;
  const errors: string[] = [];

  for (const [rawSource, ids] of bySource) {
    // Normalize sub-sources: 'app_error_logs:frontend' → 'app_error_logs'
    const source = rawSource.includes(':') ? rawSource.split(':')[0] : rawSource;
    const queueName = effectiveQueue || QUEUE_MAP[source];
    if (!queueName) {
      errors.push(`Retry not supported for ${rawSource}`);
      continue;
    }

    // 1. Fetch the row data needed for PGMQ payload
    const selectCols = RETRY_SELECT[source] || "id";
    const { data: rows, error: fetchErr } = await admin
      .from(source)
      .select(selectCols)
      .in("id", ids);

    if (fetchErr) {
      errors.push(`${source} fetch: ${fetchErr.message}`);
      continue;
    }

    if (!rows || rows.length === 0) {
      errors.push(`${source}: no rows found`);
      continue;
    }

    // 2. Reset status to pending + clear error + optionally update document_category
    const statusField = "processing_status";
    const updatePayload: Record<string, unknown> = {
      [statusField]: "pending",
      error_message: null,
    };

    // If targetCategory is provided and source supports it, update document_category
    if (body.targetCategory !== undefined && body.targetCategory !== null && source === "invoice_uploads") {
      updatePayload.document_category = body.targetCategory;
    }

    const { error: updateErr } = await admin
      .from(source)
      .update(updatePayload as any)
      .in("id", ids);

    if (updateErr) {
      errors.push(`${source} update: ${updateErr.message}`);
      continue;
    }

    // 3. Send each row to the PGMQ queue via RPC
    for (const row of rows) {
      const payload = buildQueuePayload(source, row);
      // Override document_category in the payload if changed
      if (body.targetCategory !== undefined && body.targetCategory !== null && source === "invoice_uploads") {
        payload.document_category = body.targetCategory;
      }

      const { error: rpcErr } = await admin.rpc("pgmq_send_retry", {
        queue_name: queueName,
        msg: payload,
      });

      if (rpcErr) {
        console.error(`[MANAGEMENT-STATS] pgmq_send_retry failed for ${source}/${row.id}:`, rpcErr.message);
        errors.push(`${source}/${row.id}: queue send failed — ${rpcErr.message}`);
      } else {
        totalRetried++;
      }
    }
  }

  return {
    retried: totalRetried,
    error: errors.length > 0 ? errors.join("; ") : null,
  };
}

// ─── User Permissions (for Control Center) ───────────
const EAISYBILL_MODULES = [
  'dashboard', 'categories', 'projects', 'partners',
  'invoices', 'receivables', 'transactions', 'petty_cash',
  'general_ledger', 'profit_loss', 'balance_sheet', 'annual_report', 'vat_return',
  'salaries', 'working_time', 'fixed_assets',
  'integrations', 'exchange_rates', 'upload', 'tickets', 'settings',
  'shipments', 'shipment_import', 'shipment_matching',
];

const ACCOUNTY_MODULES = [
  'portfolio', 'missing_invoices', 'tax_calendar',
  'reports', 'approval_queue', 'alerts', 'nav_deadlines',
  'payroll', 'onboarding', 'tao', 'settings',
  'admin_audit', 'admin_gdpr', 'admin_templates', 'admin_job_codes',
  'admin_tax_params', 'admin_legal', 'admin_office', 'admin_permissions',
  'admin_accountants', 'tickets', 'ai_assistant', 'help', 'profile',
];

const EAISYBILL_ADMIN_ONLY = new Set(['salaries', 'integrations']);
const EAISYBILL_ASSISTANT = new Set([
  'dashboard', 'categories', 'projects', 'partners', 'invoices', 'receivables',
  'transactions', 'petty_cash', 'upload', 'tickets', 'exchange_rates', 'settings'
]);
const EAISYBILL_VIEWER = new Set([
  'dashboard', 'categories', 'projects', 'partners', 'invoices', 'receivables',
  'transactions', 'petty_cash', 'exchange_rates', 'tickets', 'settings'
]);
const EAISYBILL_EMPLOYEE = new Set(['working_time']);

function getEaisybillDefault(role: string | null | undefined, module: string): { canRead: boolean; canWrite: boolean } {
  if (module === 'shipments' || module === 'shipment_import' || module === 'shipment_matching') {
    return { canRead: false, canWrite: false };
  }

  const r = (role || "").toLowerCase();
  const isAdmin = r === 'admin' || r === 'owner' || r === 'ceo';
  if (isAdmin) return { canRead: true, canWrite: true };

  if (r === 'member') {
    const canAccess = !EAISYBILL_ADMIN_ONLY.has(module) || module === 'working_time';
    const canWrite = canAccess && module !== 'settings';
    return { canRead: canAccess, canWrite };
  }
  if (r === 'assistant') {
    const canAccess = EAISYBILL_ASSISTANT.has(module);
    const canWrite = canAccess && module !== 'settings';
    return { canRead: canAccess, canWrite };
  }
  if (r === 'viewer') {
    const canAccess = EAISYBILL_VIEWER.has(module);
    return { canRead: canAccess, canWrite: false };
  }
  if (r === 'employee') {
    const canAccess = EAISYBILL_EMPLOYEE.has(module);
    return { canRead: canAccess, canWrite: canAccess };
  }
  return { canRead: false, canWrite: false };
}

const ACCOUNTY_ADMIN_ONLY = new Set([
  'admin_audit', 'admin_gdpr', 'admin_templates', 'admin_job_codes',
  'admin_tax_params', 'admin_legal', 'admin_office', 'admin_permissions',
  'admin_accountants', 'onboarding',
]);
const ACCOUNTY_SENIOR_AND_ADMIN = new Set([
  'reports', 'approval_queue', 'alerts', 'nav_deadlines', 'settings',
]);
const ACCOUNTY_ALWAYS = new Set([
  'portfolio', 'missing_invoices', 'tax_calendar', 'payroll',
  'tao', 'tickets', 'ai_assistant', 'help', 'profile',
]);

function getAccountyDefault(role: string | null | undefined, module: string): { canRead: boolean; canWrite: boolean } {
  const r = (role || "").toLowerCase();
  const isAdmin = r === 'iroda_admin' || r === 'admin';
  const isSenior = isAdmin || r === 'senior_könyvelő' || r === 'senior_konyvelo' || r === 'senior';

  if (isAdmin) return { canRead: true, canWrite: true };

  let canRead = false;
  if (ACCOUNTY_ALWAYS.has(module)) {
    canRead = true;
  } else if (ACCOUNTY_SENIOR_AND_ADMIN.has(module)) {
    canRead = isSenior;
  } else if (!ACCOUNTY_ADMIN_ONLY.has(module)) {
    canRead = true;
  }

  let canWrite = false;
  if (isAdmin) {
    canWrite = true;
  } else if (isSenior) {
    canWrite = !ACCOUNTY_ADMIN_ONLY.has(module);
  } else {
    canWrite = canRead && !ACCOUNTY_ADMIN_ONLY.has(module) && !ACCOUNTY_SENIOR_AND_ADMIN.has(module);
  }

  return { canRead, canWrite };
}

async function buildUserPermissions(admin: ReturnType<typeof createClient>, userId: string) {
  // Fetch user info
  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const userEmail = userData?.user?.email || "—";

  const { data: profileData } = await admin
    .from("profiles")
    .select("name, role, is_support_admin")
    .eq("user_id", userId)
    .maybeSingle();

  // Fetch eaisybill memberships (company_members)
  const { data: eaisybillMemberships } = await admin
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", userId);

  // Fetch accounty memberships (accounty_assignments)
  const { data: accountyAssignments } = await admin
    .from("accounty_assignments")
    .select("company_id, accounting_firm_id, role")
    .eq("accountant_user_id", userId);

  // Fetch company names
  const allCompanyIds = new Set<string>();
  for (const m of eaisybillMemberships || []) allCompanyIds.add(m.company_id);
  for (const a of accountyAssignments || []) {
    allCompanyIds.add(a.company_id);
    if (a.accounting_firm_id) allCompanyIds.add(a.accounting_firm_id);
  }

  const { data: companies } = await admin
    .from("companies")
    .select("id, name")
    .in("id", [...allCompanyIds]);

  const companyNameMap = new Map((companies || []).map((c: any) => [c.id, c.name]));

  // Fetch eaisybill module permission overrides
  const { data: eaisybillPerms } = await admin
    .from("eaisybill_module_permissions")
    .select("company_id, module_name, can_read, can_write")
    .eq("user_id", userId);

  const ebPermMap = new Map<string, Map<string, { can_read: boolean; can_write: boolean }>>();
  for (const p of (eaisybillPerms || []) as any[]) {
    if (!ebPermMap.has(p.company_id)) ebPermMap.set(p.company_id, new Map());
    ebPermMap.get(p.company_id)!.set(p.module_name, { can_read: p.can_read, can_write: p.can_write });
  }

  // Fetch accounty module permission overrides
  const { data: accountyPerms } = await admin
    .from("accounty_module_permissions")
    .select("accounting_firm_id, module_name, can_read, can_write")
    .eq("user_id", userId);

  const acPermMap = new Map<string, Map<string, { can_read: boolean; can_write: boolean }>>();
  for (const p of (accountyPerms || []) as any[]) {
    if (!acPermMap.has(p.accounting_firm_id)) acPermMap.set(p.accounting_firm_id, new Map());
    acPermMap.get(p.accounting_firm_id)!.set(p.module_name, { can_read: p.can_read, can_write: p.can_write });
  }

  // Build eaisybill sections
  const eaisybill = (eaisybillMemberships || []).map((m: any) => ({
    companyId: m.company_id,
    companyName: companyNameMap.get(m.company_id) || "—",
    role: m.role,
    modules: EAISYBILL_MODULES.map(mod => {
      const override = ebPermMap.get(m.company_id)?.get(mod);
      const defaults = getEaisybillDefault(m.role, mod);
      return {
        module: mod,
        canRead: override?.can_read ?? defaults.canRead,
        canWrite: override?.can_write ?? defaults.canWrite,
        isOverride: !!override,
      };
    }),
  }));

  // Build accounty sections
  const accounty = (accountyAssignments || []).map((a: any) => ({
    firmId: a.accounting_firm_id,
    firmName: companyNameMap.get(a.accounting_firm_id) || "—",
    companyId: a.company_id,
    companyName: companyNameMap.get(a.company_id) || "—",
    role: a.role,
    modules: ACCOUNTY_MODULES.map(mod => {
      const override = acPermMap.get(a.accounting_firm_id)?.get(mod);
      const defaults = getAccountyDefault(a.role, mod);
      return {
        module: mod,
        canRead: override?.can_read ?? defaults.canRead,
        canWrite: override?.can_write ?? defaults.canWrite,
        isOverride: !!override,
      };
    }),
  }));

  return {
    userId,
    email: userEmail,
    name: profileData?.name || "—",
    profileRole: profileData?.role || "user",
    isSupportAdmin: profileData?.is_support_admin || false,
    eaisybill,
    accounty,
  };
}

async function updatePermissions(
  admin: ReturnType<typeof createClient>,
  body: {
    userId?: string;
    platform?: "eaisybill" | "accounty";
    companyId?: string;
    firmId?: string;
    permissions?: Array<{ module: string; canRead: boolean; canWrite: boolean }>;
    isSupportAdmin?: boolean;
  },
) {
  if (!body.userId) {
    return { error: "Missing required field: userId" };
  }

  const errors: string[] = [];
  let updated = 0;

  if (body.isSupportAdmin !== undefined) {
    const { error } = await admin
      .from("profiles")
      .update({ is_support_admin: body.isSupportAdmin })
      .eq("user_id", body.userId);

    if (error) {
      errors.push(`is_support_admin: ${error.message}`);
    } else {
      updated++;
    }
  }

  if (body.platform && body.permissions) {
    if (body.platform === "eaisybill") {
      if (!body.companyId) return { error: "companyId required for eaisybill" };

      for (const perm of body.permissions) {
        const { error } = await admin
          .from("eaisybill_module_permissions")
          .upsert(
            {
              company_id: body.companyId,
              user_id: body.userId,
              module_name: perm.module,
              can_read: perm.canRead,
              can_write: perm.canWrite,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "company_id,user_id,module_name" },
          );

        if (error) {
          errors.push(`${perm.module}: ${error.message}`);
        } else {
          updated++;
        }
      }
    } else if (body.platform === "accounty") {
      if (!body.firmId) return { error: "firmId required for accounty" };

      for (const perm of body.permissions) {
        const { error } = await admin
          .from("accounty_module_permissions")
          .upsert(
            {
              accounting_firm_id: body.firmId,
              user_id: body.userId,
              module_name: perm.module,
              can_read: perm.canRead,
              can_write: perm.canWrite,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "accounting_firm_id,user_id,module_name" },
          );

        if (error) {
          errors.push(`${perm.module}: ${error.message}`);
        } else {
          updated++;
        }
      }
    }
  }

  return {
    updated,
    error: errors.length > 0 ? errors.join("; ") : null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FILES: Unified view across all 4 upload tables with server-side pagination
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// FILES: Unified view across all 4 upload tables with server-side pagination
// ─────────────────────────────────────────────────────────────────────────────
async function buildFiles(admin: ReturnType<typeof createClient>, url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "25", 10)));
  const offset = (page - 1) * pageSize;

  const companyId = url.searchParams.get("companyId") || "";
  const userId = url.searchParams.get("userId") || "";
  const fileType = url.searchParams.get("fileType") || ""; 
  const status = url.searchParams.get("status") || ""; 
  const search = url.searchParams.get("search") || "";
  const dateFrom = url.searchParams.get("dateFrom") || "";
  const dateTo = url.searchParams.get("dateTo") || "";
  const sortBy = url.searchParams.get("sortBy") || "created_at";
  const sortDir = url.searchParams.get("sortDir") === "asc" ? "ASC" : "DESC";

  const fetchTable = async (tableName: string, typeKey: string, typeLabel: string) => {
    if (fileType && fileType !== typeKey) return [];
    
    let q = admin.from(tableName).select("*");
    if (companyId) q = q.eq("company_id", companyId);
    if (userId) q = q.eq("user_id", userId);
    // NOTE: status filter is applied in-memory AFTER stats are computed
    if (search) q = q.or(`file_name.ilike.%${search}%,error_message.ilike.%${search}%`);
    if (dateFrom) q = q.gte("created_at", dateFrom);
    if (dateTo) q = q.lte("created_at", `${dateTo}T23:59:59`);
    
    q = q.order("created_at", { ascending: sortDir === "ASC" }).limit(500);
    const { data, error } = await q;
    if (error || !data) return [];
    return data.map((r: any) => ({ ...r, source_table: typeKey, file_type_label: typeLabel }));
  };

  const [invoiceRows, transactionRows, bankRows, reportRows] = await Promise.all([
    fetchTable("invoice_uploads", "invoice", "Számla"),
    fetchTable("transaction_uploads", "transaction", "Tranzakció"),
    fetchTable("bank_statement_uploads", "bank", "Bankkivonat"),
    fetchTable("report_uploads", "report", "Riport"),
  ]);

  let allRows = [...invoiceRows, ...transactionRows, ...bankRows, ...reportRows];

  const SUCCESS_STATUSES = new Set(["done", "completed", "processed"]);
  const ERROR_STATUSES = new Set(["error", "failed", "ignored", "dismissed", "webhook_failed"]);

  // Resolve Names manually since FKs might be missing or broken for PostgREST joins
  const [companiesRes, profilesRes] = await Promise.all([
    admin.from("companies").select("id, name"),
    admin.from("profiles").select("user_id, name")
  ]);

  const companyMap = new Map((companiesRes.data || []).map((c: any) => [c.id, c.name]));
  const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.name]));

  const mappedRows = allRows.map(row => {
    return {
      id: row.id,
      source_table: row.source_table,
      file_type_label: row.file_type_label,
      company_id: row.company_id,
      company_name: companyMap.get(row.company_id) || null,
      user_id: row.user_id,
      user_name: row.metadata?.source === 'email_alias' 
        ? 'Mailgun'
        : (row.user_id ? (profileMap.get(row.user_id) || null) : 'Mailgun'),
      user_email: row.metadata?.sender || null,
      file_name: row.file_name,
      file_size: row.file_size,
      file_type: row.file_type,
      file_url: row.file_url,
      upload_status: row.upload_status,
      processing_status: row.processing_status,
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });

  // Stats are computed from ALL rows (before status filter) so KPI cards always show global counts

  // Helper: a row is an error if its status is in ERROR_STATUSES OR it has an error_message
  const isError = (r: typeof mappedRows[0]) => ERROR_STATUSES.has(r.processing_status || "") || !!r.error_message;
  const isSuccess = (r: typeof mappedRows[0]) => !r.error_message && SUCCESS_STATUSES.has(r.processing_status || "");

  const stats = {
    totalCount: mappedRows.length,
    successCount: mappedRows.filter(isSuccess).length,
    errorCount: mappedRows.filter(isError).length,
    pendingCount: 0, // computed below
  };
  stats.pendingCount = stats.totalCount - stats.successCount - stats.errorCount;

  // Apply status filter in-memory AFTER stats
  let filteredRows = mappedRows;
  if (status) {
    const vals = status.split(",");
    const wantPending = vals.includes("pending");
    const wantError = vals.some(v => ERROR_STATUSES.has(v)) || vals.includes("pending") === false;
    filteredRows = mappedRows.filter(r => {
      const s = r.processing_status || "";
      // Explicit status match
      if (vals.includes(s)) return true;
      // Error category: also match rows with error_message regardless of processing_status
      if (isError(r) && !isSuccess(r)) {
        // Check if any error-related value is requested
        if (vals.some(v => ERROR_STATUSES.has(v))) return true;
      }
      // Pending category: anything not success and not error
      if (wantPending && !isSuccess(r) && !isError(r)) return true;
      return false;
    });
  }

  const safeSort = (['created_at', 'file_name', 'file_size', 'company_name', 'user_name', 'processing_status'].includes(sortBy) ? sortBy : 'created_at') as keyof typeof mappedRows[0];
  
  filteredRows.sort((a, b) => {
    const va = a[safeSort] ?? "";
    const vb = b[safeSort] ?? "";
    if (sortDir === "ASC") return va < vb ? -1 : va > vb ? 1 : 0;
    return va > vb ? -1 : va < vb ? 1 : 0;
  });

  return {
    totalRows: filteredRows.length,
    files: filteredRows.slice(offset, offset + pageSize),
    stats,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE FILE STATUS: batch update processing_status for selected files
// ─────────────────────────────────────────────────────────────────────────────
const VALID_TABLES: Record<string, string> = {
  invoice: "invoice_uploads",
  transaction: "transaction_uploads",
  bank: "bank_statement_uploads",
  report: "report_uploads",
};
const VALID_STATUSES = ["done", "pending", "error", "ignored", "processing"];

async function updateFileStatus(
  admin: ReturnType<typeof createClient>,
  body: { files?: Array<{ id: string; source_table: string }>; targetStatus?: string }
) {
  const { files, targetStatus } = body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return { error: "files array required", updated: 0 };
  }
  if (!targetStatus || !VALID_STATUSES.includes(targetStatus)) {
    return { error: `Invalid targetStatus. Valid: ${VALID_STATUSES.join(", ")}`, updated: 0 };
  }
  if (files.length > 200) {
    return { error: "Max 200 files per batch", updated: 0 };
  }

  // Map generic "done" to table-specific done status
  // invoice_uploads worker uses "processed", others use "completed"
  const DONE_STATUS_MAP: Record<string, string> = {
    invoice_uploads: "processed",
    transaction_uploads: "completed",
    bank_statement_uploads: "completed",
    report_uploads: "completed",
  };

  // Group files by source_table for batch updates
  const grouped = new Map<string, string[]>();
  for (const f of files) {
    const tableName = VALID_TABLES[f.source_table];
    if (!tableName) continue;
    const ids = grouped.get(tableName) || [];
    ids.push(f.id);
    grouped.set(tableName, ids);
  }

  let totalUpdated = 0;
  const errors: string[] = [];

  await Promise.all(
    Array.from(grouped.entries()).map(async ([tableName, ids]) => {
      // Resolve the actual status value for this table
      const resolvedStatus = targetStatus === "done"
        ? (DONE_STATUS_MAP[tableName] || "completed")
        : targetStatus;

      const { data, error } = await admin
        .from(tableName)
        .update({ processing_status: resolvedStatus, updated_at: new Date().toISOString() })
        .in("id", ids)
        .select("id");

      if (error) {
        errors.push(`${tableName}: ${error.message}`);
      } else {
        totalUpdated += data?.length ?? 0;
      }
    })
  );

  return {
    success: errors.length === 0,
    updated: totalUpdated,
    requested: files.length,
    ...(errors.length > 0 ? { errors } : {}),
  };
}
// ───────────────────────────────────────────────────────────────────────────────
// DELETE FILES: storage + DB row removal
// ───────────────────────────────────────────────────────────────────────────────

// Maps source_table identifier (short or full) to its storage bucket name
const SOURCE_TABLE_TO_BUCKET: Record<string, string> = {
  invoice:            "invoice-uploads",
  invoice_uploads:    "invoice-uploads",
  transaction:        "transactions",
  transaction_uploads:"transactions",
  bank:               "bank-statements",
  bank_statement_uploads: "bank-statements",
  report:             "report-uploads",
  report_uploads:     "report-uploads",
};

// Maps short key / full table name to the actual DB table name
const SOURCE_TABLE_TO_DB: Record<string, string> = {
  invoice:            "invoice_uploads",
  invoice_uploads:    "invoice_uploads",
  transaction:        "transaction_uploads",
  transaction_uploads:"transaction_uploads",
  bank:               "bank_statement_uploads",
  bank_statement_uploads: "bank_statement_uploads",
  report:             "report_uploads",
  report_uploads:     "report_uploads",
};

/**
 * Parses a Supabase Storage public URL and returns { bucket, path }.
 * Handles both /object/public/<bucket>/<path> and /object/authenticated/<bucket>/<path>.
 * Returns null if the URL cannot be parsed.
 */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    const match = url.match(/\/storage\/v1\/object\/(?:public|authenticated)\/([^/]+)\/(.+)/);
    if (!match) return null;
    return { bucket: match[1], path: match[2] };
  } catch {
    return null;
  }
}

async function deleteFiles(
  admin: ReturnType<typeof createClient>,
  body: {
    files?: Array<{ id: string; source_table: string; file_url: string | null }>;
    dbOnly?: boolean;
  }
) {
  const { files, dbOnly } = body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return { error: "files array required", deleted: 0 };
  }
  if (files.length > 200) {
    return { error: "Max 200 files per batch", deleted: 0 };
  }

  // Validate all source_tables before doing anything
  const invalidTables = files.filter(f => !SOURCE_TABLE_TO_DB[f.source_table]).map(f => f.source_table);
  if (invalidTables.length > 0) {
    return { error: `Invalid source_table values: ${[...new Set(invalidTables)].join(", ")}`, deleted: 0 };
  }

  let storageDeleted = 0;
  let dbOnlyDeleted = 0;
  const storageErrors: string[] = [];
  const dbErrors: string[] = [];

  // Process each file individually: storage first, then DB row
  await Promise.all(
    files.map(async (f) => {
      const dbTable = SOURCE_TABLE_TO_DB[f.source_table];

      // Step 1: Storage deletion (only if file_url exists and dbOnly is not true)
      if (f.file_url && !dbOnly) {
        const parsed = parseStorageUrl(f.file_url);
        if (parsed) {
          const { error: storageError } = await admin.storage
            .from(parsed.bucket)
            .remove([parsed.path]);
          if (storageError) {
            // Log but don't abort — still delete DB row
            storageErrors.push(`${f.id}: ${storageError.message}`);
            console.error(`[delete-files] Storage removal failed for ${f.id}:`, storageError.message);
          } else {
            storageDeleted++;
          }
        } else {
          storageErrors.push(`${f.id}: could not parse storage URL`);
        }
      } else {
        // No file_url or dbOnly is true — DB-only deletion
        dbOnlyDeleted++;
      }

      // Step 2: DB row deletion (always)
      const { error: dbError } = await admin
        .from(dbTable)
        .delete()
        .eq("id", f.id);

      if (dbError) {
        dbErrors.push(`${f.id}: ${dbError.message}`);
        console.error(`[delete-files] DB row deletion failed for ${f.id}:`, dbError.message);
      }
    })
  );

  const totalDeleted = storageDeleted + dbOnlyDeleted;

  return {
    success: dbErrors.length === 0,
    deleted: totalDeleted,
    storageDeleted,
    dbOnlyDeleted,
    requested: files.length,
    ...(storageErrors.length > 0 ? { storageErrors } : {}),
    ...(dbErrors.length > 0 ? { dbErrors } : {}),
  };
}


async function getActiveErrors(pc: any, periodSince?: string | null) {
  // Fetch all invoice errors
  let invQ = pc.client
    .from("invoice_uploads")
    .select("id, document_category, file_name, company_id, file_url, created_at, updated_at, error_message")
    .or("processing_status.eq.error,and(processing_status.eq.ignored,error_message.not.is.null)");
  if (periodSince) invQ = invQ.gte("updated_at", periodSince);
  const { data: invData } = await invQ;

  // Fetch all transaction errors
  let txQ = pc.client
    .from("transaction_uploads")
    .select("id, file_name, company_id, file_url, created_at, updated_at, error_message")
    .eq("processing_status", "error");
  if (periodSince) txQ = txQ.gte("updated_at", periodSince);
  const { data: txData } = await txQ;

  const invRows = invData || [];
  const txRows = txData || [];

  return { activeInv: invRows, activeTx: txRows };
}


// ═══════════════════════════════════════════════════════════════
// ─── Worker Status ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

async function buildWorkerStatus(admin: ReturnType<typeof createClient>, period: string = "all") {
  const HEALTH_THRESHOLD_SECONDS = 120;
  const now = new Date();
  const periodMs: Record<string, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  const ms = periodMs[period];
  const periodSince = ms ? new Date(now.getTime() - ms).toISOString() : null; // null = all time
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Generate last 7 day keys for sparklines
  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dayKeys.push(d.toISOString().substring(0, 10));
  }

  // ── Build cross-project client map ──
  // Each container writes heartbeats to PROD, but LLM costs to its OWN project.
  // container.supabase_project tells us which DB to query for that container's data.
  interface ProjectClient {
    name: string;
    client: ReturnType<typeof createClient>;
  }
  const projectClients: ProjectClient[] = [
    { name: "PROD", client: admin },
  ];

  // Add VSWEB client if secrets are available
  const vswebUrl = Deno.env.get("VSWEB_SUPABASE_URL");
  const vswebKey = Deno.env.get("VSWEB_SERVICE_ROLE_KEY");
  if (vswebUrl && vswebKey) {
    try {
      projectClients.push({ name: "VSWEB", client: createClient(vswebUrl, vswebKey) });
    } catch (e) { console.warn("[worker-status] VSWEB client creation failed:", e); }
  }

  // Add Thinkerman client if secrets are available
  const thinkUrl = Deno.env.get("THINKERMAN_SUPABASE_URL");
  const thinkKey = Deno.env.get("THINKERMAN_SERVICE_ROLE_KEY");
  if (thinkUrl && thinkKey) {
    try {
      projectClients.push({ name: "THINKERMAN", client: createClient(thinkUrl, thinkKey) });
    } catch (e) { console.warn("[worker-status] THINKERMAN client creation failed:", e); }
  }

  // Helper: get client for a given project name
  const getProjectClient = (projectName: string): ReturnType<typeof createClient> => {
    const pc = projectClients.find(p => p.name === projectName);
    return pc?.client || admin; // fallback to PROD
  };

  // ── 1. Container heartbeats (always from PROD — centralized) ──
  const { data: heartbeats } = await admin
    .from("worker_heartbeats")
    .select("*")
    .gt("last_heartbeat", new Date(now.getTime() - 3 * 60 * 1000).toISOString())
    .order("container_name");

  const activeContainers = (heartbeats || []).map((h: any) => {
    const lastBeat = new Date(h.last_heartbeat);
    const startedAt = new Date(h.started_at);
    const ageSec = (now.getTime() - lastBeat.getTime()) / 1000;
    return {
      container_name: h.container_name,
      host_ip: h.host_ip,
      supabase_project: h.supabase_project,
      started_at: h.started_at,
      last_heartbeat: h.last_heartbeat,
      is_healthy: ageSec < HEALTH_THRESHOLD_SECONDS,
      uptime_seconds: Math.floor((now.getTime() - startedAt.getTime()) / 1000),
      version: h.version,
      active_queues: h.active_queues || [],
      cpu_usage: h.cpu_usage ?? 0,
      ram_usage: h.ram_usage ?? 0,
      jobs_24h: 0,
      avg_duration_ms: 0,
      total_cost_24h: 0,
    };
  });

  // Expected replicas per tenant/service type
  const expectedReplicas: Record<string, { count: number, project: string }> = {
    "worker-prod": { count: 4, project: "PROD" },
    "worker-vsweb": { count: 1, project: "VSWEB" },
    "worker-thinkerman": { count: 1, project: "THINKERMAN" },
  };

  const containers = [...activeContainers];

  // Count active ones by base service type
  for (const [baseName, spec] of Object.entries(expectedReplicas)) {
    const activeForService = activeContainers.filter(c => 
      c.container_name === baseName || c.container_name.startsWith(`${baseName}-`)
    );
    
    const missingCount = spec.count - activeForService.length;
    if (missingCount > 0) {
      for (let i = 0; i < missingCount; i++) {
        containers.push({
          container_name: `${baseName}-offline-${i + 1}`,
          host_ip: "unknown",
          supabase_project: spec.project,
          started_at: new Date().toISOString(),
          last_heartbeat: new Date(0).toISOString(), // Epoch -> force unhealthy
          is_healthy: false,
          uptime_seconds: 0,
          version: "offline",
          active_queues: [],
          cpu_usage: 0,
          ram_usage: 0,
          jobs_24h: 0,
          avg_duration_ms: 0,
          total_cost_24h: 0,
        });
      }
    }
  }

  // ── 2. PGMQ queue metrics (per project) ──
  let queues: any[] = [];
  for (const pc of projectClients) {
    try {
      const { data: queueMetrics } = await pc.client.rpc("pgmq_metrics_all");
      for (const q of (queueMetrics || [])) {
        const queueEntry: any = {
          queue_name: `${pc.name}:${q.queue_name}`,
          queue_length: q.queue_length ?? 0,
          total_messages: q.total_messages ?? 0,
          newest_msg_age_sec: q.newest_msg_age_sec,
          oldest_msg_age_sec: q.oldest_msg_age_sec,
          project: pc.name,
          pending_items: [],
        };

        // Peek into non-empty queues to get item details
        if ((q.queue_length ?? 0) > 0) {
          try {
            const { data: items } = await pc.client.rpc("peek_queue_items", {
              queue_name: q.queue_name,
              max_items: 20,
            });
            queueEntry.pending_items = (items || []).map((item: any) => ({
              msg_id: item.msg_id,
              enqueued_at: item.enqueued_at,
              read_ct: item.read_ct,
              file_name: item.file_name,
              company_name: item.company_name,
              source: item.source || 'upload',
              document_category: item.document_category || 'unknown',
            }));
          } catch (peekErr) {
            console.warn(`[worker-status] peek failed for ${pc.name}:${q.queue_name}:`, peekErr);
          }
        }

        queues.push(queueEntry);
      }
    } catch (e) {
      console.warn(`[worker-status] pgmq_metrics_all failed for ${pc.name}:`, e);
    }
  }

  // ── 3. LLM pipeline stats via SQL aggregation (no row limit!) ──
  const pipelineMap = new Map<string, {
    jobs: number;
    totalDuration: number;
    totalCost: number;
  }>();
  const workerMap = new Map<string, { jobs: number; totalDuration: number; totalCost: number }>();

  const llmFetches = projectClients.map(async (pc) => {
    try {
      const { data } = await pc.client.rpc("worker_pipeline_stats", {
        since_ts: periodSince || undefined,
      });
      return { project: pc.name, rows: data || [] };
    } catch (e) {
      console.warn(`[worker-status] worker_pipeline_stats RPC failed for ${pc.name}:`, e);
      return { project: pc.name, rows: [] };
    }
  });
  const llmResults = await Promise.all(llmFetches);

  for (const { project, rows } of llmResults) {
    for (const row of rows) {
      const p = row.pipeline || "unknown";
      const wid = row.worker_id || `worker-${project.toLowerCase()}`;
      const pipeKey = `${project}:${p}`;

      if (!pipelineMap.has(pipeKey)) {
        pipelineMap.set(pipeKey, { jobs: 0, totalDuration: 0, totalCost: 0 });
      }
      const pm = pipelineMap.get(pipeKey)!;
      pm.jobs += Number(row.jobs) || 0;
      pm.totalDuration += Number(row.total_duration_ms) || 0;
      pm.totalCost += parseFloat(row.total_cost) || 0;

      // Worker aggregation (per container)
      if (!workerMap.has(wid)) {
        workerMap.set(wid, { jobs: 0, totalDuration: 0, totalCost: 0 });
      }
      const wm = workerMap.get(wid)!;
      wm.jobs += Number(row.jobs) || 0;
      wm.totalDuration += Number(row.total_duration_ms) || 0;
      wm.totalCost += parseFloat(row.total_cost) || 0;
    }
  }

  // Fill per-container stats
  for (const c of containers) {
    const wStats = workerMap.get(c.container_name);
    if (wStats) {
      c.jobs_24h = wStats.jobs;
      c.avg_duration_ms = wStats.jobs > 0 ? Math.round(wStats.totalDuration / wStats.jobs) : 0;
      c.total_cost_24h = Math.round(wStats.totalCost * 100) / 100;
    }
  }

  // ── 3b. Daily counts for sparkline (last 7 days, via SQL aggregation) ──
  const weeklyFetches = projectClients.map(async (pc) => {
    try {
      const { data } = await pc.client.rpc("worker_daily_counts", { days_back: 7 });
      return { project: pc.name, rows: data || [] };
    } catch (e) {
      return { project: pc.name, rows: [] };
    }
  });
  const weeklyResults = await Promise.all(weeklyFetches);

  const dailyMap = new Map<string, Map<string, number>>();
  for (const { project, rows } of weeklyResults) {
    for (const row of rows) {
      const pipeKey = `${project}:${row.pipeline || "unknown"}`;
      const dayKey = String(row.day_key).substring(0, 10);
      if (!dailyMap.has(pipeKey)) dailyMap.set(pipeKey, new Map());
      const dm = dailyMap.get(pipeKey)!;
      dm.set(dayKey, (dm.get(dayKey) || 0) + Number(row.cnt));
    }
  }

  // ── 4. Worker error count — uploads with processing_status='error' ──
  let totalErrors24h = 0;
  const pipelineErrorMap = new Map<string, number>();

  const errorFetches = projectClients.map(async (pc) => {
    try {
      const { activeInv, activeTx } = await getActiveErrors(pc, periodSince);
      
      activeInv.forEach((r: any) => {
        const cat = r.document_category || "invoice";
        pipelineErrorMap.set(cat, (pipelineErrorMap.get(cat) || 0) + 1);
      });
      
      if (activeTx.length > 0) {
        pipelineErrorMap.set("transaction", (pipelineErrorMap.get("transaction") || 0) + activeTx.length);
      }

      return activeInv.length + activeTx.length;
    } catch (_) {
      return 0;
    }
  });
  const errorResults = await Promise.all(errorFetches);
  totalErrors24h = errorResults.reduce((s, c) => s + c, 0);

  // Build pipeline results (per project)
  const pipelines = Array.from(pipelineMap.entries()).map(([pipeKey, data]) => {
    const [project, ...rest] = pipeKey.split(':');
    const pipeline = rest.join(':');
    return {
      pipeline,
      project,
      jobs_24h: data.jobs,
      avg_duration_ms: data.jobs > 0 ? Math.round(data.totalDuration / data.jobs) : 0,
      total_cost_usd: Math.round(data.totalCost * 1000) / 1000,
      error_count_24h: pipelineErrorMap.get(pipeline) || 0,
      daily_counts: dayKeys.map(dk => (dailyMap.get(pipeKey)?.get(dk)) || 0),
    };
  });
  pipelines.sort((a, b) => b.jobs_24h - a.jobs_24h);

  // ── 5. Recent jobs (last 20, all projects merged) ──
  const recentFetches = projectClients.map(async (pc) => {
    try {
      let recentQuery = pc.client
        .from("llm_koltsegek")
        .select("id, created_at, pipeline, file_name, company_id, model_name, total_tokens, estimated_cost_usd, processing_duration_ms, worker_id, upload_id")
        .order("created_at", { ascending: false })
        .limit(50);
      if (periodSince) recentQuery = recentQuery.gte("created_at", periodSince);
      const { data } = await recentQuery;

      // Resolve company names from the same project
      const companyIds = [...new Set((data || []).map((r: any) => r.company_id).filter(Boolean))];
      let companyNameMap = new Map<string, string>();
      if (companyIds.length > 0) {
        const { data: companies } = await pc.client
          .from("companies")
          .select("id, name")
          .in("id", companyIds);
        for (const c of (companies || [])) {
          companyNameMap.set(c.id, c.name);
        }
      }

      // Resolve upload statuses
      const uploadIds = [...new Set((data || []).map((r: any) => r.upload_id).filter(Boolean))];
      const uploadStatusMap = new Map<string, string>();
      const uploadUrlMap = new Map<string, string>();
      const uploadSourceMap = new Map<string, string>();

      if (uploadIds.length > 0) {
        // Query invoice_uploads
        try {
          const { data: invUploads } = await pc.client
            .from("invoice_uploads")
            .select("id, processing_status, error_message, file_url")
            .in("id", uploadIds);
          for (const u of (invUploads || [])) {
            const hasError = u.processing_status === "error" || u.processing_status === "failed" || !!u.error_message;
            uploadStatusMap.set(u.id, hasError ? "ERROR" : "OK");
            if (u.file_url) uploadUrlMap.set(u.id, u.file_url);
            uploadSourceMap.set(u.id, "invoice_uploads");
          }
        } catch (_) {}

        // Query transaction_uploads
        try {
          const { data: txUploads } = await pc.client
            .from("transaction_uploads")
            .select("id, processing_status, error_message, file_url")
            .in("id", uploadIds);
          for (const u of (txUploads || [])) {
            const hasError = u.processing_status === "error" || u.processing_status === "failed" || !!u.error_message;
            uploadStatusMap.set(u.id, hasError ? "ERROR" : "OK");
            if (u.file_url) uploadUrlMap.set(u.id, u.file_url);
            uploadSourceMap.set(u.id, "transaction_uploads");
          }
        } catch (_) {}

        // Query bank_statement_uploads
        try {
          const { data: bankUploads } = await pc.client
            .from("bank_statement_uploads")
            .select("id, processing_status, error_message, file_url")
            .in("id", uploadIds);
          for (const u of (bankUploads || [])) {
            const hasError = u.processing_status === "error" || u.processing_status === "failed" || !!u.error_message;
            uploadStatusMap.set(u.id, hasError ? "ERROR" : "OK");
            if (u.file_url) uploadUrlMap.set(u.id, u.file_url);
            uploadSourceMap.set(u.id, "bank_statement_uploads");
          }
        } catch (_) {}

        // Query report_uploads
        try {
          const { data: reportUploads } = await pc.client
            .from("report_uploads")
            .select("id, processing_status, error_message, file_url")
            .in("id", uploadIds);
          for (const u of (reportUploads || [])) {
            const hasError = u.processing_status === "error" || u.processing_status === "failed" || !!u.error_message;
            uploadStatusMap.set(u.id, hasError ? "ERROR" : "OK");
            if (u.file_url) uploadUrlMap.set(u.id, u.file_url);
            uploadSourceMap.set(u.id, "report_uploads");
          }
        } catch (_) {}
      }

      return (data || [])
        .map((r: any) => ({
          id: r.id,
          created_at: r.created_at,
          pipeline: r.pipeline,
          file_name: r.file_name,
          company_name: companyNameMap.get(r.company_id) || null,
          model_name: r.model_name,
          total_tokens: r.total_tokens || 0,
          estimated_cost_usd: parseFloat(r.estimated_cost_usd) || 0,
          processing_duration_ms: r.processing_duration_ms || 0,
          worker_id: r.worker_id || `worker-${pc.name.toLowerCase()}`,
          project: pc.name,
          upload_id: r.upload_id || null,
          status: r.upload_id ? (uploadStatusMap.get(r.upload_id) || "OK") : "OK",
          file_url: r.upload_id ? (uploadUrlMap.get(r.upload_id) || null) : null,
          source: r.upload_id ? (uploadSourceMap.get(r.upload_id) || null) : null,
        }))
        .filter((r: any) => !r.upload_id || r.source !== null);
    } catch (e) {
      return [];
    }
  });
  const recentResults = await Promise.all(recentFetches);
  // Keep top 20 per project so every container always has recent jobs
  const recent_jobs = recentResults
    .map(projectJobs => 
      projectJobs
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20)
    )
    .flat()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // ── 5c. Fetch error uploads (up to 100 per project) ──
  const errorJobsFetches = projectClients.map(async (pc) => {
    const results: any[] = [];

    try {
      const { activeInv, activeTx } = await getActiveErrors(pc, periodSince);

      for (const r of activeInv.slice(0, 100)) {
        results.push({
          id: r.id,
          upload_id: r.id,
          created_at: r.created_at,
          updated_at: r.updated_at,
          file_name: r.file_name,
          company_id: r.company_id,
          pipeline: r.document_category || "invoice",
          file_url: r.file_url,
          error_message: r.error_message,
          source: "invoice_uploads",
          project: pc.name,
          status: "ERROR",
        });
      }

      for (const r of activeTx.slice(0, 100)) {
        results.push({
          id: r.id,
          upload_id: r.id,
          created_at: r.created_at,
          updated_at: r.updated_at,
          file_name: r.file_name,
          company_id: r.company_id,
          pipeline: "transaction",
          file_url: r.file_url,
          error_message: r.error_message,
          source: "transaction_uploads",
          project: pc.name,
          status: "ERROR",
        });
      }
    } catch (_) {}

    // Resolve company names
    const companyIds = [...new Set(results.map((r: any) => r.company_id).filter(Boolean))];
    const companyNameMap = new Map<string, string>();
    if (companyIds.length > 0) {
      try {
        const { data: companies } = await pc.client
          .from("companies")
          .select("id, name")
          .in("id", companyIds);
        for (const c of (companies || [])) {
          companyNameMap.set(c.id, c.name);
        }
      } catch (_) {}
    }

    // Try to lookup cost and worker_id from llm_koltsegek
    const uploadIds = results.map(r => r.upload_id);
    const llmDetailsMap = new Map<string, { cost: number; worker_id: string; duration: number }>();
    if (uploadIds.length > 0) {
      try {
        const { data: llmCosts } = await pc.client
          .from("llm_koltsegek")
          .select("upload_id, estimated_cost_usd, worker_id, processing_duration_ms")
          .in("upload_id", uploadIds);
        for (const l of (llmCosts || [])) {
          if (l.upload_id) {
            const current = llmDetailsMap.get(l.upload_id) || { cost: 0, worker_id: l.worker_id, duration: 0 };
            current.cost += parseFloat(l.estimated_cost_usd) || 0;
            if (l.processing_duration_ms) {
              current.duration = Math.max(current.duration, l.processing_duration_ms);
            }
            if (l.worker_id) {
              current.worker_id = l.worker_id;
            }
            llmDetailsMap.set(l.upload_id, current);
          }
        }
      } catch (_) {}
    }

    return results.map(r => {
      const llm = llmDetailsMap.get(r.upload_id);
      const fallbackDuration = new Date(r.updated_at).getTime() - new Date(r.created_at).getTime();
      const safeFallback = (fallbackDuration > 0 && fallbackDuration < 300_000) ? fallbackDuration : 0;
      return {
        ...r,
        company_name: companyNameMap.get(r.company_id) || null,
        estimated_cost_usd: llm?.cost || 0,
        worker_id: llm?.worker_id || `worker-${pc.name.toLowerCase()}`,
        processing_duration_ms: llm?.duration || safeFallback,
      };
    });
  });

  const errorJobsResults = await Promise.all(errorJobsFetches);
  const error_jobs = errorJobsResults
    .flat()
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  // ── 5b. Currently processing items (all projects, both tables) ──
  const processingFetches = projectClients.map(async (pc) => {
    const results: any[] = [];
    
    // Query invoice_uploads
    try {
      const { data } = await pc.client
        .from("invoice_uploads")
        .select("id, file_name, company_id, processing_status, created_at, updated_at, document_category")
        .eq("processing_status", "processing")
        .order("updated_at", { ascending: false })
        .limit(50);
      for (const r of (data || [])) {
        results.push({ ...r, pipeline_type: "invoice" });
      }
    } catch (e) {
      console.warn(`[worker-status] invoice processing query failed for ${pc.name}:`, e);
    }

    // Query transaction_uploads
    try {
      const { data } = await pc.client
        .from("transaction_uploads")
        .select("id, file_name, company_id, processing_status, created_at, updated_at")
        .eq("processing_status", "processing")
        .order("updated_at", { ascending: false })
        .limit(50);
      for (const r of (data || [])) {
        results.push({
          ...r,
          pipeline_type: "transaction",
          document_category: "bank_statement",
          source: "upload",
        });
      }
    } catch (e) {
      console.warn(`[worker-status] transaction processing query failed for ${pc.name}:`, e);
    }

    // Resolve company names for all results
    const companyIds = [...new Set(results.map((r: any) => r.company_id).filter(Boolean))];
    let companyNameMap = new Map<string, string>();
    if (companyIds.length > 0) {
      try {
        const { data: companies } = await pc.client
          .from("companies")
          .select("id, name")
          .in("id", companyIds);
        for (const c of (companies || [])) {
          companyNameMap.set(c.id, c.name);
        }
      } catch (_) { /* best effort */ }
    }

    return results.map((r: any) => ({
      id: r.id,
      file_name: r.file_name,
      company_name: companyNameMap.get(r.company_id) || null,
      company_id: r.company_id,
      pipeline_type: r.pipeline_type,
      started_at: r.updated_at,
      created_at: r.created_at,
      document_category: r.document_category || 'unknown',
      source: r.source || 'upload',
      elapsed_sec: Math.floor((now.getTime() - new Date(r.updated_at).getTime()) / 1000),
      project: pc.name,
    }));
  });
  const processingResults = await Promise.all(processingFetches);
  const active_processing = processingResults.flat().sort((a, b) => a.elapsed_sec - b.elapsed_sec);

  // ── Summary KPIs ──
  const totalJobs24h = Array.from(pipelineMap.values()).reduce((s, p) => s + p.jobs, 0);
  const totalCost24h = Array.from(pipelineMap.values()).reduce((s, p) => s + p.totalCost, 0);
  const totalQueuePending = queues.reduce((s, q) => s + (q.queue_length || 0), 0);

  return {
    containers,
    queues,
    pipelines,
    recent_jobs,
    error_jobs,
    active_processing,
    summary: {
      healthy_containers: containers.filter((c: any) => c.is_healthy).length,
      total_containers: containers.length,
      total_queue_pending: totalQueuePending,
      total_processing: active_processing.length,
      total_jobs_24h: totalJobs24h,
      total_cost_24h: Math.round(totalCost24h * 100) / 100,
      total_errors_24h: totalErrors24h,
    },
  };
}

async function buildLLMCosts(admin: ReturnType<typeof createClient>, period: string) {
  const now = new Date();
  const periodMs: Record<string, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
  };
  const ms = periodMs[period];
  const since = ms ? new Date(now.getTime() - ms).toISOString() : null; // null = all time

  // Build cross-project clients
  interface PC { name: string; client: ReturnType<typeof createClient> }
  const projectClients: PC[] = [{ name: "PROD", client: admin }];
  const vswebUrl = Deno.env.get("VSWEB_SUPABASE_URL");
  const vswebKey = Deno.env.get("VSWEB_SERVICE_ROLE_KEY");
  if (vswebUrl && vswebKey) {
    try { projectClients.push({ name: "VSWEB", client: createClient(vswebUrl, vswebKey) }); } catch {}
  }
  const thinkUrl = Deno.env.get("THINKERMAN_SUPABASE_URL");
  const thinkKey = Deno.env.get("THINKERMAN_SERVICE_ROLE_KEY");
  if (thinkUrl && thinkKey) {
    try { projectClients.push({ name: "THINKERMAN", client: createClient(thinkUrl, thinkKey) }); } catch {}
  }

  // Fetch LLM data from all projects in parallel
  const fetches = projectClients.map(async (pc) => {
    try {
      let query = pc.client
        .from("llm_koltsegek")
        .select("pipeline, model_name, company_id, input_tokens, output_tokens, total_tokens, estimated_cost_usd, processing_duration_ms, created_at")
        .order("created_at", { ascending: false })
        .limit(10000);
      if (since) query = query.gte("created_at", since);
      const { data } = await query;
      // Also fetch company names
      const companyIds = [...new Set((data || []).map((r: any) => r.company_id).filter(Boolean))];
      let companyMap = new Map<string, string>();
      if (companyIds.length > 0) {
        const { data: companies } = await pc.client
          .from("companies")
          .select("id, name")
          .in("id", companyIds);
        for (const c of (companies || [])) companyMap.set(c.id, c.name);
      }
      return { project: pc.name, rows: data || [], companyMap };
    } catch (e) {
      console.warn(`[llm-costs] query failed for ${pc.name}:`, e);
      return { project: pc.name, rows: [], companyMap: new Map<string, string>() };
    }
  });
  const results = await Promise.all(fetches);

  // Aggregation maps
  let totalCost = 0, totalJobs = 0, totalTokens = 0, totalInputTokens = 0, totalOutputTokens = 0;
  const pipelineAgg = new Map<string, { cost: number; jobs: number }>();
  const projectAgg = new Map<string, { cost: number; jobs: number }>();
  const companyAgg = new Map<string, { name: string; cost: number; jobs: number; project: string }>();
  const modelAgg = new Map<string, { cost: number; jobs: number; tokens: number; pipeline: string }>();
  const dailyAgg = new Map<string, number>(); // dayKey -> cost

  for (const { project, rows, companyMap } of results) {
    for (const row of rows) {
      const cost = parseFloat(row.estimated_cost_usd) || 0;
      const tokens = row.total_tokens || 0;
      const inputTokens = Number(row.input_tokens) || 0;
      const outputTokens = Number(row.output_tokens) || 0;
      const pipeline = row.pipeline || "unknown";
      const model = row.model_name || "unknown";
      const companyId = row.company_id || "unknown";
      const companyName = companyMap.get(companyId) || "N/A";
      const dayKey = row.created_at.substring(0, 10);

      totalCost += cost;
      totalJobs += 1;
      totalTokens += tokens;
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;

      // Pipeline
      if (!pipelineAgg.has(pipeline)) pipelineAgg.set(pipeline, { cost: 0, jobs: 0 });
      const pa = pipelineAgg.get(pipeline)!;
      pa.cost += cost; pa.jobs += 1;

      // Project
      if (!projectAgg.has(project)) projectAgg.set(project, { cost: 0, jobs: 0 });
      const pra = projectAgg.get(project)!;
      pra.cost += cost; pra.jobs += 1;

      // Company
      const cKey = `${project}:${companyId}`;
      if (!companyAgg.has(cKey)) companyAgg.set(cKey, { name: companyName, cost: 0, jobs: 0, project });
      const ca = companyAgg.get(cKey)!;
      ca.cost += cost; ca.jobs += 1;

      // Model
      const mKey = `${model}|${pipeline}`;
      if (!modelAgg.has(mKey)) modelAgg.set(mKey, { cost: 0, jobs: 0, tokens: 0, pipeline });
      const ma = modelAgg.get(mKey)!;
      ma.cost += cost; ma.jobs += 1; ma.tokens += tokens;

      // Daily
      dailyAgg.set(dayKey, (dailyAgg.get(dayKey) || 0) + cost);
    }
  }

  // Build by_pipeline
  const by_pipeline = Array.from(pipelineAgg.entries())
    .map(([pipeline, d]) => ({
      pipeline,
      cost: Math.round(d.cost * 10000) / 10000,
      jobs: d.jobs,
      pct: totalCost > 0 ? Math.round((d.cost / totalCost) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  // Build by_project
  const by_project = Array.from(projectAgg.entries())
    .map(([project, d]) => ({
      project,
      cost: Math.round(d.cost * 10000) / 10000,
      jobs: d.jobs,
      pct: totalCost > 0 ? Math.round((d.cost / totalCost) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.cost - a.cost);

  // Build top_companies (top 3)
  const top_companies = Array.from(companyAgg.values())
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 3)
    .map((c) => ({
      name: c.name,
      project: c.project,
      cost: Math.round(c.cost * 10000) / 10000,
      jobs: c.jobs,
    }));

  // Build daily_trend
  const dayCount = Math.min(Math.ceil(ms / (24 * 60 * 60 * 1000)), 90);
  const daily_trend: { date: string; cost: number }[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dk = d.toISOString().substring(0, 10);
    daily_trend.push({ date: dk, cost: Math.round((dailyAgg.get(dk) || 0) * 10000) / 10000 });
  }

  // Build by_model
  const by_model = Array.from(modelAgg.entries())
    .map(([key, d]) => {
      const [model] = key.split("|");
      return {
        model,
        pipeline: d.pipeline,
        cost: Math.round(d.cost * 10000) / 10000,
        jobs: d.jobs,
        avg_tokens: d.jobs > 0 ? Math.round(d.tokens / d.jobs) : 0,
        pct: totalCost > 0 ? Math.round((d.cost / totalCost) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.cost - a.cost);

  return {
    kpi: {
      total_cost: Math.round(totalCost * 10000) / 10000,
      total_jobs: totalJobs,
      avg_cost_per_job: totalJobs > 0 ? Math.round((totalCost / totalJobs) * 10000) / 10000 : 0,
      total_tokens: totalTokens,
      total_input_tokens: totalInputTokens,
      total_output_tokens: totalOutputTokens,
    },
    by_pipeline,
    by_project,
    top_companies,
    daily_trend,
    by_model,
    period,
  };
}
