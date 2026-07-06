import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';
import { exportToFile } from '@/lib/exportUtils';

export interface SzepCardTransaction {
  id: string;
  company_id: string;
  upload_id: string | null;
  transaction_date: string;
  gross_amount: number;
  commission_amount: number;
  commission_vat: number;
  net_amount: number;
  currency: string;
  merchant_name: string | null;
  sub_account: string;
  card_number_masked: string | null;
  card_holder: string | null;
  issuer_bank: string | null;
  pos_terminal_id: string | null;
  approval_code: string | null;
  transaction_ref: string | null;
  is_webshop: boolean;
  transfer_reference: string | null;
  transfer_date: string | null;
  bank_account: string | null;
  status: string;
  is_reversal: boolean;
  created_at: string;
  updated_at: string;
}

export interface SzepKpis {
  totalCount: number;
  totalGross: number;
  totalCommission: number;
  totalNet: number;
  bySubAccount: Record<string, { count: number; gross: number; net: number }>;
}

const SUB_ACCOUNT_LABELS: Record<string, string> = {
  'Szálláshely': 'Szálláshely',
  'Vendéglátás': 'Vendéglátás',
  'Szabadidő': 'Szabadidő',
};

export function useSzepCardData() {
  const { selectedCompany } = useCompany();
  const { dateFrom, dateTo } = useDateRange();
  const dateFromStr = dateFrom ? format(dateFrom, 'yyyy-MM-dd') : '';
  const dateToStr = dateTo ? format(dateTo, 'yyyy-MM-dd') : '';

  const [subAccountFilter, setSubAccountFilter] = useState<string>('all');

  // Main query
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['szep-card-transactions', selectedCompany?.id, dateFromStr, dateToStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('szep_card_transactions')
        .select('*')
        .eq('company_id', selectedCompany!.id)
        .gte('transaction_date', dateFromStr)
        .lte('transaction_date', dateToStr)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as SzepCardTransaction[];
    },
    enabled: !!selectedCompany?.id && !!dateFromStr && !!dateToStr,
    staleTime: 30_000,
  });

  // KPIs
  const kpis = useMemo<SzepKpis>(() => {
    const result: SzepKpis = {
      totalCount: transactions.length,
      totalGross: 0,
      totalCommission: 0,
      totalNet: 0,
      bySubAccount: {},
    };

    for (const tx of transactions) {
      result.totalGross += Number(tx.gross_amount) || 0;
      result.totalCommission += Number(tx.commission_amount) || 0;
      result.totalNet += Number(tx.net_amount) || 0;

      const sa = tx.sub_account || 'Egyéb';
      if (!result.bySubAccount[sa]) {
        result.bySubAccount[sa] = { count: 0, gross: 0, net: 0 };
      }
      result.bySubAccount[sa].count++;
      result.bySubAccount[sa].gross += Number(tx.gross_amount) || 0;
      result.bySubAccount[sa].net += Number(tx.net_amount) || 0;
    }

    return result;
  }, [transactions]);

  // Filtered by sub-account
  const filteredTransactions = useMemo(() => {
    if (subAccountFilter === 'all') return transactions;
    return transactions.filter(tx => tx.sub_account === subAccountFilter);
  }, [transactions, subAccountFilter]);

  // Unique sub-accounts
  const subAccounts = useMemo(() => {
    const set = new Set(transactions.map(tx => tx.sub_account));
    return Array.from(set).sort();
  }, [transactions]);

  // Export
  const handleExport = useCallback(async (exportFormat: 'csv' | 'xlsx') => {
    const headers = [
      'Dátum', 'Kártyatulajdonos', 'Alszámla', 'Bruttó (Ft)', 'Jutalék (Ft)',
      'Jutalék ÁFA (Ft)', 'Nettó (Ft)', 'Bank', 'Utalás dátum', 'Bizonylatszám',
      'POS terminál', 'Kártyaszám', 'Elfogadóhely', 'Státusz',
    ];
    const exportData = filteredTransactions.map(tx => [
      tx.transaction_date,
      tx.card_holder || '',
      tx.sub_account,
      tx.gross_amount.toString(),
      tx.commission_amount.toString(),
      tx.commission_vat.toString(),
      tx.net_amount.toString(),
      tx.issuer_bank || '',
      tx.transfer_date || '',
      tx.transfer_reference || '',
      tx.pos_terminal_id || '',
      tx.card_number_masked || '',
      tx.merchant_name || '',
      tx.status,
    ]);
    await exportToFile(headers, exportData, exportFormat, 'szep_kartya_tranzakciok');
  }, [filteredTransactions]);

  return {
    transactions: filteredTransactions,
    allTransactions: transactions,
    isLoading,
    kpis,
    subAccounts,
    subAccountFilter,
    setSubAccountFilter,
    subAccountLabels: SUB_ACCOUNT_LABELS,
    handleExport,
  };
}
