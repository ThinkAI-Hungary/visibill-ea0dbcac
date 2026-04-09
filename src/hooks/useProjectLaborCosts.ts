import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

interface ProjectLaborCost {
  project_id: string;
  company_id: string;
  project_name: string;
  total_hours: number;
  total_labor_cost: number;
}

export function useProjectLaborCosts() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();

  const { data: laborCosts = [], isLoading } = useQuery({
    queryKey: queryKeys.projectLaborCosts(selectedCompany?.id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_labor_costs')
        .select('*')
        .eq('company_id', selectedCompany!.id);

      if (error) throw error;
      return (data || []) as ProjectLaborCost[];
    },
    enabled: !!user && !!selectedCompany?.id,
  });

  const getLaborCost = (projectId: string): ProjectLaborCost | undefined => {
    return laborCosts.find((lc) => lc.project_id === projectId);
  };

  return {
    laborCosts,
    isLoading,
    getLaborCost,
  };
}
