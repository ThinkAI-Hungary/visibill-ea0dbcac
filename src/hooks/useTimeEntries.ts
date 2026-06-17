import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { TimeEntry } from '@/lib/payrollUtils';

interface UseTimeEntriesOptions {
  /** Single date filter */
  date?: string;
  /** Date range filter (inclusive) */
  dateFrom?: string;
  dateTo?: string;
  /** Fetch all company entries (for admin views) */
  all?: boolean;
}

export function useTimeEntries(options: UseTimeEntriesOptions = {}) {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const cacheKey = options.dateFrom && options.dateTo
    ? `${options.dateFrom}_${options.dateTo}_${options.all ? 'all' : 'self'}`
    : `${options.date || 'all'}_${options.all ? 'all' : 'self'}`;

  const { data: timeEntries = [], isLoading } = useQuery({
    queryKey: queryKeys.timeEntries(selectedCompany?.id || '', cacheKey),
    queryFn: async () => {
      let query = supabase
        .from('time_entries')
        .select('*')
        .eq('company_id', selectedCompany!.id)
        .order('date', { ascending: true });

      if (!options.all) {
        query = query.eq('user_id', user!.id);
      }

      if (options.date) {
        query = query.eq('date', options.date);
      } else if (options.dateFrom && options.dateTo) {
        query = query.gte('date', options.dateFrom).lte('date', options.dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as TimeEntry[];
    },
    enabled: !!user && !!selectedCompany?.id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ['timeEntries', selectedCompany?.id],
    });
  };

  const addMutation = useMutation({
    mutationFn: async (entry: {
      project_id?: string | null;
      date: string;
      hours: number;
      description?: string;
      absence_type?: string | null;
    }) => {
      if (!user || !selectedCompany) throw new Error('No user/company');

      const { error } = await supabase.from('time_entries').insert({
        company_id: selectedCompany.id,
        user_id: user.id,
        project_id: entry.project_id ?? null,
        date: entry.date,
        hours: entry.hours,
        description: entry.description ?? null,
        absence_type: entry.absence_type ?? null,
        status: 'draft',
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Siker', description: 'Munkaidő rögzítve.' });
      invalidate();
    },
    onError: (err: Error) => {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: err.message || 'Nem sikerült rögzíteni.',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: Partial<TimeEntry> & { id: string }) => {
      const { error } = await supabase
        .from('time_entries')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Siker', description: 'Bejegyzés frissítve.' });
      invalidate();
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: 'Nem sikerült frissíteni.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error, count } = await supabase
        .from('time_entries')
        .delete({ count: 'exact' })
        .eq('id', id);
      if (error) throw error;
      if (count === 0) throw new Error('A bejegyzés nem törölhető (jogosultság vagy nem létezik).');
    },
    onSuccess: () => {
      toast({ title: 'Törölve', description: 'Bejegyzés törölve.' });
      invalidate();
    },
    onError: (err: Error) => {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: err.message || 'Nem sikerült törölni.',
      });
    },
  });

  /** Submit all draft entries for a date range */
  const submitWeekMutation = useMutation({
    mutationFn: async ({
      dateFrom,
      dateTo,
    }: {
      dateFrom: string;
      dateTo: string;
    }) => {
      if (!user || !selectedCompany) throw new Error('No user/company');

      const { error } = await supabase
        .from('time_entries')
        .update({ status: 'submitted', updated_at: new Date().toISOString() })
        .eq('company_id', selectedCompany.id)
        .eq('user_id', user.id)
        .eq('status', 'draft')
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Hét leadva',
        description: 'A heti munkaidő bejegyzések leadásra kerültek.',
      });
      invalidate();
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: 'Nem sikerült leadni a hetet.',
      });
    },
  });

  return {
    timeEntries,
    isLoading,
    addMutation,
    updateMutation,
    deleteMutation,
    submitWeekMutation,
    invalidate,
  };
}
