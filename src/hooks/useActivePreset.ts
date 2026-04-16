import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useActivePreset(companyId: string | undefined) {
  const [activePresetId, setActivePresetId] = useState<string>('generic');

  const { data: presets, isLoading } = useQuery({
    queryKey: ['coaPresets', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('chart_of_accounts_presets')
        .select('*')
        .or(`company_id.eq.${companyId},type.eq.generic`);
      
      if (error) {
        console.error('Error loading presets:', error);
        return [];
      }
      return data || [];
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
