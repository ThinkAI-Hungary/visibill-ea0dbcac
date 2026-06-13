import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Settings, BookOpen, Calculator,
  Edit3, Check, X, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTaxParameters, useUpdateTaxParameter } from '@/hooks/usePayrollData';
import { useToast } from '@/hooks/use-toast';

// ── Parameter categories ──
const CATEGORIES: Record<string, { label: string; icon: React.ElementType; keys: string[] }> = {
  tax_rates: {
    label: 'Adókulcsok és járulékok',
    icon: Calculator,
    keys: ['szja_rate', 'tb_rate', 'szocho_rate', 'szocho_kedv_rate', 'eho_rate'],
  },
  wages: {
    label: 'Minimálbér és bérminimum',
    icon: Settings,
    keys: ['minimum_wage', 'guaranteed_minimum', 'minimum_wage_annual', 'min_wage_hourly', 'guaranteed_minimum_hourly'],
  },
  family: {
    label: 'Családi kedvezmény',
    icon: BookOpen,
    keys: ['family_1_child', 'family_1_child_saving', 'family_2_children', 'family_2_children_saving', 'family_3plus_children', 'family_3plus_children_saving', 'family_disabled_extra'],
  },
  credits: {
    label: 'Adókedvezmények és mentességek',
    icon: BookOpen,
    keys: [
      'young_25_cap', 'young_25_annual_cap', 'young_mothers_cap',
      'personal_disability', 'personal_disability_saving',
      'first_marriage', 'first_marriage_saving', 'first_marriage_months',
      'health_service_monthly', 'health_service_daily',
    ],
  },
  szocho_discounts: {
    label: 'SZOCHO kedvezmények',
    icon: Calculator,
    keys: [
      'szocho_kedv_rate', 'szocho_kutatoi_pct', 'szocho_career_starter_max',
      'szocho_phd_rate', 'szocho_capital_cap',
    ],
  },
  thresholds: {
    label: 'SZÉP kártya és cafeteria',
    icon: Settings,
    keys: [
      'szep_recreation_annual', 'szep_active_annual', 'szep_total_annual_max',
      'szep_fringe_tax_rate', 'specified_benefit_tax_rate',
      'szep_card_accommodation_limit', 'szep_card_food_limit',
      'szep_card_leisure_limit', 'cafeteria_recreation_limit',
      'szep_card_tax_rate', 'cafeteria_excess_tax_rate',
    ],
  },
  housing: {
    label: 'Lakhatás és ajándék',
    icon: BookOpen,
    keys: [
      'housing_support_monthly', 'housing_support_annual', 'housing_support_tax_rate',
      'small_gift_per_occasion', 'small_gift_max_occasions',
    ],
  },
  efo: {
    label: 'EFO (Egyszerűsített foglalkoztatás)',
    icon: Calculator,
    keys: [
      'efo_daily_tax', 'efo_min_hourly_unskilled', 'efo_min_hourly_skilled',
      'efo_max_daily_wage', 'efo_exempt_daily_unskilled', 'efo_exempt_daily_skilled',
      'efo_max_days_same_parties',
      'efo_mezo_sav1_days', 'efo_mezo_sav1_rate', 'efo_mezo_sav2_rate', 'efo_mezo_max_days',
      'efo_film_daily_tax', 'efo_film_max_daily_wage',
    ],
  },
  work_rules: {
    label: 'Munkajogi paraméterek',
    icon: Settings,
    keys: [
      'remote_work_allowance', 'commuting_per_km', 'commuting_monthly_max',
      'overtime_annual_limit_mt', 'overtime_annual_limit_ksz',
      'sick_leave_days', 'sick_leave_pct',
    ],
  },
  rehab: {
    label: 'Rehabilitáció és biztosítás',
    icon: BookOpen,
    keys: [
      'rehab_penalty_per_person', 'rehab_threshold_employees', 'rehab_quota_pct',
      'insurance_threshold_pct', 'insurance_threshold_amount',
    ],
  },
  special: {
    label: 'Speciális adónemek (KATA, KIVA, EKHO)',
    icon: Calculator,
    keys: [
      'kata_monthly_tax', 'kata_annual_revenue_cap', 'kata_excess_tax_rate',
      'kiva_rate',
      'ekho_upper_limit', 'ekho_rate_employee', 'ekho_rate_employer',
      'ev_minimum_multiplier', 'atalanyadó_exempt_limit',
      'netak_annual_avg_4x',
      'szakkep_szja_exempt_limit', 'szakkep_base_cost',
      'kozfogl_wage', 'chamber_contribution',
    ],
  },
};

// ── Human-readable labels ──
const PARAM_LABELS: Record<string, string> = {
  // Alapbérek
  minimum_wage: 'Minimálbér (havi)',
  guaranteed_minimum: 'Garantált bérminimum (havi)',
  minimum_wage_annual: 'Minimálbér (éves)',
  min_wage_hourly: 'Minimálbér (óra)',
  guaranteed_minimum_hourly: 'Garantált bérminimum (óra)',

  // Adókulcsok
  szja_rate: 'SZJA kulcs',
  tb_rate: 'TB járulék kulcs',
  szocho_rate: 'SZOCHO kulcs',
  szocho_kedv_rate: 'SZOCHO kedvezményes kulcs',
  eho_rate: 'EHO kulcs',

  // Családi kedvezmény
  family_1_child: 'Családi kedvezmény – 1 gyermek (alap)',
  family_1_child_saving: 'Családi kedvezmény – 1 gyermek (megtakarítás)',
  family_2_children: 'Családi kedvezmény – 2 gyermek (alap)',
  family_2_children_saving: 'Családi kedvezmény – 2 gyermek (megtakarítás)',
  family_3plus_children: 'Családi kedvezmény – 3+ gyermek (alap)',
  family_3plus_children_saving: 'Családi kedvezmény – 3+ gyermek (megtakarítás)',
  family_disabled_extra: 'Tartósan beteg gyermek extra',

  // 25 év alatti
  young_25_cap: '25 év alattiak kedvezménye (havi plafon)',
  young_25_annual_cap: '25 év alattiak kedvezménye (éves plafon)',

  // Személyi kedvezmény
  personal_disability: 'Személyi kedvezmény – fogyatékos (alap)',
  personal_disability_saving: 'Személyi kedvezmény – fogyatékos (megtakarítás)',

  // Első házasok
  first_marriage: 'Első házasok kedvezménye (alap)',
  first_marriage_saving: 'Első házasok kedvezménye (megtakarítás)',
  first_marriage_months: 'Első házasok kedvezmény időtartam',

  // Egészségügyi járulék
  health_service_monthly: 'Eü. szolgáltatási járulék (havi)',
  health_service_daily: 'Eü. szolgáltatási járulék (napi)',

  // EFO
  efo_daily_tax: 'EFO napi munkáltatói közteher',
  efo_min_hourly_unskilled: 'EFO min. órabér (szakképzettség nélkül)',
  efo_min_hourly_skilled: 'EFO min. órabér (szakképzett)',
  efo_max_daily_wage: 'EFO max. napi bér',
  efo_exempt_daily_unskilled: 'EFO SZJA-mentes napi keret',
  efo_exempt_daily_skilled: 'EFO SZJA-mentes napi keret (szakképzett)',
  efo_max_days_same_parties: 'EFO max. napok (azonos felek)',
  efo_mezo_sav1_days: 'EFO mezőgazdasági 1. sáv napok',
  efo_mezo_sav1_rate: 'EFO mezőgazdasági 1. sáv közteher',
  efo_mezo_sav2_rate: 'EFO mezőgazdasági 2. sáv közteher',
  efo_mezo_max_days: 'EFO mezőgazdasági max. napok',
  efo_film_daily_tax: 'EFO filmipari statiszta napi közteher',
  efo_film_max_daily_wage: 'EFO filmipari max. napi bér',

  // Távmunka
  remote_work_allowance: 'Távmunka adómentes átalány (havi)',

  // SZÉP kártya és cafeteria
  szep_card_accommodation_limit: 'SZÉP kártya szálláshely limit',
  szep_card_food_limit: 'SZÉP kártya vendéglátás limit',
  szep_card_leisure_limit: 'SZÉP kártya szabadidő limit',
  cafeteria_recreation_limit: 'Cafeteria rekreáció limit',
  szep_card_tax_rate: 'SZÉP kártya adókulcs',
  cafeteria_excess_tax_rate: 'Cafeteria túllépés adókulcs',
  szep_recreation_annual: 'SZÉP kártya rekreációs éves keret',
  szep_active_annual: 'SZÉP kártya Aktív Magyarok éves keret',
  szep_total_annual_max: 'SZÉP kártya összesített éves max.',
  szep_fringe_tax_rate: 'SZÉP kártya béren kívüli közteher',
  specified_benefit_tax_rate: 'Meghatározott juttatás közteher',

  // Lakhatás
  housing_support_monthly: 'Lakhatási támogatás 35 év alatt (havi max.)',
  housing_support_annual: 'Lakhatási támogatás 35 év alatt (éves max.)',
  housing_support_tax_rate: 'Lakhatási támogatás közteher',

  // Csekély értékű ajándék
  small_gift_per_occasion: 'Csekély értékű ajándék (alkalmanként)',
  small_gift_max_occasions: 'Csekély értékű ajándék (max. alkalom/év)',

  // Munkába járás
  commuting_per_km: 'Munkába járás térítés (Ft/km)',
  commuting_monthly_max: 'Munkába járás havi max.',

  // Túlóra
  overtime_annual_limit_mt: 'Túlóra éves keret – Mt.',
  overtime_annual_limit_ksz: 'Túlóra éves keret – KSZ',

  // Rehabilitáció
  rehab_penalty_per_person: 'Rehabilitációs hozzájárulás (büntetés/fő/év)',
  rehab_threshold_employees: 'Rehabilitáció kötelező felett (fő)',
  rehab_quota_pct: 'Rehabilitáció kvóta',

  // SZOCHO
  szocho_capital_cap: 'SZOCHO felső határ (tőkejövedelem)',
  szocho_kutatoi_pct: 'SZOCHO kutatói kedvezmény',
  szocho_career_starter_max: 'SZOCHO pályakezdő max. alap',
  szocho_phd_rate: 'SZOCHO PhD kedvezmény kulcs',

  // Biztosítási küszöb
  insurance_threshold_pct: 'Megbízás biztosítási küszöb (%)',
  insurance_threshold_amount: 'Megbízás biztosítási küszöb (Ft)',

  // Nyugdíjas anya
  netak_annual_avg_4x: 'Nyugdíjas anya SZOCHO küszöb',

  // Szakképzés
  szakkep_szja_exempt_limit: 'Szakképzési munkabér SZJA-mentes határ',
  szakkep_base_cost: 'Szakképzési önköltség SZOCHO kedv. alap',

  // Közfoglalkoztatás
  kozfogl_wage: 'Közfoglalkoztatási bér',

  // EKHO
  ekho_upper_limit: 'EKHO felső határ (éves)',
  ekho_rate_employee: 'EKHO magánszemély kulcs',
  ekho_rate_employer: 'EKHO kifizető kulcs',

  // Betegszabadság
  sick_leave_days: 'Betegszabadság napok (év)',
  sick_leave_pct: 'Betegszabadság díj (távolléti díj %)',

  // Kamarai
  chamber_contribution: 'Iparkamarai kötelező hozzájárulás (éves)',

  // Vállalkozói
  ev_minimum_multiplier: 'EV/társas vállalkozó minimumalap szorzó',

  // Átalányadó
  atalanyadó_exempt_limit: 'Átalányadó adómentes határ (éves)',

  // KATA
  kata_monthly_tax: 'KATA havi tételes adó',
  kata_annual_revenue_cap: 'KATA éves bevételi plafon',
  kata_excess_tax_rate: 'KATA túllépési különadó kulcs',

  // KIVA
  kiva_rate: 'KIVA adókulcs',

  // 30 év alatti anyák
  young_mothers_cap: '30 év alatti anyák kedvezménye limit',
};

function formatParamValue(key: string, value: number): string {
  if (key.includes('rate') || key.includes('pct') || key.includes('quota')) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (key.includes('_days') || key === 'efo_max_days_same_parties' || key === 'efo_mezo_max_days') {
    return `${value} nap`;
  }
  if (key.includes('_months')) {
    return `${value} hónap`;
  }
  if (key.includes('_occasions') || key === 'small_gift_max_occasions') {
    return `${value} alkalom`;
  }
  if (key.includes('_employees') || key === 'rehab_threshold_employees') {
    return `${value} fő`;
  }
  if (key.includes('multiplier')) {
    return `${value}×`;
  }
  if (key.includes('per_km')) {
    return `${value} Ft/km`;
  }
  return value.toLocaleString('hu-HU') + ' Ft';
}

export default function TaxParametersPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const { data: params, isLoading } = useTaxParameters(selectedYear);
  const updateParam = useUpdateTaxParameter();
  const { toast } = useToast();

  const handleStartEdit = (key: string, value: number) => {
    setEditingKey(key);
    // Show raw numeric value for editing
    setEditValue(String(value));
  };

  const handleSaveEdit = (key: string) => {
    const numValue = parseFloat(editValue);
    if (isNaN(numValue)) {
      toast({ title: 'Hibás érték', description: 'Kérlek adj meg érvényes számot.', variant: 'destructive' });
      return;
    }
    updateParam.mutate(
      { year: selectedYear, key, value: numValue },
      {
        onSuccess: () => {
          toast({ title: 'Mentve', description: `${PARAM_LABELS[key] || key} frissítve.` });
          setEditingKey(null);
        },
        onError: () => {
          toast({ title: 'Hiba', description: 'Nem sikerült menteni.', variant: 'destructive' });
        },
      }
    );
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const filteredCategories = useMemo(() => {
    if (!params) return {};
    if (!searchQuery) return CATEGORIES;

    const q = searchQuery.toLowerCase();
    const result: typeof CATEGORIES = {};

    for (const [catId, cat] of Object.entries(CATEGORIES)) {
      const matchingKeys = cat.keys.filter(key =>
        (PARAM_LABELS[key] || key).toLowerCase().includes(q) ||
        key.includes(q)
      );
      if (matchingKeys.length > 0) {
        result[catId] = { ...cat, keys: matchingKeys };
      }
    }

    return result;
  }, [params, searchQuery]);

  if (isLoading) {
    return (
      <div className="w-full space-y-6 animate-in fade-in">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        {[0, 1, 2].map(i => (
          <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const allParamKeys = Object.values(CATEGORIES).flatMap(c => c.keys);
  const uncategorizedKeys = params ? Object.keys(params).filter(k => !allParamKeys.includes(k)) : [];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/accounty/payroll/${companyId}`)} className="h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Paramétertábla</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Jogszabályi paraméterek — {selectedYear}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Keresés paraméter neve..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-card border-border text-sm"
        />
      </div>

      {/* Parameter categories */}
      {params && Object.entries(filteredCategories).map(([catId, cat]) => (
        <div key={catId} className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border dark:bg-slate-900/30 flex items-center gap-2">
            <cat.icon className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">{cat.label}</h2>
          </div>
          <div className="divide-y divide-border/50">
            {cat.keys.map((key) => {
              const value = params[key];
              if (value === undefined) return null;
              const isEditing = editingKey === key;

              return (
                <div key={key} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{PARAM_LABELS[key] || key}</p>
                    <p className="text-[11px] font-mono text-slate-400">{key}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <Input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(key);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-32 h-8 text-sm font-mono text-right"
                          autoFocus
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => handleSaveEdit(key)}>
                          <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={handleCancelEdit}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-bold text-primary font-mono">
                          {formatParamValue(key, value)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleStartEdit(key, value)}
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Uncategorized parameters */}
      {uncategorizedKeys.length > 0 && params && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border dark:bg-slate-900/30">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Egyéb paraméterek</h2>
          </div>
          <div className="divide-y divide-border/50">
            {uncategorizedKeys.map((key) => (
              <div key={key} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{PARAM_LABELS[key] || key}</p>
                  <p className="text-[11px] font-mono text-slate-400">{key}</p>
                </div>
                <span className="text-sm font-bold text-primary font-mono">
                  {formatParamValue(key, params[key])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {params && Object.keys(params).length === 0 && (
        <div className="py-16 text-center">
          <Settings className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">Nincs paraméter a(z) {selectedYear}. évre</p>
        </div>
      )}
    </div>
  );
}
