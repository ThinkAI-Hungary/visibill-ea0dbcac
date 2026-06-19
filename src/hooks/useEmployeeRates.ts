import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { EmployeeRate } from '@/lib/payrollUtils';

/** Normalize name for matching: trim, collapse whitespace, lowercase, remove accents */
function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function useEmployeeRates() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const { data: employeeRates = [], isLoading } = useQuery({
    queryKey: queryKeys.employeeRates(selectedCompany?.id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_rates')
        .select('*')
        .eq('company_id', selectedCompany!.id)
        .order('employee_name', { ascending: true });

      if (error) throw error;
      return (data || []) as EmployeeRate[];
    },
    enabled: !!user && !!selectedCompany?.id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.employeeRates(selectedCompany?.id || ''),
    });
  };

  const upsertMutation = useMutation({
    mutationFn: async (rate: {
      employee_name: string;
      employee_type?: 'employee' | 'contractor';
      base_salary_cost?: number | null;
      hourly_rate?: number | null;
      effective_date?: string;
      email?: string | null;
      phone?: string | null;
      user_id?: string | null;
    }): Promise<'created' | 'updated'> => {
      if (!user || !selectedCompany) throw new Error('No user/company');

      // Normalized name matching (accent-insensitive, whitespace-tolerant)
      const normalizedInput = normalizeName(rate.employee_name);
      const existing = employeeRates.find(
        (r) => normalizeName(r.employee_name) === normalizedInput
      );

      if (existing) {
        const updateData: Record<string, any> = {
          employee_type: rate.employee_type ?? existing.employee_type,
          base_salary_cost: rate.base_salary_cost ?? existing.base_salary_cost,
          hourly_rate: rate.hourly_rate ?? existing.hourly_rate,
          effective_date: rate.effective_date ?? existing.effective_date,
          email: rate.email !== undefined ? rate.email : existing.email,
          phone: rate.phone !== undefined ? rate.phone : existing.phone,
          updated_at: new Date().toISOString(),
        };
        // Link user_id if provided and not already set
        if (rate.user_id && !existing.user_id) {
          updateData.user_id = rate.user_id;
        }

        const { error } = await supabase
          .from('employee_rates')
          .update(updateData)
          .eq('id', existing.id);

        if (error) throw error;
        return 'updated';
      } else {
        const insertData: Record<string, any> = {
          company_id: selectedCompany.id,
          employee_name: rate.employee_name,
          employee_type: rate.employee_type ?? 'employee',
          base_salary_cost: rate.base_salary_cost ?? null,
          hourly_rate: rate.hourly_rate ?? null,
          effective_date: rate.effective_date ?? new Date().toISOString().slice(0, 10),
          email: rate.email ?? null,
          phone: rate.phone ?? null,
        };
        if (rate.user_id) {
          insertData.user_id = rate.user_id;
        }

        const { error } = await supabase
          .from('employee_rates')
          .insert(insertData);

        if (error) throw error;
        return 'created';
      }
    },

    onSuccess: (result) => {
      if (result === 'created') {
        toast({ title: 'Siker', description: 'Dolgozó sikeresen hozzáadva.' });
      } else {
        toast({ title: 'Siker', description: 'Dolgozó óradíja frissítve.' });
      }
      invalidate();
    },
    onError: (err: Error) => {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: err.message || 'Nem sikerült a műveletet végrehajtani.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('employee_rates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Törölve', description: 'Dolgozó óradíja törölve.' });
      invalidate();
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: 'Nem sikerült törölni.',
      });
    },
  });

  return {
    employeeRates,
    isLoading,
    upsertMutation,
    deleteMutation,
    invalidate,
  };
}
