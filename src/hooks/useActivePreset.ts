import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';

export function useActivePreset(companyId: string | undefined) {
  const [activePresetId, setActivePresetIdState] = useState<string | undefined>(() => {
    const effectiveCompanyId = companyId || (() => {
      try {
        return localStorage.getItem('visibill_selected_company_id') || undefined;
      } catch {
        return undefined;
      }
    })();
    if (!effectiveCompanyId) return undefined;
    try {
      return localStorage.getItem(`visibill_active_preset_${effectiveCompanyId}`) || undefined;
    } catch {
      return undefined;
    }
  });

  const setActivePresetId = (id: string | undefined) => {
    setActivePresetIdState(id);
    const targetCompanyId = companyId || (() => {
      try {
        return localStorage.getItem('visibill_selected_company_id') || undefined;
      } catch {
        return undefined;
      }
    })();
    if (targetCompanyId && id) {
      try {
        localStorage.setItem(`visibill_active_preset_${targetCompanyId}`, id);
      } catch {}
    }
  };

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
      if (activePresetId && presets.some(p => p.id === activePresetId)) {
        return;
      }

      const activeCustom = presets.find(p => p.company_id === companyId && p.is_active);
      let targetId: string | undefined;
      if (activeCustom) {
        targetId = activeCustom.id;
      } else {
        const generic = presets.find(p => p.type === 'generic');
        if (generic) targetId = generic.id;
      }

      if (targetId) {
        setActivePresetId(targetId);
      }
    }
  }, [presets, companyId, activePresetId]);

  return { activePresetId, setActivePresetId, presets, isLoading };
}

