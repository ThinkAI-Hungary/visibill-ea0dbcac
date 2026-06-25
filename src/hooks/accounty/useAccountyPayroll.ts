/**
 * Accounty Payroll hooks — employee jobs, job modifications, declarations, filings, transfers, documents.
 * Split from useAccountyData.ts for maintainability.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

// ── Types ──

export interface EmployeeJob {
  id: string;
  companyId: string;
  employeeId: string;
  jobCode: string;
  jobCodeLabel: string;
  seqNum: number;
  position: string;
  feor: string;
  weeklyHours: number;
  startDate: string;
  endDate: string | null;
  baseSalary: number;
  status: 'active' | 'terminated' | 'suspended';
  insured: boolean;
  minimumBase: boolean;
  employer: string;
}

export interface Declaration {
  id: string;
  employeeId: string;
  type: string;
  status: 'active' | 'expired' | 'revoked';
  validFrom: string;
  validUntil: string | null;
  data: Record<string, unknown>;
  filedAt: string | null;
}

export interface Filing {
  id: string;
  companyId: string;
  filingType: string;
  period: string;
  status: string;
  data: Record<string, unknown>;
  submittedAt: string | null;
}

export interface Transfer {
  id: string;
  companyId: string;
  employeeId: string | null;
  employeeName: string;
  bankAccount: string;
  netSalary: number;
  period: string;
  status: 'pending' | 'approved' | 'sent';
}

export interface AccountyDocument {
  id: string;
  companyId: string;
  employeeId: string | null;
  title: string;
  docType: string;
  status: 'pending' | 'generated' | 'sent' | 'archived';
  fileUrl: string;
  period: string;
  generatedAt: string | null;
}

// ── Employee Jobs ──

export function useEmployeeJobs(companyId: string, employeeId: string) {
  return useQuery({
    queryKey: queryKeys.accountyEmployeeJobs(companyId, employeeId),
    queryFn: async (): Promise<EmployeeJob[]> => {
      const { data, error } = await supabase.from('accounty_employments').select('*').eq('employee_id', employeeId).order('start_date');
      if (error) throw error;
      return (data || []).map((e, i: number) => ({
        id: e.id, companyId, employeeId: e.employee_id,
        jobCode: e.job_code || '', jobCodeLabel: e.employment_type || e.job_code || '',
        seqNum: i + 1, position: e.job_title || '', feor: e.feor_code || '',
        weeklyHours: e.weekly_hours || 40, startDate: e.start_date, endDate: e.end_date || '',
        baseSalary: e.base_salary || 0, status: e.status || 'active',
        insured: true, minimumBase: false, employer: '',
      }));
    },
    enabled: !!companyId && !!employeeId,
  });
}

export function useAddEmployeeJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (job: Omit<EmployeeJob, 'id'>) => {
      const { error } = await supabase.from('accounty_employments').insert({
        employee_id: job.employeeId, company_id: job.companyId,
        employment_type: job.jobCodeLabel || job.jobCode, job_code: job.jobCode,
        job_title: job.position, feor_code: job.feor, weekly_hours: job.weeklyHours,
        start_date: job.startDate, end_date: job.endDate || null,
        base_salary: job.baseSalary, status: job.status,
      });
      if (error) throw error;
      return { companyId: job.companyId, employeeId: job.employeeId };
    },
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: queryKeys.accountyEmployeeJobs(k.companyId, k.employeeId) }); },
  });
}

export function useDeleteEmployeeJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId, employeeId }: { id: string; companyId: string; employeeId: string }) => {
      const { error } = await supabase.from('accounty_employments').delete().eq('id', id);
      if (error) throw error;
      return { companyId, employeeId };
    },
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: queryKeys.accountyEmployeeJobs(k.companyId, k.employeeId) }); },
  });
}

// ── Job Modifications ──

export function useAddJobModification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mods: { companyId: string; employeeId: string; changeType: string; effectiveDate: string; oldValue: string; newValue: string; reason: string; generate08e: boolean }[]) => {
      const { data: empRows } = await supabase.from('accounty_employments').select('id').eq('employee_id', mods[0].employeeId).eq('status', 'active').limit(1);
      const employmentId = empRows?.[0]?.id;

      for (const mod of mods) {
        const updatePayload: Record<string, unknown> = {};
        switch (mod.changeType) {
          case 'worktime': updatePayload.weekly_hours = Number(mod.newValue) || 40; break;
          case 'feor': updatePayload.feor_code = mod.newValue; break;
          case 'salary': updatePayload.base_salary = Number(mod.newValue) || 0; break;
          case 'position': updatePayload.job_title = mod.newValue; break;
          case 'costcenter': updatePayload.cost_center = mod.newValue; break;
          case 'site': break;
        }

        if (employmentId && Object.keys(updatePayload).length > 0) {
          const { error: updateErr } = await supabase.from('accounty_employments').update(updatePayload).eq('id', employmentId);
          if (updateErr) throw updateErr;
        }
      }

      const logRows = mods.map(m => ({
        company_id: m.companyId, employee_id: m.employeeId,
        change_type: m.changeType, effective_date: m.effectiveDate,
        old_value: m.oldValue, new_value: m.newValue, reason: m.reason, generate_08e: m.generate08e,
      }));
      await supabase.from('accounty_job_modifications').insert(logRows);

      return { companyId: mods[0].companyId, employeeId: mods[0].employeeId };
    },
    onSuccess: (ctx) => {
      qc.invalidateQueries({ queryKey: queryKeys.accountyPayrollEmployments(ctx.employeeId) });
      qc.invalidateQueries({ queryKey: queryKeys.accountyPayrollEmployees() });
    },
  });
}

// ── Declarations ──

export function useDeclarations(companyId: string) {
  return useQuery({
    queryKey: queryKeys.accountyDeclarations(companyId),
    queryFn: async (): Promise<Declaration[]> => {
      const { data: emps, error: empErr } = await supabase.from('accounty_employees').select('id').eq('company_id', companyId);
      if (empErr) throw empErr;
      const empIds = (emps || []).map(e => e.id);
      if (empIds.length === 0) return [];

      const { data, error } = await supabase.from('accounty_declarations').select('*').in('employee_id', empIds).order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, employeeId: r.employee_id, type: r.declaration_type,
        status: r.status, validFrom: r.valid_from, validUntil: r.valid_until,
        data: r.parameters || {}, filedAt: r.created_at,
      }));
    },
    enabled: !!companyId,
  });
}

export function useAddDeclaration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (decl: { employeeId: string; type: string; validFrom: string; validUntil?: string; parameters?: Record<string, unknown>; companyId: string }) => {
      const { error } = await supabase.from('accounty_declarations').insert({
        employee_id: decl.employeeId, declaration_type: decl.type,
        valid_from: decl.validFrom, valid_until: decl.validUntil || null, parameters: decl.parameters || {},
      });
      if (error) throw error;
      return decl.companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: queryKeys.accountyDeclarations(cid) }); },
  });
}

// ── Filings ──

export function useFilings(companyId: string, filingType?: string) {
  return useQuery({
    queryKey: queryKeys.accountyFilings(companyId, filingType),
    queryFn: async (): Promise<Filing[]> => {
      let q = supabase.from('accounty_filings').select('*').eq('company_id', companyId);
      if (filingType) q = q.ilike('filing_type', filingType);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, companyId: r.company_id, filingType: r.filing_type,
        period: `${r.period_year}-${String(r.period_month || 1).padStart(2, '0')}`,
        status: r.status, data: r.xml_data ? { xml: r.xml_data } : {}, submittedAt: r.submitted_at,
      }));
    },
    enabled: !!companyId,
  });
}

// ── Transfers ──

export function useTransfers(companyId: string, period?: string) {
  return useQuery({
    queryKey: queryKeys.accountyTransfers(companyId, period),
    queryFn: async (): Promise<Transfer[]> => {
      let q = supabase.from('accounty_transfers').select('*').eq('company_id', companyId);
      if (period) q = q.eq('period', period);
      const { data, error } = await q.order('employee_name');
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, companyId: r.company_id, employeeId: r.employee_id,
        employeeName: r.employee_name || '', bankAccount: r.bank_account || '',
        netSalary: r.net_salary || 0, period: r.period, status: r.status,
      }));
    },
    enabled: !!companyId,
  });
}

// ── Documents ──

export function useAccountyDocuments(companyId: string, docType?: string) {
  return useQuery({
    queryKey: queryKeys.accountyDocuments(companyId, docType),
    queryFn: async (): Promise<AccountyDocument[]> => {
      let q = supabase.from('accounty_documents').select('*').eq('company_id', companyId);
      if (docType && docType !== 'all') q = q.eq('doc_type', docType);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, companyId: r.company_id, employeeId: r.employee_id,
        title: r.title, docType: r.doc_type, status: r.status,
        fileUrl: r.file_url || '', period: r.period || '', generatedAt: r.generated_at,
      }));
    },
    enabled: !!companyId,
  });
}

export function useGenerateDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, docType }: { companyId: string; docType: string }) => {
      const { data: cycles } = await supabase.from('accounty_payroll_cycles').select('id, year, month').eq('company_id', companyId).order('year', { ascending: false }).order('month', { ascending: false }).limit(1);
      if (!cycles || cycles.length === 0) throw new Error('Nincs számfejtési ciklus a céghez.');
      const currentCycle = cycles[0];
      const period = `${currentCycle.year}-${String(currentCycle.month).padStart(2, '0')}`;

      const { data: calculations } = await supabase.from('accounty_payroll_calculations').select('*, accounty_employments(employee_id)').eq('cycle_id', currentCycle.id);
      if (!calculations || calculations.length === 0) throw new Error('Nincsenek számfejtési adatok a legutóbbi ciklushoz.');

      const typesToGenerate = docType === 'all' ? ['payslip', 'transfer', 'e-payslip', 'cash', 'garnishment', 'cafeteria', 'summary', 'certificate'] : [docType];

      const docs = [];
      for (const t of typesToGenerate) {
        if (['summary', 'cash', 'cafeteria', 'garnishment', 'certificate'].includes(t)) {
          let title = '';
          if (t === 'summary') title = 'Munkáltatói összesítő';
          if (t === 'cash') title = 'Készpénzes kifizetési lista';
          if (t === 'cafeteria') title = 'Cafeteria feltöltési fájlok';
          if (t === 'garnishment') title = 'Letiltások jegyzéke';
          if (t === 'certificate') title = 'Igazolások';
          docs.push({ company_id: companyId, employee_id: null, title: `${title} - ${period}`, doc_type: t, status: 'generated', period, generated_at: new Date().toISOString() });
        } else {
          for (const calc of calculations) {
            const meta = calc.metadata as Record<string, unknown>;
            const empName = (meta?.employee_name as string) || 'Ismeretlen';
            const empId = (calc.accounty_employments as Record<string, unknown>)?.employee_id || meta?.employee_id;
            if (!empId) continue;

            let title = '';
            if (t === 'payslip') title = `${empName} - Bérjegyzék`;
            if (t === 'transfer') title = `${empName} - Utalási lista`;
            if (t === 'e-payslip') title = `${empName} - E-bérjegyzék`;
            docs.push({ company_id: companyId, employee_id: empId, title, doc_type: t, status: 'generated', period, generated_at: new Date().toISOString() });
          }
        }
      }

      await supabase.from('accounty_documents').delete().eq('company_id', companyId).eq('period', period).in('doc_type', typesToGenerate);
      const { error } = await supabase.from('accounty_documents').insert(docs);
      if (error) throw error;

      if (typesToGenerate.includes('transfer')) {
        await supabase.from('accounty_transfers').delete().eq('company_id', companyId).eq('period', period);
        const transferRecords = calculations.map(calc => {
          const meta = calc.metadata as Record<string, unknown>;
          return { company_id: companyId, employee_id: (calc.accounty_employments as Record<string, unknown>)?.employee_id || meta?.employee_id || null, employee_name: (meta?.employee_name as string) || 'Ismeretlen', bank_account: (meta?.bank_account as string) || '', net_salary: calc.net_salary || 0, period, status: 'approved' };
        }).filter(t => t.net_salary > 0);
        if (transferRecords.length > 0) await supabase.from('accounty_transfers').insert(transferRecords);
      }

      return { companyId, docType };
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.accountyDocuments(vars.companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.accountyTransfers(vars.companyId) });
      if (vars.docType !== 'all') qc.invalidateQueries({ queryKey: queryKeys.accountyDocuments(vars.companyId, vars.docType) });
    },
  });
}
