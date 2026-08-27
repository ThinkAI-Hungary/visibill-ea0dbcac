/**
 * Accounty Bérszámfejtési Modul — React Hooks (éles Supabase)
 *
 * Query és mutáció hookök az összes payroll tábla CRUD műveleteihez.
 * Az accounty_assignments alapú RLS policy-k biztosítják a hozzáférés-védelmet.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { TaxParameters } from '@/lib/payroll/taxEngine';

// ═══════════════════════════════════════════════════════════════
// TÍPUSOK (DB row típusok)
// ═══════════════════════════════════════════════════════════════

export interface PayrollEmployee {
  id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  birth_name: string | null;
  birth_place: string | null;
  birth_date: string | null;
  mothers_name: string | null;
  gender: 'male' | 'female' | 'other' | null;
  nationality: string;
  taj_number: string | null;
  tax_id: string | null;
  id_card_number: string | null;
  address: any | null;
  temp_address: any | null;
  email: string | null;
  phone: string | null;
  bank_account: string | null;
  iban: string | null;
  status: 'active' | 'terminated' | 'pending' | 'suspended';
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  eu_tax_id: string | null;
  education_level: string | null;
  has_age_concession: boolean;
  has_union_fee: boolean;
  has_no_hungarian_address: boolean;
}

export interface PayrollEmployment {
  id: string;
  employee_id: string;
  company_id: string;
  job_code: string;
  job_serial_number: number;
  employment_type: string;
  start_date: string;
  end_date: string | null;
  probation_end: string | null;
  is_fixed_term: boolean;
  weekly_hours: number;
  feor_code: string | null;
  job_title: string | null;
  location_id: string | null;
  cost_center: string | null;
  department: string | null;
  base_salary: number | null;
  salary_type: string;
  remote_work_type: string | null;
  remote_work_days_per_week: number | null;
  is_insured: boolean;
  status: string;
  metadata: any;
  created_at: string;
  updated_at: string;
  is_pensioner: boolean;
  pension_type: string | null;
  is_ekho: boolean;
  ekho_payer: string | null;
  ekho_category: string | null;
  is_szocho_discount: boolean;
  szocho_discount_type: string | null;
  szocho_discount_start: string | null;
  szocho_discount_end: string | null;
  minimum_contribution_base_rule: string | null;
  has_minimum_base: boolean;
  is_min_base_exempt_gyes_gyed: boolean;
  is_min_base_exempt_student: boolean;
  is_min_base_paid_elsewhere: boolean;
  other_company_name: string | null;
  other_company_tax_number: string | null;
  is_unequal_work_schedule: boolean;
  insurance_relationship_code: string | null;
  job_valid_from: string | null;
  feor_description: string | null;
  project_id?: string | null;
}

export interface PayrollCycle {
  id: string;
  company_id: string;
  year: number;
  month: number;
  status: string;
  current_step: number;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollItem {
  id: string;
  cycle_id: string;
  employment_id: string;
  item_type: string;
  description: string | null;
  amount: number;
  hours: number | null;
  days: number | null;
  rate_pct: number | null;
  is_deduction: boolean;
  created_at: string;
}

export interface PayrollCalculation {
  id: string;
  cycle_id: string;
  employment_id: string;
  gross_salary: number | null;
  szja_base: number | null;
  szja_amount: number | null;
  tb_amount: number | null;
  szocho_amount: number | null;
  net_salary: number | null;
  total_deductions: number | null;
  tax_credits: Record<string, unknown>;
  szocho_credits: Record<string, unknown>;
  deductions: Record<string, unknown>;
  cafeteria_tax: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PayrollDeclaration {
  id: string;
  employee_id: string;
  declaration_type: string;
  valid_from: string;
  valid_until: string | null;
  status: string;
  parameters: any;
  document_url: string | null;
  nav_receipt_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollFiling {
  id: string;
  company_id: string;
  filing_type: string;
  period_year: number | null;
  period_month: number | null;
  period_quarter: number | null;
  status: string;
  xml_data: string | null;
  channel: string | null;
  nav_receipt_id: string | null;
  nav_receipt_status: string | null;
  error_codes: unknown;
  submitted_at: string | null;
  signed_by: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollJobCode {
  code: string;
  name: string;
  is_insured: boolean;
  min_contribution_base_rule: string | null;
  valid_from: string | null;
  valid_until: string | null;
  description: string | null;
}

export interface PayrollLeave {
  id: string;
  employment_id: string;
  cycle_id: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  daily_rate: number | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PayrollCafeteriaItem {
  id: string;
  employment_id: string;
  cycle_id: string | null;
  benefit_type: string;
  amount: number;
  provider: string | null;
  card_number: string | null;
  tax_rate: number | null;
  status: string;
  sub_type?: string | null;
  is_housing_allowance?: boolean | null;
  created_at: string;
}

export interface PayrollGarnishment {
  id: string;
  employee_id: string;
  garnishment_type: string;
  creditor_name: string | null;
  creditor_account: string | null;
  decree_number: string | null;
  original_amount: number | null;
  remaining_amount: number | null;
  monthly_deduction: number | null;
  max_deduction_pct: number;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════════════
// PAYROLL QUERY KEYS (extends queryKeys)
// ═══════════════════════════════════════════════════════════════

export const payrollQueryKeys = {
  employees: (companyId: string) => ['payroll', 'employees', companyId] as const,
  employee: (empId: string) => ['payroll', 'employee', empId] as const,
  employments: (empId: string) => ['payroll', 'employments', empId] as const,
  cycles: (companyId: string) => ['payroll', 'cycles', companyId] as const,
  cycle: (cycleId: string) => ['payroll', 'cycle', cycleId] as const,
  items: (cycleId: string) => ['payroll', 'items', cycleId] as const,
  calculations: (cycleId: string) => ['payroll', 'calculations', cycleId] as const,
  declarations: (empId: string) => ['payroll', 'declarations', empId] as const,
  filings: (companyId: string) => ['payroll', 'filings', companyId] as const,
  taxParameters: (year: number) => ['payroll', 'taxParameters', year] as const,
  jobCodes: () => ['payroll', 'jobCodes'] as const,
  leaves: (empId: string) => ['payroll', 'leaves', empId] as const,
  cafeteria: (empId: string, cycleId: string) => ['payroll', 'cafeteria', empId, cycleId] as const,
  garnishments: (empId: string) => ['payroll', 'garnishments', empId] as const,
};

// ═══════════════════════════════════════════════════════════════
// FOGLALKOZTATOTTAK
// ═══════════════════════════════════════════════════════════════

export function usePayrollEmployees(companyId: string) {
  return useQuery({
    queryKey: payrollQueryKeys.employees(companyId),
    queryFn: async (): Promise<PayrollEmployee[]> => {
      const { data, error } = await supabase
        .from('accounty_employees')
        .select('*')
        .eq('company_id', companyId)
        .order('last_name', { ascending: true });

      if (error) throw error;
      return (data || []) as PayrollEmployee[];
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });
}

export function usePayrollEmployee(employeeId: string) {
  return useQuery({
    queryKey: payrollQueryKeys.employee(employeeId),
    queryFn: async (): Promise<PayrollEmployee | null> => {
      const { data, error } = await supabase
        .from('accounty_employees')
        .select('*')
        .eq('id', employeeId)
        .single();

      if (error) throw error;
      return data as PayrollEmployee;
    },
    enabled: !!employeeId,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employee: Omit<PayrollEmployee, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('accounty_employees')
        .insert(employee)
        .select()
        .single();

      if (error) throw error;
      return data as PayrollEmployee;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.employees(data.company_id) });
      toast({ title: 'Siker', description: 'Foglalkoztatott sikeresen hozzáadva.' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PayrollEmployee> & { id: string }) => {
      const { data, error } = await supabase
        .from('accounty_employees')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as PayrollEmployee;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.employee(data.id) });
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.employees(data.company_id) });
      toast({ title: 'Siker', description: 'Foglalkoztatott adatai frissítve.' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// JOGVISZONYOK
// ═══════════════════════════════════════════════════════════════

export function usePayrollEmployments(employeeId: string) {
  return useQuery({
    queryKey: payrollQueryKeys.employments(employeeId),
    queryFn: async (): Promise<PayrollEmployment[]> => {
      const { data, error } = await supabase
        .from('accounty_employments')
        .select('*')
        .eq('employee_id', employeeId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return (data || []) as PayrollEmployment[];
    },
    enabled: !!employeeId,
  });
}

export function useCreateEmployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employment: Omit<PayrollEmployment, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('accounty_employments')
        .insert(employment)
        .select()
        .single();

      if (error) throw error;
      return data as PayrollEmployment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.employments(data.employee_id) });
      toast({ title: 'Siker', description: 'Jogviszony sikeresen rögzítve.' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    },
  });
}

export function useUpdateEmployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PayrollEmployment> & { id: string }) => {
      const { data, error } = await supabase
        .from('accounty_employments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as PayrollEmployment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.employments(data.employee_id) });
      toast({ title: 'Siker', description: 'Jogviszony sikeresen frissítve.' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// HAVI CIKLUSOK
// ═══════════════════════════════════════════════════════════════

export function usePayrollCycles(companyId: string) {
  return useQuery({
    queryKey: payrollQueryKeys.cycles(companyId),
    queryFn: async (): Promise<PayrollCycle[]> => {
      const { data, error } = await supabase
        .from('accounty_payroll_cycles')
        .select('*')
        .eq('company_id', companyId)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (error) throw error;
      return (data || []) as PayrollCycle[];
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });
}

export function usePayrollCycle(cycleId: string) {
  return useQuery({
    queryKey: payrollQueryKeys.cycle(cycleId),
    queryFn: async (): Promise<PayrollCycle | null> => {
      const { data, error } = await supabase
        .from('accounty_payroll_cycles')
        .select('*')
        .eq('id', cycleId)
        .single();

      if (error) throw error;
      return data as PayrollCycle;
    },
    enabled: !!cycleId,
  });
}

export function useCreateCycle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cycle: { company_id: string; year: number; month: number }) => {
      const { data, error } = await supabase
        .from('accounty_payroll_cycles')
        .insert(cycle)
        .select()
        .single();

      if (error) throw error;
      return data as PayrollCycle;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.cycles(data.company_id) });
      toast({ title: 'Siker', description: `${data.year}/${String(data.month).padStart(2, '0')} havi ciklus létrehozva.` });
    },
    onError: (err: Error) => {
      const msg = err.message?.includes('duplicate key') || err.message?.includes('unique')
        ? 'Ez a havi ciklus már létezik ennél a cégnél.'
        : err.message?.includes('policy')
        ? 'Nincs jogosultságod ciklust létrehozni ennél a cégnél.'
        : err.message;
      toast({ variant: 'destructive', title: 'Hiba', description: msg });
    },
  });
}

export function useUpdateCycleStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cycleId, step, status }: { cycleId: string; step: number; status?: string }) => {
      const updates: Record<string, unknown> = { current_step: step };
      if (status) updates.status = status;

      const { data, error } = await supabase
        .from('accounty_payroll_cycles')
        .update(updates)
        .eq('id', cycleId)
        .select()
        .single();

      if (error) throw error;
      return data as PayrollCycle;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.cycle(data.id) });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// BÉRELEMEK
// ═══════════════════════════════════════════════════════════════

export function usePayrollItems(cycleId: string) {
  return useQuery({
    queryKey: payrollQueryKeys.items(cycleId),
    queryFn: async (): Promise<PayrollItem[]> => {
      const { data, error } = await supabase
        .from('accounty_payroll_items')
        .select('*')
        .eq('cycle_id', cycleId);

      if (error) throw error;
      return (data || []) as PayrollItem[];
    },
    enabled: !!cycleId,
  });
}

// ═══════════════════════════════════════════════════════════════
// SZÁMFEJTETT EREDMÉNYEK
// ═══════════════════════════════════════════════════════════════

export function usePayrollCalculations(cycleId: string) {
  return useQuery({
    queryKey: payrollQueryKeys.calculations(cycleId),
    queryFn: async (): Promise<PayrollCalculation[]> => {
      const { data, error } = await supabase
        .from('accounty_payroll_calculations')
        .select('*')
        .eq('cycle_id', cycleId);

      if (error) throw error;
      return (data || []) as PayrollCalculation[];
    },
    enabled: !!cycleId,
  });
}

// ═══════════════════════════════════════════════════════════════
// ADÓELŐLEG-NYILATKOZATOK
// ═══════════════════════════════════════════════════════════════

export interface SalaryHistoryEntry {
  id: string;
  cycle_id: string;
  gross_salary: number;
  net_salary: number;
  szja_amount: number;
  tb_amount: number;
  szocho_amount: number;
  total_deductions: number;
  created_at: string;
  cycle_year: number;
  cycle_month: number;
  cycle_status: string;
}

/**
 * Fetch salary history for a specific employment (joins calculations with cycles)
 */
export function useEmployeeSalaryHistory(employmentId: string) {
  return useQuery({
    queryKey: ['payroll', 'salary-history', employmentId] as const,
    queryFn: async (): Promise<SalaryHistoryEntry[]> => {
      const { data, error } = await supabase
        .from('accounty_payroll_calculations')
        .select(`
          id,
          cycle_id,
          gross_salary,
          net_salary,
          szja_amount,
          tb_amount,
          szocho_amount,
          total_deductions,
          created_at,
          accounty_payroll_cycles!inner (
            year,
            month,
            status
          )
        `)
        .eq('employment_id', employmentId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return ((data || []) as any[]).map((row: any) => ({
        id: row.id,
        cycle_id: row.cycle_id,
        gross_salary: row.gross_salary || 0,
        net_salary: row.net_salary || 0,
        szja_amount: row.szja_amount || 0,
        tb_amount: row.tb_amount || 0,
        szocho_amount: row.szocho_amount || 0,
        total_deductions: row.total_deductions || 0,
        created_at: row.created_at,
        cycle_year: row.accounty_payroll_cycles?.year || 0,
        cycle_month: row.accounty_payroll_cycles?.month || 0,
        cycle_status: row.accounty_payroll_cycles?.status || 'unknown',
      }));
    },
    enabled: !!employmentId,
  });
}

export function usePayrollDeclarations(employeeId: string) {
  return useQuery({
    queryKey: payrollQueryKeys.declarations(employeeId),
    queryFn: async (): Promise<PayrollDeclaration[]> => {
      const { data, error } = await supabase
        .from('accounty_declarations')
        .select('*')
        .eq('employee_id', employeeId)
        .order('valid_from', { ascending: false });

      if (error) throw error;
      return (data || []) as PayrollDeclaration[];
    },
    enabled: !!employeeId,
  });
}

export function useAddDeclaration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (decl: {
      employee_id: string;
      declaration_type: string;
      valid_from: string;
      valid_until?: string;
      parameters?: any;
    }) => {
      const { data, error } = await supabase
        .from('accounty_declarations')
        .insert({
          employee_id: decl.employee_id,
          declaration_type: decl.declaration_type,
          valid_from: decl.valid_from,
          valid_until: decl.valid_until || null,
          parameters: decl.parameters || {},
          status: 'active',
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data as PayrollDeclaration;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.declarations(data.employee_id) });
      toast({ title: 'Siker', description: 'Nyilatkozat sikeresen rögzítve.' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    },
  });
}

export function useUpdateDeclaration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, employee_id, ...updates }: {
      id: string;
      employee_id: string;
      declaration_type?: string;
      valid_from?: string;
      valid_until?: string | null;
      parameters?: any;
    }) => {
      const { data, error } = await supabase
        .from('accounty_declarations')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...(data as PayrollDeclaration), employee_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.declarations(data.employee_id) });
      toast({ title: 'Siker', description: 'Nyilatkozat frissítve.' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    },
  });
}

export function useRevokeDeclaration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, employee_id }: { id: string; employee_id: string }) => {
      const { data, error } = await supabase
        .from('accounty_declarations')
        .update({ status: 'revoked', valid_until: new Date().toISOString().split('T')[0] })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { ...(data as PayrollDeclaration), employee_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.declarations(data.employee_id) });
      toast({ title: 'Visszavonva', description: 'Nyilatkozat sikeresen visszavonva.' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// ELTARTOTTAK
// ═══════════════════════════════════════════════════════════════

export function usePayrollDependents(employeeId: string) {
  return useQuery({
    queryKey: ['payroll', 'dependents', employeeId] as const,
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase
        .from('accounty_dependents')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
  });
}

export function useCreateDependent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dependent: any) => {
      const { data, error } = await supabase
        .from('accounty_dependents')
        .insert(dependent)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'dependents', data.employee_id] });
      toast({ title: 'Siker', description: 'Eltartott sikeresen hozzáadva.' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    },
  });
}

export function useUpdateDependent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; employee_id: string; [key: string]: any }) => {
      const { data, error } = await supabase
        .from('accounty_dependents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'dependents', data.employee_id] });
      toast({ title: 'Siker', description: 'Eltartott adatai frissítve.' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    },
  });
}

export function useDeleteDependent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, employee_id }: { id: string; employee_id: string }) => {
      const { error } = await supabase
        .from('accounty_dependents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, employee_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'dependents', data.employee_id] });
      toast({ title: 'Siker', description: 'Eltartott sikeresen törölve.' });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// NAV BEVALLÁSOK
// ═══════════════════════════════════════════════════════════════

export function usePayrollFilings(companyId: string) {
  return useQuery({
    queryKey: payrollQueryKeys.filings(companyId),
    queryFn: async (): Promise<PayrollFiling[]> => {
      const { data, error } = await supabase
        .from('accounty_filings')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PayrollFiling[];
    },
    enabled: !!companyId,
  });
}

// ═══════════════════════════════════════════════════════════════
// PARAMÉTERTÁBLA & JOGVISZONYKÓDOK (master data)
// ═══════════════════════════════════════════════════════════════

export function useTaxParameters(year: number = 2026) {
  return useQuery({
    queryKey: payrollQueryKeys.taxParameters(year),
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from('accounty_tax_parameters')
        .select('parameter_key, parameter_value')
        .eq('tax_year', year);

      if (error) throw error;

      const params: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        params[row.parameter_key] = row.parameter_value;
      });
      return params;
    },
    staleTime: 5 * 60 * 1000, // 5 perc cache
  });
}

/**
 * Paraméter értékének módosítása (upsert)
 */
export function useUpdateTaxParameter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ year, key, value }: { year: number; key: string; value: number }) => {
      const { error } = await supabase
        .from('accounty_tax_parameters')
        .upsert({ tax_year: year, parameter_key: key, parameter_value: value }, { onConflict: 'tax_year,parameter_key' });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.taxParameters(vars.year) });
    },
  });
}

/**
 * Paramétertábla → TaxParameters objektum konverzió
 */
export function paramsToTaxParams(params: Record<string, number>): TaxParameters {
  return {
    szja_rate: params.szja_rate ?? 0.15,
    tb_rate: params.tb_rate ?? 0.185,
    szocho_rate: params.szocho_rate ?? 0.13,
    minimum_wage: params.minimum_wage ?? 322800,
    guaranteed_minimum: params.guaranteed_minimum ?? 373200,
    family_1_child: params.family_1_child ?? 133340,
    family_2_children: params.family_2_children ?? 266660,
    family_3plus_children: params.family_3plus_children ?? 440000,
    young_25_cap: params.young_25_cap ?? 715765,
    personal_disability: params.personal_disability ?? 107600,
    first_marriage: params.first_marriage ?? 33335,
    health_service_monthly: params.health_service_monthly ?? 12300,
  };
}

export function useJobCodes() {
  return useQuery({
    queryKey: payrollQueryKeys.jobCodes(),
    queryFn: async (): Promise<PayrollJobCode[]> => {
      const { data, error } = await supabase
        .from('accounty_job_codes')
        .select('*')
        .order('code', { ascending: true });

      if (error) throw error;
      return (data || []) as PayrollJobCode[];
    },
    staleTime: 10 * 60 * 1000, // 10 perc cache
  });
}

// ═══════════════════════════════════════════════════════════════
// SZABADSÁGOK
// ═══════════════════════════════════════════════════════════════

export function usePayrollLeaves(employmentId: string) {
  return useQuery({
    queryKey: payrollQueryKeys.leaves(employmentId),
    queryFn: async (): Promise<PayrollLeave[]> => {
      const { data, error } = await supabase
        .from('accounty_leaves')
        .select('*')
        .eq('employment_id', employmentId)
        .order('start_date', { ascending: false });

      if (error) throw error;
      return (data || []) as PayrollLeave[];
    },
    enabled: !!employmentId,
  });
}

// ═══════════════════════════════════════════════════════════════
// CAFETERIA
// ═══════════════════════════════════════════════════════════════

export function usePayrollCafeteria(employmentId: string, cycleId?: string) {
  return useQuery({
    queryKey: payrollQueryKeys.cafeteria(employmentId, cycleId || ''),
    queryFn: async (): Promise<PayrollCafeteriaItem[]> => {
      let query = supabase
        .from('accounty_cafeteria')
        .select('*')
        .eq('employment_id', employmentId);

      if (cycleId) {
        query = query.eq('cycle_id', cycleId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PayrollCafeteriaItem[];
    },
    enabled: !!employmentId,
  });
}

export function useCreateCafeteriaItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Omit<PayrollCafeteriaItem, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('accounty_cafeteria')
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data as PayrollCafeteriaItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.cafeteria(data.employment_id, '') });
    },
  });
}

export function useDeleteCafeteriaItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, employmentId }: { id: string; employmentId: string }) => {
      const { error } = await supabase
        .from('accounty_cafeteria')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, employmentId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.cafeteria(data.employmentId, '') });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// LETILTÁSOK
// ═══════════════════════════════════════════════════════════════

export function usePayrollGarnishments(employeeId: string) {
  return useQuery({
    queryKey: payrollQueryKeys.garnishments(employeeId),
    queryFn: async (): Promise<PayrollGarnishment[]> => {
      const { data, error } = await supabase
        .from('accounty_garnishments')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (error) throw error;
      return (data || []) as PayrollGarnishment[];
    },
    enabled: !!employeeId,
  });
}

// ═══════════════════════════════════════════════════════════════
// TÖMEGES SZÁMFEJTÉS (Batch Payroll)
// ═══════════════════════════════════════════════════════════════

import { calculatePayroll, calculateGarnishments, type PayrollCalculationInput, type EmployeeDeclarations } from '@/lib/payroll/taxEngine';

export interface BatchPayrollInput {
  cycleId: string;
  companyId: string;
  year: number;
  month: number;
}

export interface BatchPayrollResult {
  totalEmployees: number;
  totalGross: number;
  totalNet: number;
  totalSzja: number;
  totalTb: number;
  totalSzocho: number;
  calculations: PayrollCalculation[];
}

export function useRunBatchPayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BatchPayrollInput): Promise<BatchPayrollResult> => {
      // 1. Fetch active employments for this company
      const { data: employments, error: empErr } = await supabase
        .from('accounty_employments')
        .select('*, accounty_employees!inner(*)')
        .eq('company_id', input.companyId)
        .eq('status', 'active');

      if (empErr) throw empErr;
      if (!employments || employments.length === 0) {
        throw new Error('Nincs aktív jogviszony ehhez a céghez.');
      }

      // 2. Fetch tax parameters
      const { data: paramRows, error: paramErr } = await supabase
        .from('accounty_tax_parameters')
        .select('parameter_key, parameter_value')
        .eq('tax_year', input.year);

      if (paramErr) throw paramErr;
      const taxParams = paramsToTaxParams(
        Object.fromEntries((paramRows || []).map((r: any) => [r.parameter_key, r.parameter_value]))
      );

      // 3. Fetch payroll items for this cycle
      const { data: items, error: itemErr } = await supabase
        .from('accounty_payroll_items')
        .select('*')
        .eq('cycle_id', input.cycleId);

      if (itemErr) throw itemErr;

      // 3.5 Fetch timesheets for this cycle
      const { data: timesheets, error: tsErr } = await supabase
        .from('accounty_timesheets')
        .select('*')
        .eq('cycle_id', input.cycleId);

      if (tsErr) throw tsErr;

      // 4. Run calculations per employment
      const results: any[] = [];

      for (const employment of (employments as any[])) {
        const employee = employment.accounty_employees;
        const empItems = ((items || []) as any[]).filter(i => i.employment_id === employment.id);

        // Base salary from employment or items
        const baseSalary = Number(employment.base_salary || 0);
        const isHourly = employment.salary_type === 'hourly';

        // Fetch timesheet attendance
        const tsRow = (timesheets || []).find((t: any) => t.employment_id === employment.id);
        const attendance = (tsRow?.ocr_data as any) || { workDays: 22, overtime: 0, sickDays: 0, leaveDays: 0 };

        // Calculate auto attendance values
        const weeklyHours = employment.weekly_hours || 40;
        const dailyHours = weeklyHours / 5;

        let hourlyRate = 0;
        let dailyRate = 0;
        let overtimeAmount = 0;
        let sickLeaveAmount = 0;
        let leaveAmount = 0;
        let adjustedBaseSalary = 0;

        if (isHourly) {
          // For Hourly employees: baseSalary is the hourly wage rate (e.g. 142 Ft/hour)
          hourlyRate = baseSalary;
          dailyRate = hourlyRate * dailyHours;

          const actualWorkedHours = (attendance.workDays || 0) * dailyHours;
          const sickHours = (attendance.sickDays || 0) * dailyHours;
          const leaveHours = (attendance.leaveDays || 0) * dailyHours;

          adjustedBaseSalary = Math.round(actualWorkedHours * hourlyRate);
          overtimeAmount = Math.round(hourlyRate * (attendance.overtime || 0) * 1.5);
          sickLeaveAmount = Math.round(hourlyRate * sickHours * 0.70);
          leaveAmount = Math.round(hourlyRate * leaveHours * 1.0);
        } else {
          // For Monthly employees: baseSalary is the full monthly salary (e.g. 150,000 Ft/month)
          dailyRate = baseSalary / 22;
          hourlyRate = baseSalary / (dailyHours * 22);

          const baseReduction = Math.round(dailyRate * (attendance.sickDays || 0));
          adjustedBaseSalary = Math.max(0, baseSalary - baseReduction);

          overtimeAmount = Math.round(hourlyRate * (attendance.overtime || 0) * 1.5);
          sickLeaveAmount = Math.round(dailyRate * (attendance.sickDays || 0) * 0.70);
          // For monthly salaried employees, leave (vacation) days are already covered in the base salary
          leaveAmount = 0;
        }

        // Fetch explicit item overrides if any
        const itemBaseSalary = empItems.find((i: any) => i.item_type === 'base_salary')?.amount;
        const itemOvertime = empItems.find((i: any) => i.item_type === 'overtime')?.amount;
        const itemSickLeave = empItems.find((i: any) => i.item_type === 'sick_leave')?.amount;

        const finalBase = itemBaseSalary !== undefined ? Number(itemBaseSalary) : adjustedBaseSalary;
        const finalOvertime = itemOvertime !== undefined ? Number(itemOvertime) : overtimeAmount;
        const finalSickLeave = itemSickLeave !== undefined ? Number(itemSickLeave) : sickLeaveAmount;

        const nightShift = Number(empItems.find((i: any) => i.item_type === 'night_shift')?.amount || 0);
        const sundayPremium = Number(empItems.find((i: any) => i.item_type === 'sunday_premium')?.amount || 0);
        const holidayPremium = Number(empItems.find((i: any) => i.item_type === 'holiday_premium')?.amount || 0);
        const bonus = Number(empItems.find((i: any) => i.item_type === 'bonus')?.amount || 0);
        
        const otherExtras = empItems
          .filter((i: any) => !i.is_deduction && !['base_salary', 'overtime', 'night_shift', 'sunday_premium', 'holiday_premium', 'bonus', 'sick_leave'].includes(i.item_type))
          .reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

        // Sum deductions from items
        const itemDeductions = empItems
          .filter((i: any) => i.is_deduction)
          .reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

        // Fetch declarations for this employee
        const { data: declRows } = await supabase
          .from('accounty_declarations')
          .select('*')
          .eq('employee_id', employee.id)
          .eq('status', 'active');

        const declarations: EmployeeDeclarations = {};

        // Parse declarations from DB rows into EmployeeDeclarations format
        for (const decl of ((declRows || []) as any[])) {
          if (decl.declaration_type === 'family_credit') {
            const children = (decl.parameters)?.children_count || 0;
            const sharePct = (decl.parameters)?.share_pct || 100;
            declarations.family = {
              dependentCount: children,
              eligibleChildrenCount: children,
              sharePct,
            };
          }
          if (decl.declaration_type === 'netak') {
            declarations.netak = { eligible: true };
          }
          if (decl.declaration_type === 'under_25') {
            declarations.young25 = { eligible: true };
          }
          if (decl.declaration_type === 'new_mother') {
            declarations.youngMother30 = { maxDeduction: 0 };
          }
          if (decl.declaration_type === 'first_marriage') {
            const months = (decl.parameters)?.months_remaining || 24;
            declarations.firstMarriage = { eligible: true, monthsRemaining: months };
          }
          if (decl.declaration_type === 'personal_disability') {
            declarations.personal = { eligible: true };
          }
        }

        // Fetch active garnishments for this employee
        const { data: garnishRows } = await supabase
          .from('accounty_garnishments')
          .select('*')
          .eq('employee_id', employee.id)
          .eq('is_active', true)
          .order('priority', { ascending: true });

        // Fetch cafeteria items for this employment and cycle
        const { data: cafeteriaRows } = await supabase
          .from('accounty_cafeteria')
          .select('*')
          .eq('employment_id', employment.id);

        const parsedCafeteria = (cafeteriaRows || []).map((c: any) => ({
          amount: c.amount || 0,
          subType: (c.sub_type || 'basic') as 'basic' | 'recreation',
          isHousingAllowance: !!c.is_housing_allowance
        }));

        // Calculate
        const birthDate = employee.birth_date ? new Date(employee.birth_date) : null;
        const employeeAge = birthDate
          ? Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 86400000))
          : 30; // fallback

        const calcInput: PayrollCalculationInput = {
          grossComponents: {
            baseSalary: finalBase,
            overtime: finalOvertime,
            nightShift,
            sundayPremium,
            holidayPremium,
            bonus,
            sickLeave: finalSickLeave,
            otherIncome: leaveAmount + otherExtras,
          },
          declarations,
          employeeAge,
          employeeGender: employee.gender || 'other',
          isInsured: employment.is_insured ?? true,
          jobCode: employment.job_code || '',
          weeklyHours: employment.weekly_hours || 40,
          params: taxParams,
          isPensioner: !!employment.is_pensioner,
          ekhoCategory: employment.ekho_category || 'normal',
          ekhoPayer: employment.ekho_payer || 'employee',
          isEkho: !!employment.is_ekho,
          isSzochoDiscount: !!employment.is_szocho_discount,
          szochoDiscountType: employment.szocho_discount_type || 'none',
          szochoDiscountMonthsElapsed: (employment.is_szocho_discount && employment.szocho_discount_start)
            ? Math.max(0, (input.year - new Date(employment.szocho_discount_start).getFullYear()) * 12 + (input.month - (new Date(employment.szocho_discount_start).getMonth() + 1)))
            : 0,
          cafeteria: parsedCafeteria,
          minimumContributionBaseRule: (employment.minimum_contribution_base_rule || 'none') as any,
          hasMinimumBase: !!employment.has_minimum_base,
          isMinBaseExemptGyesGyed: !!employment.is_min_base_exempt_gyes_gyed,
          isMinBaseExemptStudent: !!employment.is_min_base_exempt_student,
          isMinBasePaidElsewhere: !!employment.is_min_base_paid_elsewhere,
          otherCompanyName: employment.other_company_name || undefined,
          otherCompanyTaxNumber: employment.other_company_tax_number || undefined,
        };

        const result = calculatePayroll(calcInput);

        // Apply garnishments
        const parsedGarnishments = (garnishRows || []).map((g: any) => ({
          type: (g.garnishment_type || 'private_debt') as any,
          monthlyDeduction: g.monthly_deduction || 0,
          maxDeductionPct: g.max_deduction_pct || 0.33,
          priority: g.priority || 1,
        }));
        
        const garnishResult = calculateGarnishments(result.netSalary, parsedGarnishments);
        const finalNet = result.netSalary - garnishResult.total;

        results.push({
          cycle_id: input.cycleId,
          employment_id: employment.id,
          gross_salary: result.grossSalary,
          szja_base: result.szjaBase,
          szja_amount: result.szjaAmount,
          tb_amount: result.tbAmount,
          szocho_amount: result.szochoAmount,
          net_salary: finalNet, // net after garnishments
          total_deductions: itemDeductions + garnishResult.total,
          tax_credits: result.taxCredits || {},
          szocho_credits: { discount: result.szochoAmount - (result.szochoBase * taxParams.szocho_rate) },
          deductions: {
            advances: empItems.filter((i: any) => i.is_deduction && i.item_type === 'advance').reduce((s: number, i: any) => s + (i.amount || 0), 0),
            garnishments: garnishResult.total,
            other: empItems.filter((i: any) => i.is_deduction && i.item_type !== 'advance').reduce((s: number, i: any) => s + (i.amount || 0), 0),
            total: itemDeductions + garnishResult.total
          },
          cafeteria_tax: { employer: result.cafeteriaTaxEmployer || 0 },
          metadata: {
            employee_id: employee.id,
            employee_name: `${employee.last_name} ${employee.first_name}`,
            calculated_at: new Date().toISOString(),
          },
        });
      }

      // 5. Delete old calculations for this cycle
      await supabase
        .from('accounty_payroll_calculations')
        .delete()
        .eq('cycle_id', input.cycleId);

      // 6. Insert new calculations
      const { data: savedCalcs, error: saveErr } = await supabase
        .from('accounty_payroll_calculations')
        .insert(results)
        .select();

      if (saveErr) throw saveErr;

      // 7. Calculate totals
      const typed = (savedCalcs || []) as PayrollCalculation[];
      return {
        totalEmployees: typed.length,
        totalGross: typed.reduce((s, c) => s + (c.gross_salary || 0), 0),
        totalNet: typed.reduce((s, c) => s + (c.net_salary || 0), 0),
        totalSzja: typed.reduce((s, c) => s + (c.szja_amount || 0), 0),
        totalTb: typed.reduce((s, c) => s + (c.tb_amount || 0), 0),
        totalSzocho: typed.reduce((s, c) => s + (c.szocho_amount || 0), 0),
        calculations: typed,
      };
    },
    onSuccess: (data, input) => {
      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.calculations(input.cycleId) });
      toast({
        title: 'Számfejtés kész',
        description: `${data.totalEmployees} foglalkoztatott feldolgozva. Nettó összesen: ${data.totalNet.toLocaleString('hu-HU')} Ft`,
      });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Számfejtési hiba', description: err.message });
    },
  });
}
