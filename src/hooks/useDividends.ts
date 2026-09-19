/**
 * Accounty — Osztalék Számfejtési Modul Hookok
 *
 * Tagi osztalék jóváhagyása, 15% SZJA és 13% SZOCHO kalkuláció
 * (2026-os 24 × minimálbér = 7 747 200 Ft felső plafon figyelésével).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface DividendRecord {
  id: string;
  company_id: string;
  member_name: string;
  member_tax_id: string;
  declaration_date: string;
  payout_date: string | null;
  gross_amount: number;
  has_reached_szocho_cap: boolean;
  szja_rate: number;
  szja_amount: number;
  szocho_rate: number;
  szocho_amount: number;
  net_amount: number;
  status: 'draft' | 'approved' | 'paid' | 'posted' | 'cancelled';
  journal_entry_id?: string | null;
  resolution_number?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DividendCalculationInput {
  grossAmount: number;
  hasReachedSzochoCap: boolean;
  priorIncomeForCap?: number;
  minWage?: number; // 2026: 322 800 Ft
}

export interface DividendCalculationResult {
  grossAmount: number;
  szjaAmount: number;
  szochoAmount: number;
  netAmount: number;
  szochoCap: number;
  taxableSzochoBase: number;
  isCapped: boolean;
}

export const SZOCHO_ANNUAL_CAP_2026 = 24 * 322_800; // 7 747 200 Ft (2026 minimálbér 24-szerese)

/**
 * 2026-os jogszabályi osztalék adószámítás
 * Szja tv. 66. § (15% SZJA) és Szocho tv. 1. § (5) bek., 2. § (13% SZOCHO, 24x minimálbér plafon)
 */
export function calculateDividendTaxes(input: DividendCalculationInput): DividendCalculationResult {
  const minWage = input.minWage || 322_800;
  const szochoCap = 24 * minWage;
  const gross = Math.max(0, input.grossAmount);

  // 15% SZJA (minden esetben fizetendő, korlátlan)
  const szjaAmount = Math.round(gross * 0.15);

  let szochoAmount = 0;
  let taxableSzochoBase = 0;
  let isCapped = false;

  if (input.hasReachedSzochoCap) {
    szochoAmount = 0;
    taxableSzochoBase = 0;
    isCapped = true;
  } else {
    const priorIncome = Math.max(0, input.priorIncomeForCap || 0);
    const remainingCap = Math.max(0, szochoCap - priorIncome);
    taxableSzochoBase = Math.min(gross, remainingCap);
    szochoAmount = Math.round(taxableSzochoBase * 0.13);
    isCapped = gross >= remainingCap;
  }

  const netAmount = Math.max(0, gross - szjaAmount - szochoAmount);

  return {
    grossAmount: gross,
    szjaAmount,
    szochoAmount,
    netAmount,
    szochoCap,
    taxableSzochoBase,
    isCapped,
  };
}

export function useDividends(companyId: string) {
  return useQuery({
    queryKey: ['accounty_dividends', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('accounty_dividends')
        .select('*')
        .eq('company_id', companyId)
        .order('declaration_date', { ascending: false });

      if (error) throw error;
      return (data || []) as DividendRecord[];
    },
    enabled: !!companyId,
  });
}

export function useCreateDividend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: Omit<DividendRecord, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('accounty_dividends')
        .insert([record])
        .select()
        .single();

      if (error) throw error;
      return data as DividendRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['accounty_dividends', data.company_id] });
      toast({
        title: 'Osztalék rögzítve',
        description: `${data.member_name} részére ${data.gross_amount.toLocaleString('hu-HU')} Ft bruttó osztalék felvéve.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Mentési hiba',
        description: err.message || 'Nem sikerült menteni az osztalék számfejtést.',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateDividend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId, ...updates }: Partial<DividendRecord> & { id: string; companyId: string }) => {
      const { data, error } = await supabase
        .from('accounty_dividends')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as DividendRecord;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['accounty_dividends', data.company_id] });
      toast({
        title: 'Osztalék frissítve',
        description: `Státusz: ${data.status}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Frissítési hiba',
        description: err.message || 'Nem sikerült módosítani az osztalékot.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteDividend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      // 1. Fetch the dividend first to check if there is a linked journal entry
      const { data: dividend } = await supabase
        .from('accounty_dividends')
        .select('id, journal_entry_id, status, member_name')
        .eq('id', id)
        .maybeSingle();

      let wasStornoed = false;

      // 2. If a journal entry is linked, handle its storno or deletion
      if (dividend?.journal_entry_id) {
        const { data: header } = await supabase
          .from('acc_journal_headers')
          .select('id, status, journal_number')
          .eq('id', dividend.journal_entry_id)
          .maybeSingle();

        if (header) {
          if (header.status === 'KONYVELT') {
            // Per Sztv., posted entries cannot be deleted directly; they must be stornoed with inverted lines
            const { data: { user } } = await supabase.auth.getUser();
            const { error: stornoErr } = await supabase.rpc('acc_storno_journal_entry', {
              p_header_id: header.id,
              p_user_id: user?.id || null,
              p_reason: `Osztalék tétel törölve a bérszámfejtésből (${dividend.member_name || ''})`,
              p_create_correction: false,
            });
            if (stornoErr) {
              console.error('Failed to storno dividend journal entry:', stornoErr);
            } else {
              wasStornoed = true;
            }
          } else {
            // Unposted draft: safe to delete lines and header
            await supabase.from('acc_journal_lines').delete().eq('header_id', header.id);
            await supabase.from('acc_journal_headers').delete().eq('id', header.id);
          }
        }
      }

      // 3. Delete dividend record
      const { error } = await supabase
        .from('accounty_dividends')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, companyId, wasStornoed };
    },
    onSuccess: ({ companyId, wasStornoed }) => {
      queryClient.invalidateQueries({ queryKey: ['accounty_dividends', companyId] });
      queryClient.invalidateQueries({ queryKey: ['acc_journal_headers'] });
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      queryClient.invalidateQueries({ queryKey: ['glJournalItems'] });
      queryClient.invalidateQueries({ queryKey: ['gl_accounts'] });
      queryClient.invalidateQueries({ queryKey: ['gl_account_card'] });
      queryClient.invalidateQueries({ queryKey: ['gl_balances'] });
      queryClient.invalidateQueries({ queryKey: ['subledger-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['glBalancesCurr'] });
      queryClient.invalidateQueries({ queryKey: ['glBalancesPrev'] });
      toast({
        title: 'Osztalék törölve',
        description: wasStornoed
          ? 'Az osztalék törölve, és a kapcsolódó főkönyvi naplóbejegyzés automatikusan sztornózva lett.'
          : 'A tétel sikeresen eltávolítva.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Törlési hiba',
        description: err.message || 'Nem sikerült törölni a tételt.',
        variant: 'destructive',
      });
    },
  });
}
