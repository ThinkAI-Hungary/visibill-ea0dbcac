import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export async function buildSuperadminData(
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
    // ── Eaisybill: Számlák ──
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

    // ── Tranzakciók ──
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

    // ── Főkönyv ──
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

    // ── Bérek ──
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

    // ── Pénztár ──
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

    // ── Feltöltések ──
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

    // ── eaisyBooks modules ──
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

    // ── Global eaisyBooks modules (no company_id filter) ──
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
