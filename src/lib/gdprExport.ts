/**
 * GDPR Data Export — generates a JSON/CSV bundle of all company data
 * for the currently logged-in accountant's assigned companies.
 */

import { supabase } from '@/integrations/supabase/client';

export interface ExportResult {
  filename: string;
  blob: Blob;
  recordCount: number;
}

/**
 * Export all data for assigned companies as a JSON file.
 * Covers: companies, employees, employments, payroll cycles/calculations,
 * declarations, invoices, missing items, communication preferences.
 */
export async function exportAllDataAsJson(): Promise<ExportResult> {
  const bundle: Record<string, unknown[]> = {};
  let totalRecords = 0;

  // 1. Companies (via assignments)
  const { data: companies } = await supabase
    .from('accounty_assignments')
    .select('company_id, companies(id, name, tax_number, created_at)')
    .order('company_id');
  bundle.companies = (companies || []).map((a: any) => a.companies).filter(Boolean);
  totalRecords += bundle.companies.length;

  const companyIds = (companies || []).map((a: any) => a.company_id);

  if (companyIds.length > 0) {
    // 2. Employees
    const { data: employees } = await supabase
      .from('accounty_employees')
      .select('id, company_id, first_name, last_name, birth_date, taj_number, tax_id, email, phone, status, created_at')
      .in('company_id', companyIds);
    bundle.employees = employees || [];
    totalRecords += bundle.employees.length;

    const employeeIds = (employees || []).map((e: any) => e.id);

    // 3. Employments
    if (employeeIds.length > 0) {
      const { data: employments } = await supabase
        .from('accounty_employments')
        .select('id, employee_id, company_id, job_code, employment_type, start_date, end_date, base_salary, weekly_hours, status, created_at')
        .in('employee_id', employeeIds);
      bundle.employments = employments || [];
      totalRecords += bundle.employments.length;
    }

    // 4. Payroll cycles
    const { data: cycles } = await supabase
      .from('accounty_payroll_cycles')
      .select('id, company_id, year, month, status, created_at')
      .in('company_id', companyIds);
    bundle.payroll_cycles = cycles || [];
    totalRecords += bundle.payroll_cycles.length;

    const cycleIds = (cycles || []).map((c: any) => c.id);

    // 5. Payroll calculations
    if (cycleIds.length > 0) {
      const { data: calculations } = await supabase
        .from('accounty_payroll_calculations')
        .select('id, cycle_id, employment_id, gross_salary, net_salary, szja_amount, tb_amount, szocho_amount, total_deductions, created_at')
        .in('cycle_id', cycleIds);
      bundle.payroll_calculations = calculations || [];
      totalRecords += bundle.payroll_calculations.length;
    }

    // 6. Declarations
    if (employeeIds.length > 0) {
      const { data: declarations } = await supabase
        .from('accounty_declarations')
        .select('id, employee_id, declaration_type, valid_from, valid_until, status, parameters, created_at')
        .in('employee_id', employeeIds);
      bundle.declarations = declarations || [];
      totalRecords += bundle.declarations.length;
    }

    // 7. Missing items
    const { data: missingItems } = await supabase
      .from('accounty_missing_items')
      .select('id, company_id, category, title, subtitle, priority, status, created_at')
      .in('company_id', companyIds);
    bundle.missing_items = missingItems || [];
    totalRecords += bundle.missing_items.length;

    // 8. Communication preferences
    const { data: commPrefs } = await supabase
      .from('accounty_communication_preferences')
      .select('*')
      .in('company_id', companyIds);
    bundle.communication_preferences = commPrefs || [];
    totalRecords += bundle.communication_preferences.length;

    // 9. GDPR requests
    const { data: gdprRequests } = await supabase
      .from('accounty_gdpr_requests')
      .select('*')
      .in('company_id', companyIds);
    bundle.gdpr_requests = gdprRequests || [];
    totalRecords += bundle.gdpr_requests.length;

    // 10. Audit log
    const { data: auditLog } = await supabase
      .from('accounty_audit_log')
      .select('id, event_type, entity_type, entity_id, details, created_at')
      .in('company_id', companyIds)
      .order('created_at', { ascending: false })
      .limit(1000);
    bundle.audit_log = auditLog || [];
    totalRecords += bundle.audit_log.length;
  }

  const exportMeta = {
    exportedAt: new Date().toISOString(),
    exportVersion: '1.0',
    gdprArticle: 'GDPR 20. cikk — Adathordozhatósághoz való jog',
    totalRecords,
    tables: Object.keys(bundle),
  };

  const fullExport = { _meta: exportMeta, ...bundle };

  const json = JSON.stringify(fullExport, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `accounty_gdpr_export_${new Date().toISOString().split('T')[0]}.json`;

  return { filename, blob, recordCount: totalRecords };
}

/** Trigger download in browser */
export function downloadBlob(result: ExportResult) {
  const url = URL.createObjectURL(result.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
