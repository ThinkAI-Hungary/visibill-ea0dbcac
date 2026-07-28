import React from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Coffee, Smartphone, Home, Gift, User, Loader2, Sparkles } from 'lucide-react';

interface PayrollStep4Props {
  activeEmployees: any[];
  allEmployments: any[];
  items?: any[];
}

export default function PayrollStep4({
  activeEmployees,
  allEmployments,
  items = [],
}: PayrollStep4Props) {
  const [cafeteriaItems, setCafeteriaItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const fetchCafeteria = async () => {
      const activeEmploymentIds = allEmployments
        .filter(e => activeEmployees.some(emp => emp.id === e.employee_id))
        .map(e => e.id);

      if (activeEmploymentIds.length === 0) {
        setCafeteriaItems([]);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('accounty_cafeteria')
          .select('*')
          .in('employment_id', activeEmploymentIds);
        
        if (error) throw error;
        setCafeteriaItems(data || []);
      } catch (err) {
        console.error('Error fetching cafeteria items:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCafeteria();
  }, [activeEmployees, allEmployments]);

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

  if (loading) {
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
