import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { CompanyMemberRow, CompanyRow, ProfileRow } from "../types.ts";
import { roleLabel, startOfMonthIso, listAllAuthUsers } from "../utils/common.ts";
import { getProjectClients } from "../utils/multiProject.ts";

export async function fetchMultiProjectMonthlyLlm(admin: ReturnType<typeof createClient>, monthStart: string) {
  const projectClients = getProjectClients(admin);

  const fetches = projectClients.map(async (pc) => {
    try {
      // Call SECURITY DEFINER RPC — aggregates server-side, bypasses RLS + max_rows
      const { data: rpcResult, error } = await pc.client
        .rpc('get_monthly_llm_by_company', { month_start: monthStart });
      if (error) throw error;

      const rows: any[] = rpcResult?.rows || [];
      console.log(`[fetchMultiProjectMonthlyLlm] ${pc.name}: ${rows.length} company rows, total_cost=${rpcResult?.total_cost}`);

      // Fetch company names for VSWEB/THINKERMAN projects
      const companyMap = new Map<string, string>();
      if (pc.name !== "PROD" && rows.length > 0) {
        const cIds = rows.map((r: any) => r.company_id).filter(Boolean);
        if (cIds.length > 0) {
          const { data: companies } = await pc.client
            .from("companies").select("id, name").in("id", cIds);
          for (const c of (companies || [])) companyMap.set(c.id, c.name);
        }
      }

      // Transform to row format expected by buildOverview aggregation
      return rows.map((row: any) => ({
        company_id: row.company_id,
        estimated_cost_usd: row.cost,
        total_all_time_cost: Number(row.total_all_time_cost ?? row.cost ?? 0),
        input_tokens: row.input_tokens,
        output_tokens: row.output_tokens,
        total_tokens: (row.input_tokens || 0) + (row.output_tokens || 0),
        project: pc.name,
        company_name_override: pc.name !== "PROD" ? companyMap.get(row.company_id) : undefined,
      }));
    } catch (e) {
      console.warn(`[overview-llm] RPC failed for ${pc.name}, falling back to direct query:`, e);
      try {
        const { data, error: qErr } = await pc.client
          .from("llm_koltsegek")
          .select("company_id, input_tokens, output_tokens, total_tokens, estimated_cost_usd")
          .gte("created_at", monthStart)
          .limit(50000);
        if (qErr) throw qErr;
        return (data || []).map((row: any) => ({ ...row, project: pc.name }));
      } catch (e2) {
        console.warn(`[overview-llm] fallback also failed for ${pc.name}:`, e2);
        return [];
      }
    }
  });

  const results = await Promise.all(fetches);
  return { data: results.flat(), error: null };
}

export async function buildOverview(admin: ReturnType<typeof createClient>) {
  const monthStart = startOfMonthIso();

  const [companiesRes, membersRes, profilesRes, countsRes, monthlyLlmRes, emailByUserId,
    errInvoicesRes, errTxRes, errReportsRes, errGlRes, errNavRes, errBankRes, errAppRes,
    accountyAssignmentsRes,
  ] = await Promise.all([
    admin.from("companies").select("id, name, tax_number, created_at").order("created_at", { ascending: false }),
    admin.from("company_members").select("company_id, user_id, role, created_at"),
    admin.from("profiles").select("id, user_id, name, role, created_at"),
    admin.rpc("get_company_counts"),
    fetchMultiProjectMonthlyLlm(admin, monthStart),
    listAllAuthUsers(admin),
    admin.from("invoice_uploads").select("company_id, user_id").eq("processing_status", "error"),
    admin.from("transaction_uploads").select("company_id, user_id").eq("processing_status", "error"),
    admin.from("report_uploads").select("company_id, user_id").eq("processing_status", "error"),
    admin.from("gl_upload_notifications").select("company_id").eq("processing_status", "error"),
    admin.from("nav_sync_logs").select("company_id").eq("status", "error"),
    admin.from("bank_statement_uploads").select("company_id, user_id").eq("processing_status", "error"),
    admin.from("app_error_logs").select("company_id, user_id").eq("severity", "error").order("created_at", { ascending: false }).limit(500),
    admin.from("accounty_assignments").select("company_id"),
  ]);

  for (const res of [companiesRes, membersRes, profilesRes, countsRes, monthlyLlmRes, accountyAssignmentsRes]) {
    if (res.error) throw res.error;
  }

  const eaisyBooksCompanyIds = new Set(
    (accountyAssignmentsRes.data || []).map((r: { company_id: string }) => r.company_id)
  );

  const companies = (companiesRes.data || []) as CompanyRow[];
  const members = (membersRes.data || []) as CompanyMemberRow[];
  const profiles = (profilesRes.data || []) as (ProfileRow & { created_at: string })[];
  const monthlyLlm = monthlyLlmRes.data || [];

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

  const monthlyCostsByCompany = new Map<string, { cost: number; totalCost: number; input: number; output: number; name?: string; project?: string }>();
  for (const row of monthlyLlm) {
    if (!row.company_id) continue;
    const current = monthlyCostsByCompany.get(row.company_id) || { cost: 0, totalCost: 0, input: 0, output: 0, name: row.company_name_override, project: row.project };
    current.cost += Number(row.estimated_cost_usd || 0);
    current.totalCost += Number(row.total_all_time_cost || row.estimated_cost_usd || 0);
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

    const llm = monthlyCostsByCompany.get(company.id) || { cost: 0, totalCost: 0, input: 0, output: 0 };

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
  let mostExpensiveCompany: { id: string; name: string; totalCostUsd: number; monthlyCostUsd: number; project?: string } | null = null;
  let maxAllTimeCost = 0;

  for (const [companyId, val] of monthlyCostsByCompany.entries()) {
    const allTimeCost = val.totalCost > 0 ? val.totalCost : val.cost;
    if (allTimeCost > maxAllTimeCost) {
      maxAllTimeCost = allTimeCost;
      const prodCompany = companies.find((c) => c.id === companyId);
      const rawName = prodCompany?.name || val.name || "Ismeretlen cég";
      const displayName = val.project && val.project !== "PROD" ? `${rawName} (${val.project})` : rawName;
      mostExpensiveCompany = {
        id: companyId,
        name: displayName,
        totalCostUsd: Math.round(allTimeCost * 10000) / 10000,
        monthlyCostUsd: Math.round(val.cost * 10000) / 10000,
        project: val.project || "PROD",
      };
    }
  }

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
    if (userId && profileByUserId.get(userId)?.name !== "Törölt Felhasználó") {
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
    usersCount: profiles.filter((profile) => profile.role !== "management" && profile.role !== "thinkai" && profile.name !== "Törölt Felhasználó").length,
    companiesCount: companies.length,
    totalErrors,
    mostErrorCompany,
    mostErrorUser,
    companies: companySummaries,
    users: profiles
      .filter((profile) => profile.role !== "management" && profile.role !== "thinkai" && profile.name !== "Törölt Felhasználó")
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
      mostExpensiveCompany,
    },
  };
}

export async function buildCompanyDetail(admin: ReturnType<typeof createClient>, companyId: string, url: URL) {
  const page = Math.max(0, Number(url.searchParams.get("page") || 0));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 20)));
  const sortBy = url.searchParams.get("sortBy") || "created_at";
  const sortDir = url.searchParams.get("sortDir") || "desc";
  const search = (url.searchParams.get("search") || "").trim().toLowerCase();
  const dateFrom = url.searchParams.get("dateFrom") || "";
  const dateTo = url.searchParams.get("dateTo") || "";

  const projectClients = getProjectClients(admin);
  let activeClient = admin;
  let detectedProject = "PROD";

  const checks = await Promise.all(
    projectClients.map(async (pc) => {
      try {
        const { data, error } = await pc.client
          .from("companies")
          .select("id")
          .eq("id", companyId)
          .maybeSingle();
        if (data && !error) {
          return { name: pc.name, client: pc.client };
        }
      } catch (_) {}
      return null;
    })
  );

  const found = checks.find(Boolean);
  if (found) {
    activeClient = found.client;
    detectedProject = found.name;
    console.log(`[buildCompanyDetail] Detected project for companyId ${companyId}: ${detectedProject}`);
  } else {
    console.warn(`[buildCompanyDetail] CompanyId ${companyId} not found in any project database, defaulting to PROD`);
  }

  // Phase 1: Fetch non-LLM base data in parallel using activeClient
  const [invoicesRes, navInvoicesRes, membersRes, profilesRes, auditRes, emailByUserId] = await Promise.all([
    activeClient.from("invoices").select("id").eq("company_id", companyId),
    activeClient.from("nav_invoices").select("id").eq("company_id", companyId),
    activeClient.from("company_members").select("company_id, user_id, role, created_at").eq("company_id", companyId),
    activeClient.from("profiles").select("user_id, name, role"),
    activeClient
      .from("audit_logs")
      .select("action, entity, entity_name, user_id, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(1),
    listAllAuthUsers(activeClient),
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
  let searchUserIds: string[] = [];
  if (search) {
    searchUserIds = ((profilesRes.data || []) as ProfileRow[])
      .filter((p) => (p.name || "").toLowerCase().includes(search))
      .map((p) => p.user_id);
  }

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

  const allowedSort = new Set(["created_at", "input_tokens", "output_tokens", "estimated_cost_usd"]);
  const dbSortCol = allowedSort.has(sortBy) ? sortBy : "created_at";

  const [aggRes, detailRes] = await Promise.all([
    applyLlmFilters(
      activeClient.from("llm_koltsegek").select("estimated_cost_usd, total_tokens, llm_calls"),
    ),
    applyLlmFilters(
      activeClient
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

  const aggRows = aggRes.data || [];
  const totalCostUsd = aggRows.reduce((sum: number, r: any) => sum + Number(r.estimated_cost_usd || 0), 0);
  const totalTokens = aggRows.reduce((sum: number, r: any) => sum + Number(r.total_tokens || 0), 0);
  const callCount = aggRows.reduce((sum: number, r: any) => sum + Number(r.llm_calls || 0), 0);

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

export async function buildUserDetail(admin: ReturnType<typeof createClient>, userId: string) {
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
