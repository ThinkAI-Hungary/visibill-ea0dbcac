import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

export interface SimpleProject {
  id: string;
  name: string;
  status: string | null;
  project_code?: string | null;
}

/**
 * Lightweight hook for project dropdowns (name + id + project_code).
 * Filters to active projects for the selected company.
 */
export function useProjectList() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: queryKeys.projectList(selectedCompany?.id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, project_code')
        .eq('company_id', selectedCompany!.id)
        .order('name', { ascending: true });

      if (error) throw error;
      return (data || []) as SimpleProject[];
    },
    enabled: !!user && !!selectedCompany?.id,
  });

  return { projects, isLoading };
}
