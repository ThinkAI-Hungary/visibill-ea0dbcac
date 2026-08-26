import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Calendar, Clock, CheckCircle, ArrowRight, ArrowDown,
  FileText, Save, AlertTriangle, User, Briefcase, Loader2, MapPin
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePayrollEmployments, type PayrollEmployment } from '@/hooks/usePayrollData';
import { useAddJobModification } from '@/hooks/accounty';
import { useCompanyLocations } from '@/hooks/useCompanyLocations';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';
import { ContentSkeleton } from '@/components/ui/content-skeleton';

type ChangeType = 'worktime' | 'feor' | 'salary' | 'position' | 'site' | 'costcenter';

interface ModificationData {
  changeType: ChangeType;
  effectiveDate: string;
  oldValue: string;
  newValue: string;
  reason: string;
  generate08E: boolean;
}

const CHANGE_TYPES: { value: ChangeType; label: string; deadline: string; icon: React.ElementType }[] = [
  { value: 'worktime', label: 'Munkaidő módosítás', deadline: '15 napon belül be kell jelenteni (08E)', icon: Clock },
  { value: 'feor', label: 'FEOR-kód változás', deadline: '15 napon belül be kell jelenteni (08E)', icon: Briefcase },
  { value: 'salary', label: 'Bérváltozás', deadline: 'Nem kell bejelenteni a NAV felé', icon: ArrowDown },
  { value: 'position', label: 'Munkakör változás', deadline: 'Nem kell bejelenteni a NAV felé', icon: User },
  { value: 'site', label: 'Telephely változás', deadline: 'Nem kell bejelenteni a NAV felé', icon: MapPin },
  { value: 'costcenter', label: 'Költséghely változás', deadline: 'Nem kell bejelenteni a NAV felé', icon: ArrowRight },
];

const EMPTY_PER_TYPE: Record<ChangeType, { newValue: string; reason: string }> = {
  worktime: { newValue: '', reason: '' },
  feor: { newValue: '', reason: '' },
  salary: { newValue: '', reason: '' },
  position: { newValue: '', reason: '' },
  site: { newValue: '', reason: '' },
  costcenter: { newValue: '', reason: '' },
};

export default function JobModificationPage() {
  const { companyId, empId } = useParams<{ companyId: string; empId: string }>();
  const id = companyId;
  const { toast } = useToast();
  const { data: employments, isLoading, isError: empError, refetch: refetchEmp } = usePayrollEmployments(empId || '');
  const addModMut = useAddJobModification();
  const { locations } = useCompanyLocations(id);

  const activeJob = (employments || []).find(j => j.status === 'active');

  const [activeType, setActiveType] = useState<ChangeType>('worktime');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [perTypeData, setPerTypeData] = useState<Record<ChangeType, { newValue: string; reason: string }>>({ ...EMPTY_PER_TYPE });

  // Convenience accessors for the active type
  const data = {
    changeType: activeType,
    effectiveDate,
    newValue: perTypeData[activeType].newValue,
    reason: perTypeData[activeType].reason,
  };

  const updateField = (field: 'newValue' | 'reason', value: string) => {
    setPerTypeData(prev => ({ ...prev, [activeType]: { ...prev[activeType], [field]: value } }));
  };

  const needs08E = activeType === 'worktime' || activeType === 'feor';
  const selectedType = CHANGE_TYPES.find(t => t.value === activeType)!;

  const switchType = (ct: ChangeType) => setActiveType(ct);

  const getNewValuePlaceholder = (): string => {
    switch (activeType) {
      case 'worktime': return 'Pl. 36 (heti óra)';
      case 'feor': return 'Pl. 2512';
      case 'salary': return 'Pl. 550000';
      case 'position': return 'Pl. Senior fejlesztő';
      case 'site': return 'Pl. Budapest, Központi iroda';
      case 'costcenter': return 'Pl. IT-002';
      default: return 'Új érték';
    }
  };

  const getReasonPlaceholder = (): string => {
    switch (activeType) {
      case 'worktime': return 'Pl. Részmunkaidőre váltás, GYES után visszatérés, stb.';
      case 'feor': return 'Pl. Átsorolás, feladatkör változás';
      case 'salary': return 'Pl. Éves béremelés, előléptetés';
      case 'position': return 'Pl. Előléptetés, szervezeti átalakítás';
      case 'site': return 'Pl. Irodaváltás, telephely áthelyezés';
      case 'costcenter': return 'Pl. Projekt váltás, részlegváltás';
      default: return 'Indoklás';
    }
  };

  const getOldValueFor = (ct: ChangeType): string => {
    if (!activeJob) return '—';
    switch (ct) {
      case 'worktime': return String(activeJob.weekly_hours);
      case 'feor': return activeJob.feor_code || '—';
      case 'salary': return String(activeJob.base_salary || 0);
      case 'position': return activeJob.job_title || '—';
      case 'site': {
        if (activeJob.location_id && locations.length > 0) {
          const loc = locations.find(l => l.id === activeJob.location_id);
          return loc ? loc.name : '—';
        }
        return '—';
      }
      case 'costcenter': return activeJob.cost_center || '—';
      default: return '—';
    }
  };

  // Collect all types that have a newValue filled in
  const pendingTypes = (Object.entries(perTypeData) as [ChangeType, { newValue: string; reason: string }][])
    .filter(([, v]) => v.newValue.trim().length > 0);
  const pendingCount = pendingTypes.length;

  const handleSaveAll = async () => {
    if (!id || !empId || pendingCount === 0) return;
    try {
      const worktimeChange = pendingTypes.find(([ct]) => ct === 'worktime');
      if (worktimeChange) {
        const hours = parseFloat(worktimeChange[1].newValue);
        if (isNaN(hours) || hours <= 0 || hours > 168) {
          throw new Error('A heti munkaidő értéke 1 és 168 óra között kell legyen!');
        }
      }

      const mods = pendingTypes.map(([ct, v]) => ({
        companyId: id, employeeId: empId,
        changeType: ct, effectiveDate,
        oldValue: getOldValueFor(ct), newValue: v.newValue, reason: v.reason,
        generate08e: ct === 'worktime' || ct === 'feor',
      }));
      await addModMut.mutateAsync(mods);
      // Clear all fields after successful save
      setPerTypeData({ ...EMPTY_PER_TYPE });
      toast({
        title: `${mods.length} módosítás mentve `,
        description: mods.map(m => CHANGE_TYPES.find(t => t.value === m.changeType)?.label).join(', '),
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  if (empError) return <AccountyErrorState message="Nem sikerült betölteni a jogviszony adatokat." onRetry={() => refetchEmp()} />;
  if (isLoading) return <ContentSkeleton />;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25"><RefreshCw className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Jogviszony módosítás</h1>
          <p className="text-sm text-slate-500">{activeJob ? `${activeJob.job_title || activeJob.employment_type} — ${activeJob.feor_code || ''}` : 'Munkavállaló'}</p>
        </div>
      </div>

      {!activeJob ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-sm text-slate-400">Nincs aktív jogviszony a munkavállalóhoz. Először hozzon létre egy jogviszonyt.</div>
      ) : (
        <>
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Változás típusa</h2>
            <div className="grid grid-cols-3 gap-2">
              {CHANGE_TYPES.map(ct => {
                const hasValue = perTypeData[ct.value].newValue.trim().length > 0;
                return (
                  <button
                    key={ct.value}
                    onClick={() => switchType(ct.value)}
                    className={cn(
                      'p-3 rounded-xl border-2 text-left transition-all relative',
                      activeType === ct.value
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10'
                        : 'border-border hover:border-violet-300'
                    )}
                  >
                    <ct.icon className="w-4 h-4 mb-1 text-violet-600" />
                    <p className="text-xs font-bold">{ct.label}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{ct.deadline}</p>
                    {hasValue && (
                      <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-card" title="Kitöltve" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Calendar className="w-4 h-4" /> Hatálybalépés dátuma</h2>
            <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm" />
            {needs08E && (
              <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div><strong>NAV bejelentési kötelezettség!</strong><p className="text-xs mt-0.5">15 napon belül be kell jelenteni a NAV felé 08E biztosítotti bejelentéssel.</p></div>
              </div>
            )}
          </div>

          <div className="bg-card rounded-xl border border-border p-6 space-y-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Változás részletei</h2>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 font-medium">{selectedType.label}</label>
              <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-center">
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300 line-through">{getOldValueFor(activeType)}</div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                {activeType === 'site' ? (
                  <select
                    value={data.newValue}
                    onChange={e => updateField('newValue', e.target.value)}
                    className="px-3 py-2 rounded-lg border-2 border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-sm text-emerald-700 dark:text-emerald-300 font-medium"
                  >
                    <option value="">Válassz telephelyet…</option>
                    {locations.length > 0 ? locations.map(loc => (
                      <option key={loc.id} value={loc.name}>{loc.name} — {loc.address}</option>
                    )) : (
                      <option disabled>Nincs telephely felvéve — Beállítások → Telephelyek</option>
                    )}
                  </select>
                ) : (
                  <input type="text" value={data.newValue} onChange={e => updateField('newValue', e.target.value)} className="px-3 py-2 rounded-lg border-2 border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-sm text-emerald-700 dark:text-emerald-300 font-medium" placeholder={getNewValuePlaceholder()} />
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Megjegyzés / Indoklás</label>
              <textarea value={data.reason} onChange={e => updateField('reason', e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" placeholder={getReasonPlaceholder()} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            {pendingCount > 0 ? (
              <p className="text-xs text-slate-500">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[10px] font-bold mr-1.5">{pendingCount}</span>
                módosítás kitöltve
              </p>
            ) : <div />}
            <div className="flex gap-3">
              <Button variant="outline" asChild><Link to={`/eaisybooks/payroll/${id}/employees/${empId || ''}`}>Mégse</Link></Button>
              <Button onClick={handleSaveAll} disabled={addModMut.isPending || pendingCount === 0} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
                {addModMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {pendingCount > 1 ? `Összes mentése (${pendingCount})` : 'Módosítás mentése'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
