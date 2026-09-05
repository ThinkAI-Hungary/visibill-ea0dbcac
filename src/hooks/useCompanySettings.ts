import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { CompanyWorkSettings } from '@/lib/payrollUtils';
import type { Database } from '@/integrations/supabase/types';

type CompanySettingsInsert = Database['public']['Tables']['company_settings']['Insert'];

const DEFAULT_SETTINGS: Omit<CompanyWorkSettings, 'id' | 'company_id' | 'created_at' | 'updated_at'> = {
  work_start_time: '09:00',
  work_end_time: '17:00',
  admin_deadline: '20:00',
  monthly_working_hours: 168,
  gl_date_basis: 'kibocsatas',
};

export function useCompanySettings() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: queryKeys.companySettings(selectedCompany?.id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', selectedCompany!.id)
        .maybeSingle();

      if (error) throw error;
      return data as CompanyWorkSettings | null;
    },
    enabled: !!user && !!selectedCompany?.id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.companySettings(selectedCompany?.id || ''),
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (form: {
      work_start_time?: string;
      work_end_time?: string;
      admin_deadline?: string;
      monthly_working_hours?: number;
      gl_date_basis?: 'kibocsatas' | 'teljesites';
    }) => {
      if (!user || !selectedCompany) throw new Error('No user/company');

      const payload: CompanySettingsInsert = {
        company_id: selectedCompany.id,
        updated_at: new Date().toISOString(),
      };

      if (form.work_start_time !== undefined) payload.work_start_time = form.work_start_time;
      if (form.work_end_time !== undefined) payload.work_end_time = form.work_end_time;
      if (form.admin_deadline !== undefined) payload.admin_deadline = form.admin_deadline;
      if (form.monthly_working_hours !== undefined) payload.monthly_working_hours = form.monthly_working_hours;
      if (form.gl_date_basis !== undefined) payload.gl_date_basis = form.gl_date_basis;

      const { error } = await supabase
        .from('company_settings')
        .upsert(payload, { onConflict: 'company_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Siker', description: 'Beállítások mentve.' });
      invalidate();
    },
    onError: (err: Error) => {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: err.message || 'Nem sikerült menteni a beállításokat.',
      });
    },
  });

  // Effective settings (use saved or defaults)
  const effectiveSettings = useMemo(() => ({
    work_start_time: settings?.work_start_time ?? DEFAULT_SETTINGS.work_start_time,
    work_end_time: settings?.work_end_time ?? DEFAULT_SETTINGS.work_end_time,
    admin_deadline: settings?.admin_deadline ?? DEFAULT_SETTINGS.admin_deadline,
    monthly_working_hours: settings?.monthly_working_hours ?? DEFAULT_SETTINGS.monthly_working_hours,
    gl_date_basis: (settings?.gl_date_basis as 'kibocsatas' | 'teljesites') ?? DEFAULT_SETTINGS.gl_date_basis,
  }), [settings]);

  return {
    settings,
    effectiveSettings,
    isLoading,
    saveMutation,
    invalidate,
  };
}
