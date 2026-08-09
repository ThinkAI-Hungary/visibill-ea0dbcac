import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

export interface LaborDetailRow {
  id: string;
  user_id: string;
  employee_name: string;
  hours: number;
  hourly_rate: number | null;
  total_cost: number;
  date: string;
  description: string | null;
  status: string;
  has_rate: boolean;
}

export function useProjectLaborDetails(projectId: string | undefined) {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();

  const { data: laborDetails = [], isLoading, error } = useQuery({
    queryKey: ['project-labor-details', selectedCompany?.id, projectId],
    queryFn: async () => {
      if (!selectedCompany?.id || !projectId) return [] as LaborDetailRow[];

      // 1. Fetch time entries for this project
      const { data: timeEntries, error: teError } = await supabase
        .from('time_entries')
        .select('id, user_id, hours, description, date, status')
        .eq('project_id', projectId)
        .eq('company_id', selectedCompany.id)
        .in('status', ['submitted', 'approved'])
        .order('date', { ascending: false });

      if (teError) throw teError;
      if (!timeEntries || timeEntries.length === 0) return [] as LaborDetailRow[];

      // 2. Fetch employee rates to get hourly rate and employee name
      const { data: employeeRates, error: erError } = await supabase
        .from('employee_rates')
        .select('user_id, employee_name, hourly_rate')
        .eq('company_id', selectedCompany.id);

      if (erError) throw erError;

      // 3. Fetch profiles as fallback for names
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('user_id, name');

      if (pError) throw pError;

      // Create maps for fast lookup
      const ratesMap = new Map<string, { name: string; rate: number | null }>();
      (employeeRates || []).forEach(r => {
        if (r.user_id) {
          ratesMap.set(r.user_id, { name: r.employee_name, rate: r.hourly_rate ? Number(r.hourly_rate) : null });
        }
      });

      const profilesMap = new Map<string, string>();
      (profiles || []).forEach(p => {
        if (p.user_id && p.name) {
          profilesMap.set(p.user_id, p.name);
        }
      });

      // 4. Map time entries to unified labor details
      const details: LaborDetailRow[] = timeEntries.map(entry => {
        const matchingRate = ratesMap.get(entry.user_id);
        const fallbackName = profilesMap.get(entry.user_id) || 'Ismeretlen munkatárs';

        const employeeName = matchingRate?.name || fallbackName;
        const hourlyRate = matchingRate ? matchingRate.rate : null;
        const hasRate = hourlyRate !== null && hourlyRate > 0;
        
        const hoursVal = Number(entry.hours) || 0;
        const rateVal = hourlyRate || 0;
        const totalCost = hoursVal * rateVal;

        return {
          id: entry.id,
          user_id: entry.user_id,
          employee_name: employeeName,
          hours: hoursVal,
          hourly_rate: hourlyRate,
          total_cost: totalCost,
          date: entry.date,
          description: entry.description,
          status: entry.status,
          has_rate: hasRate,
        };
      });

      return details;
    },
    enabled: !!user && !!selectedCompany?.id && !!projectId,
  });

  return { laborDetails, isLoading, error };
}
