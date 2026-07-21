import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_2025_PARAMS, DEFAULT_2026_PARAMS, type EvTaxParams } from '@/lib/evCalculations';

export function useEvTaxParams(year: number = 2026) {
  return useQuery({
    queryKey: ['ev-tax-parameters', year],
    queryFn: async (): Promise<EvTaxParams> => {
      const { data, error } = await supabase
        .from('accounty_tax_parameters')
        .select('parameter_key, parameter_value')
        .eq('tax_year', year);

      if (error) {
        console.error('Failed to fetch EV tax parameters, using fallback:', error);
        return year === 2025 ? DEFAULT_2025_PARAMS : DEFAULT_2026_PARAMS;
      }

      if (!data || data.length === 0) {
        return year === 2025 ? DEFAULT_2025_PARAMS : DEFAULT_2026_PARAMS;
      }

      // Map rows to parameter map
      const paramMap: Record<string, number> = {};
      data.forEach((row) => {
        paramMap[row.parameter_key] = Number(row.parameter_value);
      });

      const fallback = year === 2025 ? DEFAULT_2025_PARAMS : DEFAULT_2026_PARAMS;

      // Map DB keys to EvTaxParams structure with camelCase
      const szjaRate = paramMap['szja_rate'] ?? fallback.szjaRate;
      const vszjaRate = paramMap['vszja_rate'] ?? fallback.vszjaRate;
      
      const atalanyKoltseghanyadGeneral = paramMap['atalany_koltseghanyad_general'] ?? fallback.atalanyKoltseghanyadGeneral;
      const atalanyKoltseghanyadHigh = paramMap['atalany_koltseghanyad_high'] ?? fallback.atalanyKoltseghanyadHigh;
      const atalanyKoltseghanyadRetail = paramMap['atalany_koltseghanyad_retail'] ?? fallback.atalanyKoltseghanyadRetail;
      const atalanyBevetelHatar = paramMap['atalany_bevetel_hatar'] ?? fallback.atalanyBevetelHatar;
      const atalanyKiskerHatar = paramMap['atalany_kisker_hatar'] ?? fallback.atalanyKiskerHatar;
      const atalanyAdomentesResz = paramMap['atalany_adomentes_resz'] ?? fallback.atalanyAdomentesResz;

      const kataHaviTetel = paramMap['kata_havi_tetel'] ?? fallback.kataHaviTetel;
      const kataEvesKeret = paramMap['kata_eves_keret'] ?? fallback.kataEvesKeret;
      const kataKulonadoKulcs = paramMap['kata_kulonado_kulcs'] ?? fallback.kataKulonadoKulcs;

      const tbJarulekKulcs = paramMap['tb_rate'] ?? paramMap['tb_jarulek_kulcs'] ?? fallback.tbJarulekKulcs;
      const szochoKulcs = paramMap['szocho_rate'] ?? paramMap['szocho_kulcs'] ?? fallback.szochoKulcs;
      const minimalber = paramMap['minimum_wage'] ?? paramMap['minimalber'] ?? fallback.minimalber;
      const garantaltBerminimum = paramMap['guaranteed_minimum'] ?? paramMap['garantalt_berminimum'] ?? fallback.garantaltBerminimum;

      const afaAlanyiHatar = paramMap['afa_alanyi_hatar'] ?? fallback.afaAlanyiHatar;

      const hipaSav12m = paramMap['hipa_sav_12m'] ?? fallback.hipaSav12m;
      const hipaSav18m = paramMap['hipa_sav_18m'] ?? fallback.hipaSav18m;
      const hipaSav25m = paramMap['hipa_sav_25m'] ?? fallback.hipaSav25m;

      const kamaraiHozzajarulas = paramMap['chamber_contribution'] ?? paramMap['kamarai_hozzajarulas'] ?? fallback.kamaraiHozzajarulas;

      return {
        taxYear: year,
        szjaRate,
        vszjaRate,
        atalanyKoltseghanyadGeneral,
        atalanyKoltseghanyadHigh,
        atalanyKoltseghanyadRetail,
        atalanyBevetelHatar,
        atalanyKiskerHatar,
        atalanyAdomentesResz,
        kataHaviTetel,
        kataEvesKeret,
        kataKulonadoKulcs,
        tbJarulekKulcs,
        szochoKulcs,
        minimalber,
        garantaltBerminimum,
        afaAlanyiHatar,
        hipaSav12m,
        hipaSav18m,
        hipaSav25m,
        kamaraiHozzajarulas,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}
