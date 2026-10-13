import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EmployeePayoutSummary {
  calculation_id: string;
  employee_id: string;
  employee_name: string;
  bank_account: string;
  gross_salary: number;
  net_salary: number;
  commute_reimbursement: number;
  total_payable: number;
  paid_amount: number;
  difference: number;
  match_status: 'PAID' | 'PARTIAL' | 'OVERPAID' | 'PENDING';
  match_type: 'AUTO_IBAN' | 'AUTO_AMOUNT' | 'AUTO_NAME' | 'MANUAL' | 'GIRO_BATCH_SPLIT' | null;
  paid_date: string | null;
}

export interface PayrollDiscrepancy {
  type: 'OVERPAYMENT' | 'OVERDUE_PAYOUT' | 'GL_PAYROLL_MISMATCH';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  diff_amount: number;
  actual_amount: number;
  expected_amount: number;
  employee_name?: string;
}

export interface Payroll471ReconciliationResult {
  company_id: string;
  year: number;
  month: number;
  cycle: {
    id: string | null;
    status: string | null;
    payout_deadline: string;
  };
  reconciliation: {
    opening_balance: number;
    total_net_accrued: number;
    credit_471: number;
    debit_471: number;
    total_paid: number;
    closing_balance: number;
    discrepancy_amount: number;
    is_balanced: boolean;
    status: 'BALANCED' | 'PENDING_PAYOUT' | 'MISMATCH' | 'OVERPAID';
  };
  payroll_summary: {
    employee_count: number;
    total_gross: number;
    total_net: number;
    total_commute: number;
    total_szja: number;
    total_tb: number;
    total_szocho: number;
    total_deductions: number;
  };
  payout_stats: {
    total_paid: number;
    paid_count: number;
    pending_count: number;
    discrepancy_count: number;
    payout_ratio: number;
  };
  employees: EmployeePayoutSummary[];
  discrepancies: PayrollDiscrepancy[];
}

/**
 * Lekéri a havi 471-es főkönyvi egyeztetőt, a béranalitikát és a kifizetések státuszát
 */
export async function getPayroll471Reconciliation(
  companyId: string,
  year: number,
  month: number
): Promise<Payroll471ReconciliationResult> {
  const { data, error } = await supabase.rpc('get_payroll_471_reconciliation', {
    p_company_id: companyId,
    p_year: year,
    p_month: month,
  });

  if (error) throw error;
  return data as Payroll471ReconciliationResult;
}

/**
 * Automatikus banki kivonat-párosítás indítása
 */
export async function autoMatchPayrollBankTransactions(
  companyId: string,
  year: number,
  month: number
): Promise<{ success: boolean; matched_count: number; message?: string }> {
  const { data, error } = await supabase.rpc('auto_match_payroll_bank_transactions', {
    p_company_id: companyId,
    p_year: year,
    p_month: month,
  });

  if (error) throw error;
  return data as { success: boolean; matched_count: number; message?: string };
}

/**
 * Kézi kifizetés-párosítás rögzítése
 */
export async function manualMatchPayrollPayout(params: {
  companyId: string;
  cycleId: string;
  calculationId: string;
  employeeId: string;
  bankTransactionId?: string;
  cashDocumentId?: string;
  matchedAmount: number;
  expectedAmount: number;
  notes?: string;
}): Promise<void> {
  const { data: user } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('accounty_payroll_payout_matches')
    .upsert({
      company_id: params.companyId,
      cycle_id: params.cycleId,
      calculation_id: params.calculationId,
      employee_id: params.employeeId,
      bank_transaction_id: params.bankTransactionId || null,
      cash_document_id: params.cashDocumentId || null,
      match_type: 'MANUAL',
      match_status: 'MATCHED',
      matched_amount: params.matchedAmount,
      expected_amount: params.expectedAmount,
      notes: params.notes || null,
      matched_by: user?.user?.id || null,
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;
}

/**
 * Párosítás feloldása / törlése
 */
export async function unmatchPayrollPayout(calculationId: string): Promise<void> {
  const { error } = await supabase
    .from('accounty_payroll_payout_matches')
    .delete()
    .eq('calculation_id', calculationId);

  if (error) throw error;
}

// ── React Query Hookok ──

export function usePayroll471Reconciliation(
  companyId?: string,
  year?: number,
  month?: number
) {
  return useQuery<Payroll471ReconciliationResult>({
    queryKey: ['payroll-471-reconciliation', companyId, year, month],
    queryFn: () => getPayroll471Reconciliation(companyId!, year!, month!),
    enabled: !!companyId && !!year && !!month,
    staleTime: 30 * 1000,
  });
}

export function useAutoMatchPayrollBank() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (params: { companyId: string; year: number; month: number }) =>
      autoMatchPayrollBankTransactions(params.companyId, params.year, params.month),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['payroll-471-reconciliation', variables.companyId, variables.year, variables.month],
      });
      toast({
        title: 'Banki párosítás lefutott',
        description: `${data.matched_count} db munkavállalói kifizetés sikeresen hozzárendelve a bankkivonathoz.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Párosítási hiba',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}

export function useManualMatchPayrollPayout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: manualMatchPayrollPayout,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['payroll-471-reconciliation', variables.companyId],
      });
      toast({
        title: 'Kifizetés rögzítve',
        description: 'A munkabér kifizetés státusza sikeresen frissítve.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Mentési hiba',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUnmatchPayrollPayout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: unmatchPayrollPayout,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['payroll-471-reconciliation'],
      });
      toast({
        title: 'Párosítás feloldva',
        description: 'A kifizetés ismét nyitott státuszba került.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a feloldáskor',
        description: err.message,
        variant: 'destructive',
      });
    },
  });
}
