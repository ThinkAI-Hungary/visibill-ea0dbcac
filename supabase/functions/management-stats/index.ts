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

function emptyForAction(action: string) {
  if (action === "company-detail") return emptyCompanyDetail;
  if (action === "user-detail") return emptyUserDetail;
  if (action === "errors") return emptyErrors;
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

    if (profileError || requesterProfile?.role !== "management") {
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

    if (action === "user-detail") {
      const selectedUserId = url.searchParams.get("userId");
      if (!selectedUserId) return json(emptyUserDetail);
      return json(await buildUserDetail(admin, selectedUserId));
    }

    return json({ error: "Unknown action", ...emptyOverview });
  } catch (error) {
    console.error("[MANAGEMENT-STATS] Unexpected error", error);
    const action = new URL(req.url).searchParams.get("action") || "overview";
    return json(emptyForAction(action));
  }
});

async function buildOverview(admin: ReturnType<typeof createClient>) {
  const monthStart = startOfMonthIso();

  const [companiesRes, membersRes, profilesRes, invoicesRes, navInvoicesRes, txRes, salaryRes, monthlyLlmRes, emailByUserId,
    errInvoicesRes, errTxRes, errReportsRes, errGlRes, errNavRes, errBankRes, errAppRes,
  ] = await Promise.all([
    admin.from("companies").select("id, name, tax_number, created_at").order("created_at", { ascending: false }),
    admin.from("company_members").select("company_id, user_id, role, created_at"),
    admin.from("profiles").select("id, user_id, name, role, created_at"),
    admin.from("invoices").select("id, company_id"),
    admin.from("nav_invoices").select("id, company_id"),
    admin.from("transactions").select("id, company_id"),
    admin.from("salary").select("id, company_id"),
    admin
      .from("llm_koltsegek")
      .select("company_id, input_tokens, output_tokens, total_tokens, estimated_cost_usd, llm_calls, created_at")
      .gte("created_at", monthStart),
    listAllAuthUsers(admin),
    // Lightweight error counts (id only, filtered by error status)
    admin.from("invoice_uploads").select("id", { count: "exact", head: true }).eq("processing_status", "error"),
    admin.from("transaction_uploads").select("id", { count: "exact", head: true }).eq("processing_status", "error"),
    admin.from("report_uploads").select("id", { count: "exact", head: true }).eq("processing_status", "error"),
    admin.from("gl_upload_notifications").select("id", { count: "exact", head: true }).eq("processing_status", "error"),
    admin.from("nav_sync_logs").select("id", { count: "exact", head: true }).eq("status", "error"),
    admin.from("bank_statement_uploads").select("id", { count: "exact", head: true }).eq("processing_status", "error"),
    admin.from("app_error_logs").select("id", { count: "exact", head: true }),
  ]);

  for (const res of [companiesRes, membersRes, profilesRes, invoicesRes, navInvoicesRes, txRes, salaryRes, monthlyLlmRes]) {
    if (res.error) throw res.error;
  }

  const companies = (companiesRes.data || []) as CompanyRow[];
  const members = (membersRes.data || []) as CompanyMemberRow[];
  const profiles = (profilesRes.data || []) as (ProfileRow & { created_at: string })[];
  const monthlyLlm = monthlyLlmRes.data || [];

  const profileByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const membersByCompany = new Map<string, CompanyMemberRow[]>();
  const companiesByUser = new Map<string, Array<{ id: string; name: string; role: string }>>();

  for (const member of members) {
    if (!membersByCompany.has(member.company_id)) membersByCompany.set(member.company_id, []);
    membersByCompany.get(member.company_id)!.push(member);
  }

  const countByCompany = (rows: Array<{ company_id: string | null }>) => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.company_id) continue;
      counts.set(row.company_id, (counts.get(row.company_id) || 0) + 1);
    }
    return counts;
  };

  const invoiceCounts = countByCompany(invoicesRes.data || []);
  const navInvoiceCounts = countByCompany(navInvoicesRes.data || []);
  const txCounts = countByCompany(txRes.data || []);
  const salaryCounts = countByCompany(salaryRes.data || []);

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
    };
  });

  const totalMonthlyCostUsd = [...monthlyCostsByCompany.values()].reduce((sum, item) => sum + item.cost, 0);
  const totalMonthlyInputTokens = [...monthlyCostsByCompany.values()].reduce((sum, item) => sum + item.input, 0);
  const totalMonthlyOutputTokens = [...monthlyCostsByCompany.values()].reduce((sum, item) => sum + item.output, 0);
  const mostExpensiveCompany = companySummaries.reduce<typeof companySummaries[number] | null>(
    (winner, company) => (!winner || company.monthlyCostUsd > winner.monthlyCostUsd ? company : winner),
    null,
  );

  // Total error count across all upload tables
  const totalErrors = (errInvoicesRes.count || 0) + (errTxRes.count || 0) + (errReportsRes.count || 0)
    + (errGlRes.count || 0) + (errNavRes.count || 0) + (errBankRes.count || 0) + (errAppRes.count || 0);

  return {
    usersCount: profiles.filter((profile) => profile.role !== "management").length,
    companiesCount: companies.length,
    totalErrors,
    companies: companySummaries,
    users: profiles
      .filter((profile) => profile.role !== "management")
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

  const companyById = new Map((companiesRes.data || []).map((company) => [company.id, company]));
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
function categorizeError(msg: string | null): string {
  if (!msg) return "unknown";
  const lower = msg.toLowerCase();
  if (lower.includes("nem beazonosítható") || lower.includes("not identif")) return "classification_error";
  if (lower.includes("ocr") && (lower.includes("failed") || lower.includes("error"))) return "ocr_error";
  if (lower.includes("extraction error") || lower.includes("validation error")) return "extraction_error";
  if (lower.includes("duplicate key") || lower.includes("already exists")) return "duplicate_error";
  if (lower.includes("timeout") || lower.includes("timed out")) return "timeout_error";
  if (lower.includes("rate limit") || lower.includes("429")) return "rate_limit_error";
  if (lower.includes("apierror") || lower.includes("pgrst") || lower.includes("http error")) return "api_error";
  if (lower.includes("nem található") || lower.includes("no valid") || lower.includes("empty")) return "empty_content";
  return "unknown";
}

function categoryLabel(cat: string): string {
  const labels: Record<string, string> = {
    classification_error: "Nem beazonosítható",
    ocr_error: "OCR hiba",
    extraction_error: "Extrakciós hiba",
    duplicate_error: "Duplikátum",
    timeout_error: "Időtúllépés",
    rate_limit_error: "Rate limit",
    api_error: "API / DB hiba",
    empty_content: "Üres tartalom",
    // Frontend app_error_logs types
    auth: "Auth hiba",
    db_query: "DB lekérdezés",
    api_call: "API hívás",
    upload: "Feltöltés (frontend)",
    validation: "Validáció",
    navigation: "Navigáció",
    unhandled: "Nem kezelt hiba",
    // Worker types
    worker: "Worker hiba",
    // Mailgun/email types
    webhook: "Webhook hiba",
    mailgun: "Mailgun hiba",
    email_alias: "Email alias hiba",
    unknown: "Egyéb",
  };
  return labels[cat] || "Egyéb";
}

const SOURCE_LABELS: Record<string, string> = {
  invoice_uploads: "Számla",
  transaction_uploads: "Tranzakció",
  report_uploads: "Riport",
  gl_upload_notifications: "Főkönyv",
  nav_sync_logs: "NAV szinkron",
  bank_statement_uploads: "Bankkivonat",
  app_error_logs: "App hiba",
  // Sub-sources derived from app_error_logs.error_type
  "app_error_logs:frontend": "Frontend",
  "app_error_logs:worker": "Worker",
  "app_error_logs:webhook": "Mailgun webhook",
  "app_error_logs:mailgun": "Mailgun",
  "app_error_logs:email_alias": "Email alias",
};

// Map error_type to a sub-source key for app_error_logs
function appLogSubSource(errorType: string): string {
  if (errorType === "worker") return "app_error_logs:worker";
  if (errorType === "webhook") return "app_error_logs:webhook";
  if (errorType === "mailgun") return "app_error_logs:mailgun";
  if (errorType === "email_alias") return "app_error_logs:email_alias";
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
      .select("id, created_at, error_message, file_name, file_url, company_id, user_id")
      .eq("processing_status", "error"),
    admin.from("transaction_uploads")
      .select("id, created_at, error_message, file_name, file_url, company_id, user_id")
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
      .select("id, created_at, error_message, file_name, file_url, company_id, user_id")
      .eq("processing_status", "error"),
    // 7th source: frontend app error logs
    admin.from("app_error_logs")
      .select("id, created_at, message, error_type, component, action, company_id, user_id, context")
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
      const cat = isAppLog ? (row.error_type || "unknown") : categorizeError(row.error_message ?? row.message);
      // For auth errors, prepend email from context if available
      const ctxEmail = isAppLog && row.context?.email ? ` [${row.context.email}]` : "";
      const errorMsg = isAppLog
        ? `[${row.component || '?'}/${row.action || '?'}]${ctxEmail} ${row.message || ''}`
        : (row.error_message || null);
      // For app_error_logs, derive a sub-source so Frontend/Worker/Mailgun are separate
      const effectiveSource = isAppLog ? appLogSubSource(row.error_type || "") : source;
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
        company_name: row.company_id ? (companyById.get(row.company_id) || null) : null,
        user_id: row.user_id || null,
        user_name: row.user_id ? (profileByUserId.get(row.user_id) || null) : null,
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
  // Source filter: exact match OR prefix match (e.g. 'app_error_logs' matches 'app_error_logs:frontend')
  if (filterSource) allErrors = allErrors.filter(e => e.source === filterSource || e.source.startsWith(filterSource + ':'));
  if (filterCategory) allErrors = allErrors.filter(e => e.error_category === filterCategory);
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
