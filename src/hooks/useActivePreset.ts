import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';

export function useActivePreset(companyId: string | undefined) {
  const [activePresetId, setActivePresetId] = useState<string | undefined>(undefined);

  const { data: presets, isLoading } = useQuery({
    queryKey: ['coaPresets', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('chart_of_accounts_presets')
        .select('*');
        
      if (error) {
        reportError({ type: 'db_query', component: 'useActivePreset', action: 'error', message: 'Error loading presets:', error: error });
        return [];
      }
      
      const filteredData = (data || []).filter(
        p => p.company_id === companyId || p.type === 'generic'
      );
      
      return filteredData;
    },
    enabled: !!companyId
  });

  useEffect(() => {
    if (presets && presets.length > 0) {
      const activeCustom = presets.find(p => p.company_id === companyId && p.is_active);
      if (activeCustom) {
        setActivePresetId(activeCustom.id);
      } else {
        const generic = presets.find(p => p.type === 'generic');
        if (generic) setActivePresetId(generic.id);
      }
    }
  }, [presets, companyId]);

  return { activePresetId, setActivePresetId, presets, isLoading };
}
