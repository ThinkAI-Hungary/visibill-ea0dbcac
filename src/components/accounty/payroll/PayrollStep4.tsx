import React from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Coffee, Smartphone, Home, Gift, User, Loader2, Sparkles } from 'lucide-react';

interface PayrollStep4Props {
  activeEmployees: any[];
  allEmployments: any[];
  items?: any[];
  cafeteriaItems?: any[];
  setCafeteriaItems?: React.Dispatch<React.SetStateAction<any[]>>;
}

export default function PayrollStep4({
  activeEmployees,
  allEmployments,
  items = [],
  cafeteriaItems: propCafeteriaItems,
  setCafeteriaItems: propSetCafeteriaItems,
}: PayrollStep4Props) {
  const [localCafeteriaItems, setLocalCafeteriaItems] = React.useState<any[]>([]);
  const cafeteriaItems = propCafeteriaItems ?? localCafeteriaItems;
  const setCafeteriaItems = propSetCafeteriaItems ?? setLocalCafeteriaItems;

  const [loading, setLoading] = React.useState(false);
  const [localHoInputs, setLocalHoInputs] = React.useState<Record<string, string>>({});

  const activeEmploymentIdsKey = React.useMemo(() => {
    return allEmployments
      .filter(e => activeEmployees.some(emp => emp.id === e.employee_id))
      .map(e => e.id)
      .sort()
      .join(',');
  }, [allEmployments, activeEmployees]);

  React.useEffect(() => {
    // If parent already provided cafeteriaItems, skip duplicate network call
    if (propCafeteriaItems !== undefined) return;

    if (!activeEmploymentIdsKey) {
      setCafeteriaItems([]);
      return;
    }

    let isMounted = true;
    const fetchCafeteria = async () => {
      const ids = activeEmploymentIdsKey.split(',');
      if (cafeteriaItems.length === 0) setLoading(true);
      try {
        const { data, error } = await supabase
          .from('accounty_cafeteria')
          .select('*')
          .in('employment_id', ids);
        
        if (error) throw error;
        if (isMounted) setCafeteriaItems(data || []);
      } catch (err) {
        console.error('Error fetching cafeteria items:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCafeteria();
    return () => { isMounted = false; };
  }, [activeEmploymentIdsKey, propCafeteriaItems]);

  // Aggregate totals
  const szepHospitality = React.useMemo(() => cafeteriaItems
    .filter(i => i.benefit_type === 'szep_recreation' && i.sub_type === 'vendeglatas')
    .reduce((sum, i) => sum + Number(i.amount), 0), [cafeteriaItems]);

  const szepLeisure = React.useMemo(() => cafeteriaItems
    .filter(i => i.benefit_type === 'szep_recreation' && i.sub_type === 'szabadido')
    .reduce((sum, i) => sum + Number(i.amount), 0), [cafeteriaItems]);

  const szepAccom = React.useMemo(() => cafeteriaItems
    .filter(i => i.benefit_type === 'szep_recreation' && i.sub_type === 'szallashely')
    .reduce((sum, i) => sum + Number(i.amount), 0), [cafeteriaItems]);

  const recreation = React.useMemo(() => cafeteriaItems
    .filter(i => i.benefit_type === 'szep_active' || i.sub_type === 'recreation')
    .reduce((sum, i) => sum + Number(i.amount), 0), [cafeteriaItems]);

  const housingAllowance = React.useMemo(() => cafeteriaItems
    .filter(i => i.benefit_type === 'housing' || i.is_housing_allowance)
    .reduce((sum, i) => sum + Number(i.amount), 0), [cafeteriaItems]);

  // Filter phone items for private use (item_type: 'phone_private')
  const phoneItems = React.useMemo(() => items
    .filter(i => i.item_type === 'phone_private'), [items]);

  const getEmployeeNameByEmploymentId = (employmentId: string) => {
    const emp = allEmployments.find(e => e.id === employmentId);
    if (!emp) return 'Ismeretlen';
    const employee = activeEmployees.find(e => e.id === emp.employee_id);
    if (!employee) return 'Ismeretlen';
    return `${employee.last_name} ${employee.first_name}`;
  };

  const getEmployeeNameByEmployeeId = (employeeId: string) => {
    const employee = activeEmployees.find(e => e.id === employeeId);
    if (!employee) return 'Ismeretlen';
    return `${employee.last_name} ${employee.first_name}`;
  };

  if (propCafeteriaItems === undefined && loading && cafeteriaItems.length === 0) {
    return (
      <div className="flex justify-center items-center h-48 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 font-medium text-sm">Cafeteria adatok összesítése...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Magáncélú telefonhasználat, cafeteria juttatások, SZÉP kártya kezelés.
      </p>

      {/* Tax info banner */}
      <div className="p-4 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="text-xs text-indigo-700 dark:text-indigo-300 space-y-1">
          <p className="font-bold">2026. évi Cafeteria és Juttatási szabályok:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li><strong>SZÉP Kártya zsebek</strong>: Szálláshely, Vendéglátás és Szabadidő zsebenként max. 450 000 Ft/év limit. 28%-os adózás (15% SZJA + 13% SZOCHO) 1.0x-es alapon. A limit feletti rész 33.04%-os teherrel adózik.</li>
            <li><strong>Rekreációs keret (Aktív Magyarok)</strong>: Évi max. 120 000 Ft-ig (havi 10 000 Ft) 28%-os adózás, afelett szintén egyes meghatározott juttatásként 33.04%.</li>
            <li><strong>Lakhatási támogatás (35 év alattiaknak)</strong>: Havi max. 150 000 Ft-ig adómentes juttatás a dolgozónak, a cégnek 28% munkáltatói közteher (SZJA + SZOCHO). 35 év felett a támogatás teljes mértékben bérként adózik.</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SZÉP kártya panel */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-3 lg:col-span-2">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Coffee className="w-4 h-4 text-amber-500" /> SZÉP kártya összesítés
          </h4>
          <p className="text-xs text-slate-500 mb-2">Éves limit: 450.000 Ft / zseb</p>
          <div className="space-y-4">
            {[
              { name: 'Szálláshely', used: szepAccom, limit: 450000, color: 'bg-blue-500' },
              { name: 'Vendéglátás', used: szepHospitality, limit: 450000, color: 'bg-amber-500' },
              { name: 'Szabadidő', used: szepLeisure, limit: 450000, color: 'bg-green-500' },
            ].map((pocket) => (
              <div key={pocket.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-600 dark:text-slate-400">{pocket.name}</span>
                  <span className="font-mono text-slate-500">
                    {pocket.used.toLocaleString('hu-HU')} / {pocket.limit.toLocaleString('hu-HU')} Ft
                  </span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', pocket.color)}
                    style={{ width: `${Math.min(100, (pocket.used / pocket.limit) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right side widgets: Rekreáció & Lakhatási */}
        <div className="space-y-4 lg:col-span-1">
          {/* Rekreáció */}
          <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Gift className="w-4 h-4 text-violet-500" /> Rekreáció
              </h4>
              <span className="text-xs text-slate-500 font-mono font-bold">
                {recreation.toLocaleString('hu-HU')} / 120.000 Ft
              </span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-violet-500 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (recreation / 120000) * 100)}%` }} 
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Kedvezményes keret: évi 120.000 Ft</p>
          </div>

          {/* Lakhatási támogatás */}
          <div className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Home className="w-4 h-4 text-indigo-500" /> Lakhatási támogatás
            </h4>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                {housingAllowance.toLocaleString('hu-HU')}
              </span>
              <span className="text-xs text-slate-500">Ft / hó</span>
            </div>
            <p className="text-[10px] text-slate-400">35 év alattiaknál havi 150.000 Ft-ig adómentes.</p>
          </div>

          {/* Home Office Költségtérítés (Adómentes átalány) */}
          <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Home className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Home Office átalány (Adómentes)
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
              <span className="text-xs text-slate-500">Ft / hó</span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              SZJA tv. 3. sz. melléklet: Havi minimálbér max. 10%-áig (max. <strong>32 280 Ft/hó</strong>) igazolás nélkül adómentes otthoni munkavégzésre.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Home Office Reimbursement Management per Employee */}
      <div className="p-5 rounded-xl border border-emerald-500/30 bg-card shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Home className="w-5 h-5 text-emerald-500" /> Home Office költségtérítés megadása dolgozónként
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Itt adhatod meg az igazolás nélküli adómentes otthoni munkavégzési átalányt dolgozónként (max. 32 280 Ft/hó).
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-slate-50 dark:bg-slate-900/30">
                <th className="px-4 py-2 text-left font-medium text-slate-500 uppercase">Dolgozó neve</th>
                <th className="px-4 py-2 text-center font-medium text-slate-500 uppercase">Havi adómentes átalány (Ft/hó)</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500 uppercase">Gyorsbeállítás</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {activeEmployees.map((emp) => {
                const empEmployment = allEmployments.find(e => e.employee_id === emp.id);
                const hoItem = cafeteriaItems.find(
                  i => i.employment_id === empEmployment?.id && (i.benefit_type === 'home_office' || i.sub_type === 'home_office')
                );
                const currentHoAmount = hoItem ? Number(hoItem.amount) : 0;

                const updateHoAmount = async (amount: number) => {
                  if (!empEmployment?.id) return;
                  try {
                    if (amount > 0) {
                      if (hoItem) {
                        const { data } = await supabase
                          .from('accounty_cafeteria')
                          .update({ amount })
                          .eq('id', hoItem.id)
                          .select('*')
                          .single();
                        if (data) {
                          setCafeteriaItems(prev => prev.map(i => i.id === hoItem.id ? data : i));
                        }
                      } else {
                        const { data } = await supabase
                          .from('accounty_cafeteria')
                          .insert({
                            employment_id: empEmployment.id,
                            benefit_type: 'other',
                            sub_type: 'home_office',
                            amount: amount,
                          })
                          .select('*')
                          .single();
                        if (data) {
                          setCafeteriaItems(prev => [...prev, data]);
                        }
                      }
                    } else if (hoItem) {
                      await supabase.from('accounty_cafeteria').delete().eq('id', hoItem.id);
                      setCafeteriaItems(prev => prev.filter(i => i.id !== hoItem.id));
                    }
                  } catch (err) {
                    console.error('Error updating Home Office item:', err);
                  }
                };

                const inputValue = localHoInputs[emp.id] !== undefined
                  ? localHoInputs[emp.id]
                  : (currentHoAmount ? String(currentHoAmount) : '');

                return (
                  <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100">
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
                            const val = e.target.value;
                            setLocalHoInputs(prev => ({ ...prev, [emp.id]: val }));
                          }}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            updateHoAmount(val);
                          }}
                          className="w-32 text-right rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 font-mono font-bold text-emerald-600 dark:text-emerald-400 focus:border-primary focus:outline-none"
                        />
                        <span className="text-slate-400 font-mono">Ft</span>
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
                          className="px-2 py-1 text-[11px] text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Phone panel */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-500" /> Magáncélú telefon
          </h4>
          <p className="text-xs text-slate-500 mb-4">A magáncélú telefonhasználat 20%-a kerül adóztatásra.</p>
          {phoneItems.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-border/60">
              <p className="text-xs text-slate-400">Nincs rögzített tétel</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {phoneItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-xs p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-border/40">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {getEmployeeNameByEmploymentId(item.employment_id)}
                    </span>
                    {item.description && <span className="text-slate-400 block text-[10px] mt-0.5">{item.description}</span>}
                  </div>
                  <span className="font-mono font-bold text-slate-950 dark:text-slate-50">
                    {Number(item.amount).toLocaleString('hu-HU')} Ft
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cafeteria Details per Employee */}
        <div className="p-5 rounded-xl border border-border bg-card shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
            <User className="w-4 h-4 text-emerald-500" /> Cafeteria juttatások dolgozónként
          </h4>
          <p className="text-xs text-slate-500 mb-4">Aktív cafeteria tételek listája a jelenlegi ciklusban.</p>
          {cafeteriaItems.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-border/60">
              <p className="text-xs text-slate-400">Nincs rögzített cafeteria juttatás</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cafeteriaItems.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-xs p-3 bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-border/40">
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {getEmployeeNameByEmploymentId(item.employment_id)}
                    </span>
                    <span className="text-slate-400 block text-[10px] mt-0.5 capitalize">
                      {item.benefit_type === 'szep_recreation' ? `SZÉP Kártya (${item.sub_type})` :
                       item.benefit_type === 'housing' ? 'Lakhatási támogatás' :
                       item.benefit_type === 'home_office' ? 'Home Office átalány' :
                       item.benefit_type === 'szep_active' ? 'Rekreációs keret' : item.benefit_type}
                      {item.provider ? ` - ${item.provider}` : ''}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-950 dark:text-slate-50">
                    {Number(item.amount).toLocaleString('hu-HU')} Ft
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
