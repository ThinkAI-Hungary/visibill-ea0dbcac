import React, { useState, useEffect } from 'react';
import {
  Coffee, Gift, Home, Smartphone, User, Sparkles, Loader2, UtensilsCrossed, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { payrollQueryKeys } from '@/hooks/usePayrollData';

interface PayrollStep4Props {
  activeEmployees: any[];
  allEmployments: any[];
  items?: any[];
  cafeteriaItems?: any[];
  setCafeteriaItems?: (items: any[]) => void;
}

export default function PayrollStep4({
  activeEmployees,
  allEmployments,
  items = [],
  cafeteriaItems: propCafeteriaItems,
  setCafeteriaItems: setPropCafeteriaItems,
}: PayrollStep4Props) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [internalCafeteria, setInternalCafeteria] = useState<any[]>([]);
  const [localHoInputs, setLocalHoInputs] = useState<Record<string, string>>({});
  const [localPhoneInputs, setLocalPhoneInputs] = useState<Record<string, string>>({});

  const cafeteriaItems = propCafeteriaItems !== undefined ? propCafeteriaItems : internalCafeteria;

  // Active employment IDs
  const activeEmploymentIds = React.useMemo(() => {
    return allEmployments
      .filter(e => activeEmployees.some(emp => emp.id === e.employee_id))
      .map(e => e.id);
  }, [allEmployments, activeEmployees]);

  const fetchCafeteria = async () => {
    if (activeEmploymentIds.length === 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('accounty_cafeteria')
        .select('*')
        .in('employment_id', activeEmploymentIds);

      if (error) throw error;
      const res = data || [];
      if (setPropCafeteriaItems) setPropCafeteriaItems(res);
      else setInternalCafeteria(res);
    } catch (err) {
      console.error('Error fetching cafeteria items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (propCafeteriaItems === undefined) {
      fetchCafeteria();
    }
  }, [activeEmploymentIds.join(',')]);

  // Aggregates for 2026 SZÉP Card 2-balance system
  const szepRecreation = cafeteriaItems
    .filter(i => i.benefit_type === 'szep_recreation' || i.benefit_type === 'szep_hospitality' || i.benefit_type === 'szep_accommodation' || i.benefit_type === 'szep_leisure')
    .reduce((s, i) => s + Number(i.amount), 0);

  const szepActive = cafeteriaItems
    .filter(i => i.benefit_type === 'szep_active' || i.benefit_type === 'szep_sport')
    .reduce((s, i) => s + Number(i.amount), 0);

  const housingAllowance = cafeteriaItems
    .filter(i => i.benefit_type === 'housing')
    .reduce((s, i) => s + Number(i.amount), 0);

  const phoneItems = cafeteriaItems.filter(i => i.benefit_type === 'phone' || i.benefit_type === 'company_phone');

  const getEmployeeNameByEmploymentId = (employmentId: string) => {
    const empRel = allEmployments.find(e => e.id === employmentId);
    if (!empRel) return 'Ismeretlen';
    const employee = activeEmployees.find(e => e.id === empRel.employee_id);
    if (!employee) return 'Ismeretlen';
    return `${employee.last_name} ${employee.first_name}`;
  };

  if (propCafeteriaItems === undefined && loading && cafeteriaItems.length === 0) {
    return (
      <div className="flex justify-center items-center h-48 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 font-medium text-sm">Cafeteria adatok betöltése...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground dark:text-foreground/90">
        SZÉP kártya juttatások (2026-os kétkeretes modell), magáncélú telefonhasználat és adómentes Home Office átalány kezelése.
      </p>

      {/* Tax info banner */}
      <div className="p-4 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-700 dark:text-indigo-300 space-y-1">
          <p className="font-bold">2026. évi Cafeteria és Juttatási szabályok:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>SZÉP Kártya Rekreációs Keret:</strong> Évi max. <strong>450 000 Ft</strong> összevont keret (szálláshely, melegkonyhás vendéglátás és szabadidő együtt egyben). 28%-os kedvezményes adózás (15% SZJA + 13% SZOCHO). A keret feletti rész egyes meghatározott juttatásként 33.04%-kal adózik.</li>
            <li><strong>SZÉP Kártya Aktív Magyarok Keret:</strong> Külön keretként évi max. <strong>120 000 Ft</strong> (havi 10 000 Ft) sportolási és szabadidős mozgás célokra 28%-os adózással.</li>
            <li><strong>Magáncélú telefonhasználat (Szja tv. 69. §):</strong> Céges telefon esetén a számla bruttó díjának 20%-a tekintendő magáncélú használatnak. Ez a 20% egyes meghatározott juttatásként 1.18 × 28% = <strong>33.04% munkáltatói adóteherrel</strong> adózik.</li>
            <li><strong>Home Office költségtérítés:</strong> Havi minimálbér 10%-áig (max. <strong>32 280 Ft/hó</strong>) igazolás nélkül adómentes.</li>
          </ul>
        </div>
      </div>

      {/* Tip for Service Charge (Felszolgálási díj) */}
      <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-lg flex items-start gap-3">
        <UtensilsCrossed className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 dark:text-amber-200">
          <p className="font-semibold text-amber-900 dark:text-amber-100">Vendéglátóipari felszolgálási díjat rögzítenél?</p>
          <p className="mt-0.5">
            A felszolgálási díj törvényileg bérjellegű juttatásnak minősül (0% SZJA, 18,5% TB [nyugdíjasnál 0%], 0% SZOCHO terheli), ezért nem a Cafeteria keretben, hanem a <strong>következő (5. Bruttó bér és pótlékok) lépésben</strong> adható meg közvetlenül dolgozónként!
          </p>
        </div>
      </div>

      {/* Modern 2-Balance SZÉP Card + Benefits Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SZÉP kártya modern panel */}
        <div className="p-5 rounded-lg border border-border bg-card shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Coffee className="w-4 h-4 text-amber-500" /> SZÉP Kártya Keretek (2026)
            </h4>
            <span className="text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary rounded">
              Összesített kedvezményes keret: 570 000 Ft/év
            </span>
          </div>

          <div className="space-y-4">
            {/* 1. Rekreációs Főkeret (450 000 Ft) */}
            <div className="p-4 rounded-lg bg-background/50 border border-border space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-foreground flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  Rekreációs Keret (Szállás, Vendéglátás, Szabadidő egyben)
                </span>
                <span className="font-mono text-muted-foreground">
                  {szepRecreation.toLocaleString('hu-HU')} / 450 000 Ft
                </span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (szepRecreation / 450000) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Éves rekreációs limit: 450 000 Ft (28% közteher, a felette lévő rész 33.04%).
              </p>
            </div>

            {/* 2. Aktív Magyarok Sportkeret (120 000 Ft) */}
            <div className="p-4 rounded-lg bg-background/50 border border-border space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-foreground flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  Aktív Magyarok Keret (Sport és Egészségmegőrző mozgás)
                </span>
                <span className="font-mono text-muted-foreground">
                  {szepActive.toLocaleString('hu-HU')} / 120 000 Ft
                </span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, (szepActive / 120000) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Külön dedikált sportkeret: évi 120 000 Ft (havi 10 000 Ft) 28%-os adózással.
              </p>
            </div>
          </div>
        </div>

        {/* Right side widgets: Lakhatási & Home Office */}
        <div className="space-y-4 lg:col-span-1">
          {/* Lakhatási támogatás */}
          <div className="p-5 rounded-lg border border-border bg-card shadow-sm space-y-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Home className="w-4 h-4 text-primary" /> Lakhatási támogatás
            </h4>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-primary">
                {housingAllowance.toLocaleString('hu-HU')}
              </span>
              <span className="text-xs text-muted-foreground">Ft / hó</span>
            </div>
            <p className="text-[10px] text-muted-foreground">35 év alattiaknál havi 150 000 Ft-ig adómentes a dolgozónak.</p>
          </div>

          {/* Home Office Költségtérítés (Adómentes átalány) */}
          <div className="p-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Home className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Home Office átalány
              </h4>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded">
                Adómentes
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {cafeteriaItems
                  .filter(i => i.benefit_type === 'home_office' || i.sub_type === 'home_office')
                  .reduce((s, i) => s + Number(i.amount), 0)
                  .toLocaleString('hu-HU')}
              </span>
              <span className="text-xs text-muted-foreground">Ft / hó</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Max. <strong>32 280 Ft/hó</strong> igazolás nélkül adómentes.
            </p>
          </div>
        </div>
      </div>

      {/* ── Magáncélú Mobiltelefon Használat Dolgozónként ── */}
      <div className="p-5 rounded-lg border border-blue-500/30 bg-card shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-base font-bold text-foreground flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-blue-500" /> Magáncélú Telefonhasználat Rögzítése (Szja tv. 69. §)
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add meg a cég által fizetett havi bruttó telefonszámlát dolgozónként. A 20%-os magáncélú átalány után a rendszer automatikusan számolja a 33.04%-os munkáltatói adóterhet.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <th className="px-4 py-2.5 text-left uppercase">Dolgozó Neve</th>
                <th className="px-4 py-2.5 text-center uppercase">Havi Telefonszámla (Ft)</th>
                <th className="px-4 py-2.5 text-right uppercase">20% Magánhasználat (Ft)</th>
                <th className="px-4 py-2.5 text-right uppercase">Munkáltatói Adóteher (33.04%)</th>
                <th className="px-4 py-2.5 text-right uppercase w-32">Művelet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {activeEmployees.map((emp) => {
                const empEmployment = allEmployments.find(e => e.employee_id === emp.id);
                const existingPhoneItem = cafeteriaItems.find(
                  i => (i.benefit_type === 'phone' || i.benefit_type === 'company_phone') && i.employment_id === empEmployment?.id
                );

                const currentPhoneBill = Number(existingPhoneItem?.amount || 0);

                const updatePhoneAmount = async (billAmount: number) => {
                  if (!empEmployment?.id) return;
                  try {
                    if (billAmount > 0) {
                      const payload = {
                        employment_id: empEmployment.id,
                        benefit_type: 'company_phone',
                        sub_type: 'telecommunication',
                        provider: 'Mobilflotta',
                        amount: billAmount,
                        tax_type: 'specified_benefit', // egyes meghatározott juttatás (33.04%)
                        period_year: new Date().getFullYear(),
                        period_month: new Date().getMonth() + 1,
                      };

                      if (existingPhoneItem?.id) {
                        await supabase
                          .from('accounty_cafeteria')
                          .update({ amount: billAmount })
                          .eq('id', existingPhoneItem.id);
                      } else {
                        await supabase
                          .from('accounty_cafeteria')
                          .insert(payload);
                      }
                    } else if (existingPhoneItem?.id) {
                      await supabase
                        .from('accounty_cafeteria')
                        .delete()
                        .eq('id', existingPhoneItem.id);
                    }

                    if (propCafeteriaItems === undefined) {
                      await fetchCafeteria();
                    } else {
                      queryClient.invalidateQueries({ queryKey: ['payroll'] });
                    }
                  } catch (err) {
                    console.error('Error updating phone item:', err);
                  }
                };

                const inputVal = localPhoneInputs[emp.id] !== undefined
                  ? localPhoneInputs[emp.id]
                  : (currentPhoneBill ? String(currentPhoneBill) : '');

                const billNum = Number(inputVal) || 0;
                const privateBase = Math.round(billNum * 0.20);
                const employerTax = Math.round(privateBase * 1.18 * 0.28); // 1.18 * 28% = 33.04%

                return (
                  <tr key={emp.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {emp.last_name} {emp.first_name}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="inline-flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          placeholder="0"
                          value={inputVal}
                          onChange={(e) => {
                            const val = e.target.value.replace(/^-+/, '');
                            setLocalPhoneInputs(prev => ({ ...prev, [emp.id]: val }));
                          }}
                          onBlur={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            updatePhoneAmount(val);
                          }}
                          className="w-32 text-right rounded border border-border bg-card px-2.5 py-1 font-mono font-bold text-blue-600 dark:text-blue-400 focus:border-primary focus:outline-none text-xs"
                        />
                        <span className="text-muted-foreground font-mono">Ft</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground/90">
                      {privateBase.toLocaleString('hu-HU')} Ft
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                      {employerTax.toLocaleString('hu-HU')} Ft
                    </td>
                    <td className="px-4 py-3 text-right">
                      {billNum > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setLocalPhoneInputs(prev => ({ ...prev, [emp.id]: '0' }));
                            updatePhoneAmount(0);
                          }}
                          className="px-2.5 py-1 text-[11px] text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded border border-transparent hover:border-red-200 transition-colors"
                        >
                          Törlés
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Home Office Költségtérítés Dolgozónként ── */}
      <div className="p-5 rounded-lg border border-emerald-500/30 bg-card shadow-sm space-y-4">
        <div>
          <h4 className="text-base font-bold text-foreground flex items-center gap-2">
            <Home className="w-5 h-5 text-emerald-500" /> Home Office Költségtérítés Megadása Dolgozónként
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Itt adhatod meg az igazolás nélküli adómentes otthoni munkavégzési átalányt dolgozónként (max. 32 280 Ft/hó).
          </p>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                <th className="px-4 py-2.5 text-left uppercase">Dolgozó Neve</th>
                <th className="px-4 py-2.5 text-center uppercase">Havi Adómentes Átalány (Ft/hó)</th>
                <th className="px-4 py-2.5 text-right uppercase">Gyorsbeállítás / Művelet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {activeEmployees.map((emp) => {
                const empEmployment = allEmployments.find(e => e.employee_id === emp.id);
                const existingHoItem = cafeteriaItems.find(
                  i => (i.benefit_type === 'home_office' || i.sub_type === 'home_office') && i.employment_id === empEmployment?.id
                );

                const currentHoAmount = Number(existingHoItem?.amount || 0);

                const updateHoAmount = async (amount: number) => {
                  if (!empEmployment?.id) return;
                  try {
                    if (amount > 0) {
                      const payload = {
                        employment_id: empEmployment.id,
                        benefit_type: 'home_office',
                        sub_type: 'home_office',
                        provider: 'Adómentes költségtérítés',
                        amount,
                        tax_type: 'tax_free',
                        period_year: new Date().getFullYear(),
                        period_month: new Date().getMonth() + 1,
                      };

                      if (existingHoItem?.id) {
                        await supabase
                          .from('accounty_cafeteria')
                          .update({ amount })
                          .eq('id', existingHoItem.id);
                      } else {
                        await supabase
                          .from('accounty_cafeteria')
                          .insert(payload);
                      }
                    } else if (existingHoItem?.id) {
                      await supabase
                        .from('accounty_cafeteria')
                        .delete()
                        .eq('id', existingHoItem.id);
                    }

                    if (propCafeteriaItems === undefined) {
                      await fetchCafeteria();
                    } else {
                      queryClient.invalidateQueries({ queryKey: ['payroll'] });
                    }
                  } catch (err) {
                    console.error('Error updating Home Office item:', err);
                  }
                };

                const inputValue = localHoInputs[emp.id] !== undefined
                  ? localHoInputs[emp.id]
                  : (currentHoAmount ? String(currentHoAmount) : '');

                return (
                  <tr key={emp.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {emp.last_name} {emp.first_name}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="inline-flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={32280}
                          placeholder="0"
                          value={inputValue}
                          onChange={(e) => {
                            const val = e.target.value.replace(/^-+/, '');
                            setLocalHoInputs(prev => ({ ...prev, [emp.id]: val }));
                          }}
                          onBlur={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            updateHoAmount(val);
                          }}
                          className="w-32 text-right rounded border border-border bg-card px-2.5 py-1 font-mono font-bold text-emerald-600 dark:text-emerald-400 focus:border-primary focus:outline-none text-xs"
                        />
                        <span className="text-muted-foreground font-mono">Ft</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLocalHoInputs(prev => ({ ...prev, [emp.id]: '32280' }));
                          updateHoAmount(32280);
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 rounded border border-emerald-500/30 transition-colors"
                      >
                        Max. adómentes (32 280 Ft)
                      </button>
                      {(currentHoAmount > 0 || Number(inputValue) > 0) && (
                        <button
                          type="button"
                          onClick={() => {
                            setLocalHoInputs(prev => ({ ...prev, [emp.id]: '0' }));
                            updateHoAmount(0);
                          }}
                          className="px-2 py-1 text-[11px] text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          Törlés
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
