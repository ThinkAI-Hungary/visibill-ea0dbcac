import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export interface QuestionableInvoice {
  id: string;
  invoice_number: string;
  invoice_direction: string | null;
  invoice_delivery_date: string;
  invoice_issue_date: string;
  supplier_name: string;
  supplier_tax_number: string | null;
  invoice_net_amount: number;
  invoice_vat_amount: number;
  invoice_gross_amount: number;
  currency: string;
  is_submitted: boolean;
  accounting_exclusion_type: 'DEFERRED_VAT';
  deferred_vat_reason: string | null;
  deferred_vat_since: string | null;
  deferred_vat_target_period: string | null;
  days_remaining_statutory: number;
}

export function useQuestionableInvoices(companyId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation(['accounting', 'common']);

  const query = useQuery<QuestionableInvoice[]>({
    queryKey: ['questionable_invoices', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase.rpc('get_questionable_invoices', {
        p_company_id: companyId,
      });

      if (error) {
        console.error('Error fetching questionable invoices:', error);
        throw error;
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        invoice_number: row.invoice_number,
        invoice_direction: row.invoice_direction,
        invoice_delivery_date: row.invoice_delivery_date,
        invoice_issue_date: row.invoice_issue_date,
        supplier_name: row.supplier_name,
        supplier_tax_number: row.supplier_tax_number,
        invoice_net_amount: Number(row.invoice_net_amount) || 0,
        invoice_vat_amount: Number(row.invoice_vat_amount) || 0,
        invoice_gross_amount: Number(row.invoice_gross_amount) || 0,
        currency: row.currency || 'HUF',
        is_submitted: !!row.is_submitted,
        accounting_exclusion_type: row.accounting_exclusion_type || 'DEFERRED_VAT',
        deferred_vat_reason: row.deferred_vat_reason,
        deferred_vat_since: row.deferred_vat_since,
        deferred_vat_target_period: row.deferred_vat_target_period,
        days_remaining_statutory: Number(row.days_remaining_statutory) || 0,
      }));
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });

  const includeInPeriodMutation = useMutation({
    mutationFn: async ({
      invoiceId,
      isSubmitted,
      targetPeriod,
    }: {
      invoiceId: string;
      isSubmitted: boolean;
      targetPeriod: string;
    }) => {
      if (!companyId) throw new Error('Nincs kiválasztott cég');
      const { data, error } = await supabase.rpc('include_deferred_invoice_in_period', {
        p_company_id: companyId,
        p_invoice_id: invoiceId,
        p_is_submitted: isSubmitted,
        p_target_period: targetPeriod,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast({
        title: 'Számla sikeresen beemelve',
        description: `A számla bekerült a(z) ${variables.targetPeriod} időszaki ÁFA bevallásba és könyvelésbe.`,
      });
      queryClient.invalidateQueries({ queryKey: ['questionable_invoices', companyId] });
      queryClient.invalidateQueries({ queryKey: ['vat-return-data'] });
      queryClient.invalidateQueries({ queryKey: ['nav-vat-data'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a számla beemelésekor',
        description: err.message || 'Nem sikerült beemelni a számlát.',
        variant: 'destructive',
      });
    },
  });

  const includeMultipleInPeriodMutation = useMutation({
    mutationFn: async ({
      items,
      targetPeriod,
    }: {
      items: { id: string; isSubmitted: boolean }[];
      targetPeriod: string;
    }) => {
      if (!companyId) throw new Error('Nincs kiválasztott cég');
      for (const item of items) {
        const { error } = await supabase.rpc('include_deferred_invoice_in_period', {
          p_company_id: companyId,
          p_invoice_id: item.id,
          p_is_submitted: item.isSubmitted,
          p_target_period: targetPeriod,
        });
        if (error) throw error;
      }
      return items.length;
    },
    onSuccess: (count, variables) => {
      toast({
        title: 'Számlák sikeresen beemelve',
        description: `${count} db számla bekerült a(z) ${variables.targetPeriod} időszaki bevallásba és könyvelésbe.`,
      });
      queryClient.invalidateQueries({ queryKey: ['questionable_invoices', companyId] });
      queryClient.invalidateQueries({ queryKey: ['vat-return-data'] });
      queryClient.invalidateQueries({ queryKey: ['nav-vat-data'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a számlák beemelésekor',
        description: err.message || 'Nem sikerült beemelni a számlákat.',
        variant: 'destructive',
      });
    },
  });

  const setPermanentExclusionMutation = useMutation({
    mutationFn: async ({
      invoiceId,
      isSubmitted,
      reason,
    }: {
      invoiceId: string;
      isSubmitted: boolean;
      reason?: string;
    }) => {
      if (!companyId) throw new Error('Nincs kiválasztott cég');
      const { data, error } = await supabase.rpc('set_invoice_accounting_exclusion', {
        p_company_id: companyId,
        p_invoice_id: invoiceId,
        p_is_submitted: isSubmitted,
        p_exclusion_type: 'PERMANENT',
        p_reason: reason || 'Véglegesen kizárva (magánhasználat / nem vállalkozási cél)',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Számla véglegesen kizárva',
        description: 'A számla véglegesen kikerült a könyvelésből és az ÁFA levonásból.',
      });
      queryClient.invalidateQueries({ queryKey: ['questionable_invoices', companyId] });
      queryClient.invalidateQueries({ queryKey: ['vat-return-data'] });
      queryClient.invalidateQueries({ queryKey: ['nav-vat-data'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a kizárás beállításakor',
        description: err.message || 'Nem sikerült módosítani a számla státuszát.',
        variant: 'destructive',
      });
    },
  });

  const invoices = query.data || [];
  const totalCount = invoices.length;
  const totalNet = invoices.reduce((sum, inv) => sum + inv.invoice_net_amount, 0);
  const totalVat = invoices.reduce((sum, inv) => sum + inv.invoice_vat_amount, 0);
  const totalGross = invoices.reduce((sum, inv) => sum + inv.invoice_gross_amount, 0);
  const criticalCount = invoices.filter((inv) => inv.days_remaining_statutory < 180).length;
  const warningCount = invoices.filter(
    (inv) => inv.days_remaining_statutory >= 180 && inv.days_remaining_statutory <= 365
  ).length;

  return {
    invoices,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    totalCount,
    totalNet,
    totalVat,
    totalGross,
    criticalCount,
    warningCount,
    includeInPeriod: includeInPeriodMutation.mutateAsync,
    isIncluding: includeInPeriodMutation.isPending,
    includeMultipleInPeriod: includeMultipleInPeriodMutation.mutateAsync,
    isIncludingMultiple: includeMultipleInPeriodMutation.isPending,
    setPermanentExclusion: setPermanentExclusionMutation.mutateAsync,
    isSettingPermanent: setPermanentExclusionMutation.isPending,
  };
}
