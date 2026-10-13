import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useToast } from '@/hooks/use-toast';
import type { VatViewTemplate, VatTemplateColumn } from '@/types/vatTemplate';

export const BUILTIN_VAT_TEMPLATES_FALLBACK: VatViewTemplate[] = [
  {
    id: 'official_nav65_12col',
    name: 'Hivatalos NAV 65-ös Részletező (12 oszlop)',
    template_type: 'builtin',
    description: 'Hivatalos magyar adóhatósági 65-ös analitika teljes bizonylatszintű, partner és adókulcs adatokkal.',
    columns: [
      { id: 'entryNumber', key: 'entryNumber', label: 'Sorszám', width: '95px', align: 'center', field: 'entryNumber', required: true },
      { id: 'journalType', key: 'journalType', label: 'Napló', width: '85px', align: 'center', field: 'journalType' },
      { id: 'vatDueDate', key: 'vatDueDate', label: 'ÁFA esedékesség', width: '115px', align: 'center', field: 'vatDueDate', format: 'date', required: true },
      { id: 'invoiceNumber', key: 'invoiceNumber', label: 'Bizonylatszám', width: '140px', align: 'left', field: 'invoiceNumber', required: true },
      { id: 'partnerCode', key: 'partnerCode', label: 'Adószám', width: '100px', align: 'center', field: 'partnerCode' },
      { id: 'partnerName', key: 'partnerName', label: 'Partner neve', width: '1.2fr', align: 'left', field: 'partnerName', required: true },
      { id: 'description', key: 'description', label: 'Megjegyzés', width: '180px', align: 'left', field: 'description' },
      { id: 'vatRateLabel', key: 'vatRateLabel', label: 'ÁFA kulcs', width: '90px', align: 'center', field: 'vatRateLabel' },
      { id: 'netAmount', key: 'netAmount', label: 'Nettó összeg', width: '130px', align: 'right', field: 'netAmount', format: 'currency', required: true },
      { id: 'vatAmount', key: 'vatAmount', label: 'ÁFA összeg', width: '130px', align: 'right', field: 'vatAmount', format: 'currency', required: true },
      { id: 'grossAmount', key: 'grossAmount', label: 'Bruttó összeg', width: '140px', align: 'right', field: 'grossAmount', format: 'currency', required: true },
      { id: 'returnRowCode', key: 'returnRowCode', label: 'Bev. sor', width: '85px', align: 'center', field: 'returnRowCode' },
    ]
  },
  {
    id: 'simplified_financial_7col',
    name: 'Egyszerűsített Pénzügyi (7 oszlop)',
    template_type: 'builtin',
    description: 'Letisztult gyorsellenőrző nézet a legfontosabb bizonylat-, partner- és ÁFA összegadatokkal.',
    columns: [
      { id: 'invoiceNumber', key: 'invoiceNumber', label: 'Bizonylatszám', width: '160px', align: 'left', field: 'invoiceNumber', required: true },
      { id: 'partnerName', key: 'partnerName', label: 'Partner neve', width: '1.4fr', align: 'left', field: 'partnerName', required: true },
      { id: 'vatDueDate', key: 'vatDueDate', label: 'Teljesítés dátuma', width: '120px', align: 'center', field: 'vatDueDate', format: 'date', required: true },
      { id: 'netAmount', key: 'netAmount', label: 'Nettó összeg', width: '160px', align: 'right', field: 'netAmount', format: 'currency', required: true },
      { id: 'vatAmount', key: 'vatAmount', label: 'ÁFA összeg', width: '160px', align: 'right', field: 'vatAmount', format: 'currency', required: true },
      { id: 'grossAmount', key: 'grossAmount', label: 'Bruttó összeg', width: '170px', align: 'right', field: 'grossAmount', format: 'currency', required: true },
      { id: 'returnRowCode', key: 'returnRowCode', label: 'Bev. sor', width: '95px', align: 'center', field: 'returnRowCode' },
    ]
  },
  {
    id: 'two_sided_payable_deductible_8col',
    name: 'Fizetendő & Levonható Kétoldalas (8 oszlop)',
    template_type: 'builtin',
    description: 'Kétoldalú ÁFA pozíció vizsgálat: külön fizetendő és levonható adóalap és ÁFA bontásban.',
    columns: [
      { id: 'invoiceNumber', key: 'invoiceNumber', label: 'Bizonylatszám', width: '140px', align: 'left', field: 'invoiceNumber', required: true },
      { id: 'partnerName', key: 'partnerName', label: 'Partner neve', width: '1.2fr', align: 'left', field: 'partnerName', required: true },
      { id: 'vatDueDate', key: 'vatDueDate', label: 'Dátum', width: '105px', align: 'center', field: 'vatDueDate', format: 'date' },
      { id: 'payableNetAmount', key: 'payableNetAmount', label: 'Fizetendő nettó', width: '140px', align: 'right', field: 'payableNetAmount', format: 'currency' },
      { id: 'payableVatAmount', key: 'payableVatAmount', label: 'Fizetendő ÁFA', width: '140px', align: 'right', field: 'payableVatAmount', format: 'currency' },
      { id: 'deductibleNetAmount', key: 'deductibleNetAmount', label: 'Levonható nettó', width: '140px', align: 'right', field: 'deductibleNetAmount', format: 'currency' },
      { id: 'deductibleVatAmount', key: 'deductibleVatAmount', label: 'Levonható ÁFA', width: '140px', align: 'right', field: 'deductibleVatAmount', format: 'currency' },
      { id: 'netVatPosition', key: 'netVatPosition', label: 'Nettó pozíció', width: '150px', align: 'right', field: 'netVatPosition', format: 'currency' },
    ]
  },
  {
    id: 'gl_accounting_fad_10col',
    name: 'Számviteli Kontírozás & FAD (10 oszlop)',
    template_type: 'builtin',
    description: 'Főkönyvi ellenszámlákkal (911/529, 466/467, 311/454) és Fordított ÁFA (FAD) adatokkal kiegészített analitika.',
    columns: [
      { id: 'entryNumber', key: 'entryNumber', label: 'Sorszám', width: '95px', align: 'center', field: 'entryNumber' },
      { id: 'invoiceNumber', key: 'invoiceNumber', label: 'Bizonylatszám', width: '140px', align: 'left', field: 'invoiceNumber', required: true },
      { id: 'partnerName', key: 'partnerName', label: 'Partner neve', width: '1.2fr', align: 'left', field: 'partnerName', required: true },
      { id: 'description', key: 'description', label: 'FAD / Ügylet jelleg', width: '160px', align: 'left', field: 'description' },
      { id: 'netAmount', key: 'netAmount', label: 'Nettó', width: '130px', align: 'right', field: 'netAmount', format: 'currency' },
      { id: 'netGlAccount', key: 'netGlAccount', label: 'Nettó fsz.', width: '90px', align: 'center', field: 'netGlAccount' },
      { id: 'vatAmount', key: 'vatAmount', label: 'ÁFA', width: '130px', align: 'right', field: 'vatAmount', format: 'currency' },
      { id: 'vatGlAccount', key: 'vatGlAccount', label: 'ÁFA fsz.', width: '110px', align: 'center', field: 'vatGlAccount' },
      { id: 'grossGlAccount', key: 'grossGlAccount', label: 'Bruttó fsz.', width: '100px', align: 'center', field: 'grossGlAccount' },
      { id: 'returnRowCode', key: 'returnRowCode', label: 'Bev. sor', width: '90px', align: 'center', field: 'returnRowCode' },
    ]
  }
];

export const BUILTIN_VAT_TEMPLATES = BUILTIN_VAT_TEMPLATES_FALLBACK;

export function useVatViewTemplates() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { effectiveSettings, saveMutation } = useCompanySettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: accountingFirmId } = useQuery({
    queryKey: ['companyAccountingFirmId', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase
        .from('accounty_assignments')
        .select('accounting_firm_id')
        .eq('company_id', companyId)
        .limit(1)
        .maybeSingle();
      return data?.accounting_firm_id || null;
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
  });

  const queryKey = useMemo(() => ['vatViewTemplates', companyId, accountingFirmId], [companyId, accountingFirmId]);

  const { data: dbTemplates, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('vat_view_templates' as any)
        .select('*');

      if (companyId && accountingFirmId) {
        query = query.or(`template_type.eq.builtin,company_id.eq.${companyId},accounting_firm_id.eq.${accountingFirmId}`);
      } else if (companyId) {
        query = query.or(`template_type.eq.builtin,company_id.eq.${companyId}`);
      } else {
        query = query.eq('template_type', 'builtin');
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching vat_view_templates, using fallback:', error);
        return BUILTIN_VAT_TEMPLATES_FALLBACK;
      }

      if (!data || data.length === 0) {
        return BUILTIN_VAT_TEMPLATES_FALLBACK;
      }

      const mapped: VatViewTemplate[] = (data as any[]).map((row) => ({
        id: row.id,
        company_id: row.company_id,
        accounting_firm_id: row.accounting_firm_id,
        name: row.name,
        template_type: row.template_type as 'builtin' | 'custom',
        description: row.description,
        columns: (row.columns || []) as VatTemplateColumn[],
        source_file_name: row.source_file_name,
        created_by: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));

      // Ensure all code-defined builtins are always available even if DB table lacks them
      const dbIds = new Set(mapped.map((m) => m.id));
      const missingBuiltins = BUILTIN_VAT_TEMPLATES_FALLBACK.filter((b) => !dbIds.has(b.id));
      const combined = [...mapped, ...missingBuiltins];

      // Sort: builtins first, then custom sorted by created_at desc
      return combined.sort((a, b) => {
        if (a.template_type === 'builtin' && b.template_type !== 'builtin') return -1;
        if (a.template_type !== 'builtin' && b.template_type === 'builtin') return 1;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });
    },
    staleTime: 60_000,
  });

  const templates = dbTemplates || BUILTIN_VAT_TEMPLATES_FALLBACK;

  // Active template resolution
  const activeTemplateId = useMemo(() => {
    if (effectiveSettings?.active_vat_view_template_id) {
      return effectiveSettings.active_vat_view_template_id;
    }
    if (companyId) {
      try {
        const stored = localStorage.getItem(`visibill_vat_template_${companyId}`);
        if (stored) return stored;
      } catch (e) {}
    }
    return 'official_nav65_12col';
  }, [effectiveSettings?.active_vat_view_template_id, companyId]);

  const activeTemplate = useMemo(() => {
    const found = templates.find((t) => t.id === activeTemplateId);
    if (found) return found;
    return templates.find((t) => t.id === 'official_nav65_12col') || templates[0] || BUILTIN_VAT_TEMPLATES_FALLBACK[0];
  }, [templates, activeTemplateId]);

  // Apply template mutation
  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (companyId) {
        try {
          localStorage.setItem(`visibill_vat_template_${companyId}`, templateId);
        } catch (e) {}
      }

      let rpcSuccess = false;
      if (companyId) {
        const { error: rpcErr } = await supabase.rpc('set_active_vat_view_template', {
          p_company_id: companyId,
          p_template_id: templateId,
        });
        if (!rpcErr) {
          rpcSuccess = true;
        } else {
          console.warn('RPC set_active_vat_view_template fallback to direct saveMutation:', rpcErr?.message);
        }
      }

      if (!rpcSuccess) {
        try {
          await saveMutation.mutateAsync({
            active_vat_view_template_id: templateId,
          });
        } catch (err: any) {
          console.warn('Could not persist VAT template to company_settings cloud table, preserved in localStorage:', err?.message);
        }
      }
    },
    onSuccess: (_, templateId) => {
      const applied = templates.find((t) => t.id === templateId);
      toast({
        title: 'ÁFA analitika sablon alkalmazva',
        description: applied ? `A(z) „${applied.name}” mostantól a cég alapértelmezett ÁFA nézete és export struktúrája.` : 'A nézetsablon sikeresen módosítva.',
      });
      queryClient.invalidateQueries({ queryKey });
      if (companyId) {
        queryClient.invalidateQueries({ queryKey: ['companySettings', companyId] });
      }
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Hiba a sablon beállításakor',
        description: err.message || 'Nem sikerült elmenteni az aktív ÁFA sablont.',
      });
    }
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (newTemplate: {
      name: string;
      description?: string;
      columns: VatTemplateColumn[];
      source_file_name?: string;
      shareWithFirm?: boolean;
    }) => {
      if (!companyId) throw new Error('Nincs kiválasztva aktív cég.');

      const firmIdToUse = newTemplate.shareWithFirm ? (accountingFirmId || null) : null;

      const { data, error } = await supabase
        .from('vat_view_templates' as any)
        .insert({
          company_id: companyId,
          accounting_firm_id: firmIdToUse,
          name: newTemplate.name,
          template_type: 'custom',
          description: newTemplate.description || `Egyedi mintafájlból létrehozva (${newTemplate.source_file_name || 'fájl'})`,
          columns: newTemplate.columns,
          source_file_name: newTemplate.source_file_name || null,
        })
        .select()
        .single();

      if (error) throw error;
      const createdId = (data as any).id;

      // Automatically apply the newly created template
      await applyTemplateMutation.mutateAsync(createdId);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'Egyedi ÁFA sablon létrehozva',
        description: `A(z) „${data.name}” sablon sikeresen létrejött és beállításra került.`,
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Hiba a sablon mentésekor',
        description: err.message || 'Nem sikerült létrehozni az egyedi ÁFA sablont.',
      });
    }
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const target = templates.find((t) => t.id === templateId);
      if (target?.template_type === 'builtin') {
        throw new Error('A beépített rendszerszintű sablonok nem törölhetőek.');
      }

      const { error } = await supabase
        .from('vat_view_templates' as any)
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      // If deleted template was active, fallback to official_nav65_12col
      if (activeTemplateId === templateId) {
        await applyTemplateMutation.mutateAsync('official_nav65_12col');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'Sablon törölve',
        description: 'Az egyedi ÁFA sablon sikeresen eltávolításra került.',
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Hiba a sablon törlésekor',
        description: err.message || 'Nem sikerült törölni a sablont.',
      });
    }
  });

  const applyTemplate = useCallback((id: string) => applyTemplateMutation.mutateAsync(id), [applyTemplateMutation]);

  return {
    templates,
    activeTemplateId,
    activeTemplate,
    accountingFirmId,
    canShareWithFirm: !!accountingFirmId,
    isLoading,
    isApplying: applyTemplateMutation.isPending,
    isCreating: createTemplateMutation.isPending,
    isDeleting: deleteTemplateMutation.isPending,
    applyTemplate,
    createTemplate: createTemplateMutation.mutateAsync,
    deleteTemplate: deleteTemplateMutation.mutateAsync,
  };
}
