import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

function emptyForAction(action: string) {
  if (action === "company-detail") return emptyCompanyDetail;
  if (action === "user-detail") return emptyUserDetail;
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
    if (req.method !== "GET") {
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

  const [companiesRes, membersRes, profilesRes, invoicesRes, navInvoicesRes, txRes, salaryRes, monthlyLlmRes, emailByUserId] = await Promise.all([
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

  return {
    usersCount: profiles.filter((profile) => profile.role !== "management").length,
    companiesCount: companies.length,
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
