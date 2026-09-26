import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { PurchaseVoucher, PurchaseVoucherFormData, PurchaseVouchersSummary } from '../types';
import { calculateVouchersSummary, filterVouchers } from '../utils';

export function usePurchaseVouchers() {
  const { selectedCompany } = useCompany();
  const { dateFrom, dateTo } = useDateRange();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid'>('all');

  const dateFromStr = useMemo(() => format(dateFrom, 'yyyy-MM-dd'), [dateFrom]);
  const dateToStr = useMemo(() => format(dateTo, 'yyyy-MM-dd'), [dateTo]);
  const companyId = selectedCompany?.id;

  // 1. Feature Flag Check
  const { data: featureSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['purchase-vouchers-settings', companyId],
    queryFn: async () => {
      if (!companyId) return { has_purchase_vouchers: false };

      const { data, error } = await supabase
        .from('company_settings')
        .select('has_purchase_vouchers')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('Could not fetch company_settings for purchase vouchers', error);
      }
      return { has_purchase_vouchers: Boolean(data?.has_purchase_vouchers) };
    },
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });

  const isFeatureEnabled = Boolean(featureSettings?.has_purchase_vouchers);

  // 2. Fetch Purchase Vouchers with items
  const { data: vouchers = [], isLoading, refetch } = useQuery({
    queryKey: ['purchase-vouchers', companyId, dateFromStr, dateToStr],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('purchase_vouchers')
        .select(`
          *,
          items:purchase_voucher_items(*)
        `)
        .eq('company_id', companyId)
        .gte('fulfillment_date', dateFromStr)
        .lte('fulfillment_date', dateToStr)
        .order('fulfillment_date', { ascending: false });

      if (error) {
        console.error('Error fetching purchase vouchers:', error);
        return [];
      }

      return (data || []) as PurchaseVoucher[];
    },
    enabled: !!companyId,
  });

  // 3. Enable Feature Mutation
  const enableFeatureMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!companyId) throw new Error('Cég azonosító hiányzik.');

      // Update company_settings
      const { error: settingsError } = await supabase
        .from('company_settings')
        .upsert(
          { company_id: companyId, has_purchase_vouchers: enabled },
          { onConflict: 'company_id' }
        );

      if (settingsError) throw settingsError;

      return enabled;
    },
    onSuccess: (enabled) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-vouchers-settings', companyId] });
      toast({
        title: enabled ? 'Felvásárlási jegy modul bekapcsolva' : 'Modul kikapcsolva',
        description: enabled
          ? 'A mezőgazdasági felvásárlási jegyek kezelése mostantól aktív ennél a cégnél.'
          : 'A modul sikeresen kikapcsolva.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba történt a beállítás mentésekor',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // 4. Create / Edit Voucher Mutation
  const saveVoucherMutation = useMutation({
    mutationFn: async ({
      id,
      formData,
    }: {
      id?: string;
      formData: PurchaseVoucherFormData;
    }) => {
      if (!companyId) throw new Error('Cég azonosító hiányzik.');

      const { data: { user } } = await supabase.auth.getUser();

      // Calculate totals
      let totalNet = 0;
      const rate = formData.compensation_surcharge_rate || 12.00;

      const processedItems = formData.items.map((item) => {
        const itemNet = (item.quantity || 0) * (item.unit_price || 0);
        totalNet += itemNet;
        const itemComp = Math.round((itemNet * rate) / 100 * 100) / 100;
        const itemGross = itemNet + itemComp;
        return {
          ...item,
          net_amount: itemNet,
          compensation_rate: rate,
          compensation_amount: itemComp,
          gross_amount: itemGross,
          company_id: companyId,
        };
      });

      const totalCompensation = Math.round((totalNet * rate) / 100 * 100) / 100;
      const taxDeducted = formData.tax_deducted || 0;
      const totalGross = totalNet + totalCompensation - taxDeducted;

      // Header payload
      const headerPayload = {
        company_id: companyId,
        voucher_number: formData.voucher_number.trim(),
        producer_name: formData.producer_name.trim(),
        producer_tax_id: formData.producer_tax_id?.trim() || null,
        producer_card_number: formData.producer_card_number?.trim() || null,
        producer_address: formData.producer_address?.trim() || null,
        producer_bank_account: formData.producer_bank_account?.trim() || null,
        issue_date: formData.issue_date,
        fulfillment_date: formData.fulfillment_date,
        payment_due_date: formData.payment_due_date || null,
        payment_method: formData.payment_method,
        net_amount: totalNet,
        compensation_surcharge_rate: rate,
        compensation_surcharge_amount: totalCompensation,
        gross_amount: totalGross,
        tax_deducted: taxDeducted,
        paid_amount: formData.payment_status === 'paid' ? totalGross : 0,
        payment_status: formData.payment_status || 'unpaid',
        paid_at: formData.payment_status === 'paid' ? new Date().toISOString() : null,
        payroll_period: formData.payroll_period || formData.fulfillment_date.substring(0, 7),
        description: formData.description?.trim() || null,
        document_url: formData.document_url || null,
        updated_at: new Date().toISOString(),
        created_by: user?.id || null,
      };

      let voucherId = id;

      if (id) {
        // Update existing header
        const { error: updateErr } = await supabase
          .from('purchase_vouchers')
          .update(headerPayload)
          .eq('id', id);
        if (updateErr) throw updateErr;

        // Delete existing items and re-insert
        await supabase.from('purchase_voucher_items').delete().eq('voucher_id', id);
      } else {
        // Insert new header
        const { data: newVoucher, error: insertErr } = await supabase
          .from('purchase_vouchers')
          .insert(headerPayload)
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        voucherId = newVoucher.id;
      }

      // Insert line items
      if (processedItems.length > 0 && voucherId) {
        const itemsToInsert = processedItems.map((item) => ({
          voucher_id: voucherId,
          company_id: companyId,
          item_name: item.item_name,
          vtszt_kn_code: item.vtszt_kn_code || null,
          quantity: item.quantity,
          unit_of_measure: item.unit_of_measure,
          unit_price: item.unit_price,
          net_amount: item.net_amount,
          compensation_rate: item.compensation_rate,
          compensation_amount: item.compensation_amount,
          gross_amount: item.gross_amount,
        }));

        const { error: itemsErr } = await supabase
          .from('purchase_voucher_items')
          .insert(itemsToInsert);
        if (itemsErr) throw itemsErr;
      }

      return voucherId;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-vouchers', companyId] });
      toast({
        title: id ? 'Felvásárlási jegy módosítva' : 'Felvásárlási jegy sikeresen rögzítve',
        description: 'A bizonylat és tételei mentésre kerültek a rendszerben.',
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

  // 5. Delete Voucher Mutation
  const deleteVoucherMutation = useMutation({
    mutationFn: async (voucherId: string) => {
      const { error } = await supabase
        .from('purchase_vouchers')
        .delete()
        .eq('id', voucherId);
      if (error) throw error;
      return voucherId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-vouchers', companyId] });
      toast({
        title: 'Felvásárlási jegy törölve',
        description: 'A bizonylat sikeresen el lett távolítva.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Törlési hiba',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // 6. Toggle Payment Status Mutation
  const togglePaymentStatusMutation = useMutation({
    mutationFn: async ({
      voucherId,
      newStatus,
      amount,
    }: {
      voucherId: string;
      newStatus: 'unpaid' | 'paid';
      amount: number;
    }) => {
      const { error } = await supabase
        .from('purchase_vouchers')
        .update({
          payment_status: newStatus,
          paid_amount: newStatus === 'paid' ? amount : 0,
          paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', voucherId);

      if (error) throw error;
      return { voucherId, newStatus };
    },
    onSuccess: ({ newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-vouchers', companyId] });
      toast({
        title: newStatus === 'paid' ? 'Kifizetettnek jelölve' : 'Kifizetetlenre állítva',
        description: newStatus === 'paid' ? 'A bizonylat kifizetése rögzítve.' : 'A bizonylat visszaállítva nyitott státuszra.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a státusz módosításakor',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Filtered Vouchers
  const filteredVouchers = useMemo(() => {
    return filterVouchers(vouchers, { search, statusFilter });
  }, [vouchers, statusFilter, search]);

  // Live Summary calculation
  const summary: PurchaseVouchersSummary = useMemo(() => {
    return calculateVouchersSummary(vouchers);
  }, [vouchers]);

  return {
    vouchers: filteredVouchers,
    rawVouchers: vouchers,
    summary,
    isLoading,
    isFeatureEnabled,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    enableFeatureMutation,
    saveVoucherMutation,
    deleteVoucherMutation,
    togglePaymentStatusMutation,
    refetch,
    refetchSettings,
  };
}
