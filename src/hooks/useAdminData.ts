/**
 * useAdminData.ts — Hooks for all Accounty admin modules
 * (Audit Log, GDPR, Templates, Job Codes, Global Tax Params, Legal Updates)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ══════════════════════════════════════════════
// 12.3 Audit Log
// ══════════════════════════════════════════════

interface AuditLogFilters {
  userId?: string;
  companyId?: string;
  eventType?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function useAuditLog(filters: AuditLogFilters = {}) {
  const page = filters.page || 0;
  const pageSize = filters.pageSize || 50;

  return useQuery({
    queryKey: ['accounty-audit-log', filters],
    queryFn: async () => {
      let query = supabase
        .from('accounty_audit_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (filters.userId) query = query.eq('user_id', filters.userId);
      if (filters.companyId) query = query.eq('company_id', filters.companyId);
      if (filters.eventType) query = query.eq('event_type', filters.eventType);
      if (filters.entityType) query = query.eq('entity_type', filters.entityType);
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as any[], count: count || 0 };
    },
  });
}


// ══════════════════════════════════════════════
// 12.4 GDPR Requests
// ══════════════════════════════════════════════

export function useGdprRequests() {
  return useQuery({
    queryKey: ['accounty-gdpr-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_gdpr_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateGdprRequest() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (req: { company_id: string; employee_id?: string; employee_name: string; request_type: string; notes?: string }) => {
      const { data, error } = await supabase
        .from('accounty_gdpr_requests')
        .insert(req as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounty-gdpr-requests'] });
      toast({ title: 'Kérelem létrehozva' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    },
  });
}

export function useUpdateGdprRequest() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; notes?: string; completed_at?: string; handled_by?: string }) => {
      const { error } = await supabase
        .from('accounty_gdpr_requests')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounty-gdpr-requests'] });
      toast({ title: 'Kérelem frissítve' });
    },
  });
}


// ══════════════════════════════════════════════
// 12.5 Templates
// ══════════════════════════════════════════════

export function useTemplates(category?: string) {
  return useQuery({
    queryKey: ['accounty-templates', category],
    queryFn: async () => {
      let query = supabase
        .from('accounty_templates')
        .select('*')
        .order('updated_at', { ascending: false });
      if (category) query = query.eq('category', category);
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (template: { id?: string; category: string; name: string; subject?: string; body_markdown: string; variables?: any[]; is_active?: boolean }) => {
      if (template.id) {
        // Save version history first
        const { data: existing } = await supabase
          .from('accounty_templates')
          .select('version, body_markdown, subject')
          .eq('id', template.id)
          .single();

        if (existing) {
          await supabase.from('accounty_template_versions').insert({
            template_id: template.id,
            version: (existing as any).version,
            body_markdown: (existing as any).body_markdown,
            subject: (existing as any).subject,
          });
        }

        const { error } = await supabase
          .from('accounty_templates')
          .update({
            ...template,
            version: ((existing as any)?.version || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('accounty_templates')
          .insert(template as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounty-templates'] });
      toast({ title: 'Sablon mentve' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    },
  });
}

export function useTemplateVersions(templateId?: string) {
  return useQuery({
    queryKey: ['accounty-template-versions', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await supabase
        .from('accounty_template_versions')
        .select('*')
        .eq('template_id', templateId)
        .order('version', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!templateId,
  });
}


// ══════════════════════════════════════════════
// 12.6 Job Codes
// ══════════════════════════════════════════════

export function useJobCodes(activeOnly = false) {
  return useQuery({
    queryKey: ['accounty-job-codes', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('accounty_job_codes')
        .select('*')
        .order('code', { ascending: true });
      if (activeOnly) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useUpsertJobCode() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (code: { id?: string; code: string; name: string; is_insured: boolean; min_contribution_base_rule?: string; is_active: boolean; valid_from?: string; valid_to?: string; notes?: string }) => {
      if (code.id) {
        const { error } = await supabase
          .from('accounty_job_codes')
          .update({ ...code, updated_at: new Date().toISOString() })
          .eq('id', code.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('accounty_job_codes')
          .insert(code as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounty-job-codes'] });
      toast({ title: 'Jogviszonykód mentve' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    },
  });
}


// ══════════════════════════════════════════════
// 12.7 Global Tax Parameters
// ══════════════════════════════════════════════

export function useGlobalTaxParams(year: number) {
  return useQuery({
    queryKey: ['accounty-global-tax-params', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_tax_params_global')
        .select('*')
        .eq('year', year)
        .order('key', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useUpdateGlobalTaxParam() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, value, legal_reference }: { id: string; value: number; legal_reference?: string }) => {
      const { error } = await supabase
        .from('accounty_tax_params_global')
        .update({ value, legal_reference, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounty-global-tax-params'] });
      toast({ title: 'Paraméter mentve' });
    },
  });
}

export function useDuplicateTaxYear() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ fromYear, toYear }: { fromYear: number; toYear: number }) => {
      const { data: existing } = await supabase
        .from('accounty_tax_params_global')
        .select('key, value, legal_reference')
        .eq('year', fromYear);

      if (!existing?.length) throw new Error('Nincs adat a forrásévben');

      const newParams = (existing as any[]).map(p => ({
        year: toYear,
        key: p.key,
        value: p.value,
        legal_reference: p.legal_reference,
        valid_from: `${toYear}-01-01`,
      }));

      const { error } = await supabase
        .from('accounty_tax_params_global')
        .upsert(newParams as any, { onConflict: 'year,key' });
      if (error) throw error;
    },
    onSuccess: (_, { toYear }) => {
      qc.invalidateQueries({ queryKey: ['accounty-global-tax-params'] });
      toast({ title: `${toYear}-es paraméterek előkészítve` });
    },
  });
}


// ══════════════════════════════════════════════
// 12.8 Legal Updates
// ══════════════════════════════════════════════

export function useLegalUpdates() {
  return useQuery({
    queryKey: ['accounty-legal-updates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_legal_updates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useAddLegalUpdate() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (update: { title: string; source: string; published_at?: string; affected_modules?: string[]; implementation_status?: string; notes?: string }) => {
      const { error } = await supabase
        .from('accounty_legal_updates')
        .insert(update as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounty-legal-updates'] });
      toast({ title: 'Jogszabály-frissítés hozzáadva' });
    },
  });
}

export function useUpdateLegalUpdate() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; implementation_status?: string; notes?: string; title?: string }) => {
      const { error } = await supabase
        .from('accounty_legal_updates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounty-legal-updates'] });
    },
  });
}


// ══════════════════════════════════════════════
// TAO Yearly Data
// ══════════════════════════════════════════════

export function useTaoYearly(companyId?: string, taxYear?: number) {
  return useQuery({
    queryKey: ['accounty-tao-yearly', companyId, taxYear],
    queryFn: async () => {
      if (!companyId || !taxYear) return null;
      const { data, error } = await supabase
        .from('accounty_tao_yearly')
        .select('*')
        .eq('company_id', companyId)
        .eq('tax_year', taxYear)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!companyId && !!taxYear,
  });
}

export function useSaveTaoYearly() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (record: {
      company_id: string;
      tax_year: number;
      current_step?: number;
      status?: string;
      [key: string]: any;
    }) => {
      // Upsert by company_id + tax_year
      const { data, error } = await supabase
        .from('accounty_tao_yearly')
        .upsert(
          { ...record, updated_at: new Date().toISOString() } as any,
          { onConflict: 'company_id,tax_year' }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['accounty-tao-yearly', vars.company_id, vars.tax_year] });
      toast({ title: 'TAO adatok mentve' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Mentési hiba', description: err.message });
    },
  });
}
