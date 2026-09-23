import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';
import { useOptionalCompany } from '@/contexts/CompanyContext';

export function useActivePreset(companyId: string | undefined, overrideCountryCode?: string | null) {
  const companyContext = useOptionalCompany();
  const effectiveCountryCode = overrideCountryCode !== undefined
    ? overrideCountryCode
    : (companyContext?.selectedCompany?.id === companyId ? companyContext?.selectedCompany?.country_code : null);
  const isCroatia = (effectiveCountryCode || '').toUpperCase() === 'HR';

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
    queryKey: ['coaPresets', companyId, isCroatia],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('chart_of_accounts_presets')
        .select('*');
        
      if (error) {
        reportError({ type: 'db_query', component: 'useActivePreset', action: 'error', message: 'Error loading presets:', error: error });
        return [];
      }
      
      const filteredData = (data || []).filter(p => {
        // Company's own custom presets are always included
        if (p.company_id === companyId) return true;
        // For Croatian company, include HR built-in ('számla_hr' or country_code === 'HR')
        if (isCroatia) {
          return p.name === 'számla_hr' || (p as any).country_code === 'HR';
        }
        // For Hungarian / default company, include Hungarian generic built-in
        return p.type === 'generic' && (p as any).country_code !== 'HR' && p.name !== 'számla_hr';
      });
      
      return filteredData;
    },
    enabled: !!companyId
  });

  useEffect(() => {
    if (presets && presets.length > 0) {
      if (activePresetId && presets.some(p => p.id === activePresetId)) {
        // If this is a Croatian company, but active preset is the Hungarian generic preset, switch to HR default
        if (isCroatia && activePresetId === 'a6c46c77-52b7-499e-bb12-419aa94349af') {
          const hrPreset = presets.find(p => p.name === 'számla_hr' || (p as any).country_code === 'HR');
          if (hrPreset) {
            setActivePresetId(hrPreset.id);
            return;
          }
        }
        return;
      }

      const activeCustom = presets.find(p => p.company_id === companyId && p.is_active);
      let targetId: string | undefined;
      if (activeCustom) {
        targetId = activeCustom.id;
      } else {
        if (isCroatia) {
          const hrPreset = presets.find(p => p.name === 'számla_hr' || (p as any).country_code === 'HR');
          if (hrPreset) targetId = hrPreset.id;
        }
        if (!targetId) {
          const generic = presets.find(p => p.type === 'generic');
          if (generic) targetId = generic.id;
        }
      }

      if (targetId) {
        setActivePresetId(targetId);
      }
    }
  }, [presets, companyId, activePresetId, isCroatia]);

  return { activePresetId, setActivePresetId, presets, isLoading };
}

