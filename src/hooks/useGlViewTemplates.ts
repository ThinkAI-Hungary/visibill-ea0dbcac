import { useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useToast } from '@/hooks/use-toast';
import type { GlViewTemplate, GlTemplateColumn } from '@/types/glTemplate';

export const BUILTIN_TEMPLATES_FALLBACK: GlViewTemplate[] = [
  {
    id: 'standard_3col',
    name: 'Standard Összesített (3 oszlop)',
    template_type: 'builtin',
    description: 'Egyszerűsített, áttekinthető összesített főkönyvi egyenleglista.',
    columns: [
      { id: 'gl_number', key: 'gl_number', label: 'Fők. szám', width: '120px', align: 'center', field: 'id', required: true },
      { id: 'name', key: 'name', label: 'Megnevezés', width: '1fr', align: 'left', field: 'name', required: true },
      { id: 'balance', key: 'balance', label: 'Összesített Egyenleg', width: '220px', align: 'right', field: 'balance', format: 'currency', required: true }
    ]
  },
  {
    id: 'classic_6col',
    name: 'Klasszikus Forgalmi és Egyenleg (6 oszlop)',
    template_type: 'builtin',
    description: 'Hagyományos magyar számviteli kétoldalas forgalmi és egyenleg kimutatás (Tartozik / Követel bontásban).',
    columns: [
      { id: 'gl_number', key: 'gl_number', label: 'Fők. szám', width: '90px', align: 'center', field: 'id', required: true },
      { id: 'name', key: 'name', label: 'Megnevezés', width: '1fr', align: 'left', field: 'name', required: true },
      { id: 'turnover_debit', key: 'turnover_debit', label: 'Forgalom T', width: '165px', align: 'right', field: 'debitTurnover', format: 'currency' },
      { id: 'turnover_credit', key: 'turnover_credit', label: 'Forgalom K', width: '165px', align: 'right', field: 'creditTurnover', format: 'currency' },
      { id: 'balance_debit', key: 'balance_debit', label: 'Egyenleg T', width: '165px', align: 'right', field: 'balanceDebit', format: 'currency' },
      { id: 'balance_credit', key: 'balance_credit', label: 'Egyenleg K', width: '190px', align: 'right', field: 'balanceCredit', format: 'currency' }
    ]
  },
  {
    id: 'balance_4col',
    name: 'Kétoldalas Egyenleg Fókuszú (4 oszlop)',
    template_type: 'builtin',
    description: 'Forgalmak nélküli, kizárólag a záró egyenlegek Tartozik / Követel oszlopos kimutatása.',
    columns: [
      { id: 'gl_number', key: 'gl_number', label: 'Fők. szám', width: '110px', align: 'center', field: 'id', required: true },
      { id: 'name', key: 'name', label: 'Megnevezés', width: '1fr', align: 'left', field: 'name', required: true },
      { id: 'balance_debit', key: 'balance_debit', label: 'Tartozik Egyenleg', width: '200px', align: 'right', field: 'balanceDebit', format: 'currency' },
      { id: 'balance_credit', key: 'balance_credit', label: 'Követel Egyenleg', width: '200px', align: 'right', field: 'balanceCredit', format: 'currency' }
    ]
  },
  {
    id: 'analytic_8col',
    name: 'Részletező Analitikus (8 oszlop)',
    template_type: 'builtin',
    description: 'Mély analitikus nézet tételes partner, bizonylatszám és dátum adatokkal a forgalom és egyenleg mellett.',
    columns: [
      { id: 'gl_number', key: 'gl_number', label: 'Fők. szám', width: '90px', align: 'center', field: 'id', required: true },
      { id: 'name', key: 'name', label: 'Megnevezés', width: '1.2fr', align: 'left', field: 'name', required: true },
      { id: 'partner', key: 'partner', label: 'Partner', width: '180px', align: 'left', field: 'partner' },
      { id: 'invoice_number', key: 'invoice_number', label: 'Bizonylat', width: '150px', align: 'left', field: 'invoiceNumber' },
      { id: 'date', key: 'date', label: 'Dátum', width: '110px', align: 'center', field: 'date', format: 'date' },
      { id: 'turnover_debit', key: 'turnover_debit', label: 'Forgalom T', width: '150px', align: 'right', field: 'debitTurnover', format: 'currency' },
      { id: 'turnover_credit', key: 'turnover_credit', label: 'Forgalom K', width: '150px', align: 'right', field: 'creditTurnover', format: 'currency' },
      { id: 'balance', key: 'balance', label: 'Egyenleg', width: '170px', align: 'right', field: 'balance', format: 'currency' }
    ]
  },
  {
    id: 'agora_6col',
    name: '"A" főkönyvi kivonat nézet',
    template_type: 'builtin',
    description: 'Szla, Megnevezés, Forgalom T/K, Egyenleg T/K az "A" formátumú (Novitax/Agora) A4 szabványnak megfelelően.',
    columns: [
      { id: 'gl_number', key: 'gl_number', label: 'Szla.', width: '90px', align: 'center', field: 'id', required: true },
      { id: 'name', key: 'name', label: 'Megnevezés', width: '1fr', align: 'left', field: 'name', required: true },
      { id: 'turnover_debit', key: 'turnover_debit', label: 'Forgalom T', width: '160px', align: 'right', field: 'debitTurnover', format: 'currency' },
      { id: 'turnover_credit', key: 'turnover_credit', label: 'Forgalom K', width: '160px', align: 'right', field: 'creditTurnover', format: 'currency' },
      { id: 'balance_debit', key: 'balance_debit', label: 'Egyenleg T', width: '160px', align: 'right', field: 'balanceDebit', format: 'currency' },
      { id: 'balance_credit', key: 'balance_credit', label: 'Egyenleg K', width: '180px', align: 'right', field: 'balanceCredit', format: 'currency' }
    ]
  }
];

export const BUILTIN_GL_TEMPLATES = BUILTIN_TEMPLATES_FALLBACK;

export function useGlViewTemplates() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const { effectiveSettings, saveMutation } = useCompanySettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryKey = useMemo(() => ['glViewTemplates', companyId], [companyId]);

  const { data: dbTemplates, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('gl_view_templates' as any)
        .select('*');

      if (companyId) {
        query = query.or(`template_type.eq.builtin,company_id.eq.${companyId}`);
      } else {
        query = query.eq('template_type', 'builtin');
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Error fetching gl_view_templates, using fallback:', error);
        return BUILTIN_TEMPLATES_FALLBACK;
      }

      if (!data || data.length === 0) {
        return BUILTIN_TEMPLATES_FALLBACK;
      }

      const mapped: GlViewTemplate[] = (data as any[]).map((row) => {
        const builtinFallback = BUILTIN_TEMPLATES_FALLBACK.find((b) => b.id === row.id);
        return {
          id: row.id,
          company_id: row.company_id,
          accounting_firm_id: row.accounting_firm_id,
          name: row.template_type === 'builtin' && builtinFallback ? builtinFallback.name : row.name,
          template_type: row.template_type as 'builtin' | 'custom',
          description: row.template_type === 'builtin' && builtinFallback ? builtinFallback.description : row.description,
          columns: (row.columns || []) as GlTemplateColumn[],
          source_file_name: row.source_file_name,
          created_by: row.created_by,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });

      // Ensure all code-defined builtins (like agora_6col) are always available even if DB table lacks them
      const dbIds = new Set(mapped.map((m) => m.id));
      const missingBuiltins = BUILTIN_TEMPLATES_FALLBACK.filter((b) => !dbIds.has(b.id));
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

  const templates = dbTemplates || BUILTIN_TEMPLATES_FALLBACK;

  // Active template resolution
  const activeTemplateId = useMemo(() => {
    if (effectiveSettings?.active_gl_view_template_id) {
      return effectiveSettings.active_gl_view_template_id;
    }
    if (companyId) {
      try {
        const stored = localStorage.getItem(`visibill_gl_template_${companyId}`);
        if (stored) return stored;
      } catch (e) {}
    }
    return 'standard_3col';
  }, [effectiveSettings?.active_gl_view_template_id, companyId]);

  const activeTemplate = useMemo(() => {
    const found = templates.find((t) => t.id === activeTemplateId);
    if (found) return found;
    return templates.find((t) => t.id === 'standard_3col') || templates[0] || BUILTIN_TEMPLATES_FALLBACK[0];
  }, [templates, activeTemplateId]);

  // Apply template mutation
  const applyTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      if (companyId) {
        try {
          localStorage.setItem(`visibill_gl_template_${companyId}`, templateId);
        } catch (e) {}
      }

      let rpcSuccess = false;
      if (companyId) {
        const { error: rpcErr } = await supabase.rpc('set_active_gl_view_template', {
          p_company_id: companyId,
          p_template_id: templateId,
        });
        if (!rpcErr) {
          rpcSuccess = true;
        } else {
          console.warn('RPC set_active_gl_view_template fallback to direct saveMutation:', rpcErr?.message);
        }
      }

      if (!rpcSuccess) {
        try {
          await saveMutation.mutateAsync({
            active_gl_view_template_id: templateId,
          });
        } catch (err: any) {
          // Non-admin company members/accountants without company_settings update permissions
          // still have their selection preserved in localStorage seamlessly.
          console.warn('Could not persist template to company_settings cloud table, preserved in localStorage:', err?.message);
        }
      }
    },
    onSuccess: (_, templateId) => {
      const applied = templates.find((t) => t.id === templateId);
      toast({
        title: 'Főkönyvi sablon alkalmazva',
        description: applied ? `A(z) „${applied.name}” mostantól a cég alapértelmezett nézete és export struktúrája.` : 'A nézetsablon sikeresen módosítva.',
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
        description: err.message || 'Nem sikerült elmenteni az aktív sablont.',
      });
    }
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (newTemplate: {
      name: string;
      description?: string;
      columns: GlTemplateColumn[];
      source_file_name?: string;
    }) => {
      if (!companyId) throw new Error('Nincs kiválasztva aktív cég.');

      const { data, error } = await supabase
        .from('gl_view_templates' as any)
        .insert({
          company_id: companyId,
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
        title: 'Egyedi sablon létrehozva',
        description: `A(z) „${data.name}” sablon sikeresen létrejött és beállításra került.`,
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Hiba a sablon mentésekor',
        description: err.message || 'Nem sikerült létrehozni az egyedi sablont.',
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
        .from('gl_view_templates' as any)
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      // If deleted template was active, fallback to standard_3col
      if (activeTemplateId === templateId) {
        await applyTemplateMutation.mutateAsync('standard_3col');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: 'Sablon törölve',
        description: 'Az egyedi sablon sikeresen eltávolításra került.',
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
    isLoading,
    isApplying: applyTemplateMutation.isPending,
    isCreating: createTemplateMutation.isPending,
    isDeleting: deleteTemplateMutation.isPending,
    applyTemplate,
    createTemplate: createTemplateMutation.mutateAsync,
    deleteTemplate: deleteTemplateMutation.mutateAsync,
  };
}
