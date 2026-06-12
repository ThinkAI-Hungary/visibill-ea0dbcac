import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Calendar, Clock, CheckCircle, ArrowRight, ArrowDown,
  FileText, Save, AlertTriangle, User, Briefcase, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeJobs, useAddJobModification } from '@/hooks/useAccountyData';

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
  { value: 'site', label: 'Telephely változás', deadline: 'Nem kell bejelenteni a NAV felé', icon: ArrowRight },
  { value: 'costcenter', label: 'Költséghely változás', deadline: 'Nem kell bejelenteni a NAV felé', icon: ArrowRight },
];

export default function JobModificationPage() {
  const { id, empId } = useParams<{ id: string; empId: string }>();
  const { toast } = useToast();
  const { data: jobs, isLoading } = useEmployeeJobs(id || '', empId || '');
  const addModMut = useAddJobModification();

  const activeJob = (jobs || []).find(j => j.status === 'active');

  const [data, setData] = useState<ModificationData>({
    changeType: 'worktime', effectiveDate: new Date().toISOString().split('T')[0],
    oldValue: '', newValue: '', reason: '', generate08E: true,
  });

  const update = (patch: Partial<ModificationData>) => setData(d => ({ ...d, ...patch }));
  const needs08E = data.changeType === 'worktime' || data.changeType === 'feor';
  const selectedType = CHANGE_TYPES.find(t => t.value === data.changeType)!;

  const getOldValue = () => {
    if (!activeJob) return '—';
    switch (data.changeType) {
      case 'worktime': return String(activeJob.weeklyHours);
      case 'feor': return activeJob.feor;
      case 'salary': return String(activeJob.baseSalary);
      case 'position': return activeJob.position;
      default: return '—';
    }
  };

  const handleSave = async () => {
    if (!id || !empId) return;
    try {
      await addModMut.mutateAsync({
        companyId: id, employeeId: empId, jobId: activeJob?.id,
        changeType: data.changeType, effectiveDate: data.effectiveDate,
        oldValue: getOldValue(), newValue: data.newValue, reason: data.reason, generate08e: data.generate08E,
      });
      toast({ title: 'Módosítás mentve ✓' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  if (isLoading) return <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link to={`/accounty/payroll/${id}/employees/${empId || ''}`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25"><RefreshCw className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Jogviszony módosítás</h1>
          <p className="text-sm text-slate-500">{activeJob ? `${activeJob.position} — ${activeJob.feor}` : 'Munkavállaló'}</p>
        </div>
      </div>

      {!activeJob ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-sm text-slate-400">Nincs aktív jogviszony a munkavállalóhoz. Először hozzon létre egy jogviszonyt.</div>
      ) : (
        <>
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Változás típusa</h2>
            <div className="grid grid-cols-3 gap-2">
              {CHANGE_TYPES.map(ct => (
                <button key={ct.value} onClick={() => update({ changeType: ct.value })} className={cn('p-3 rounded-xl border-2 text-left transition-all', data.changeType === ct.value ? 'border-violet-500 bg-violet-50 dark:bg-violet-500/10' : 'border-border hover:border-violet-300')}>
                  <ct.icon className="w-4 h-4 mb-1 text-violet-600" />
                  <p className="text-xs font-bold">{ct.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{ct.deadline}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Calendar className="w-4 h-4" /> Hatálybalépés dátuma</h2>
            <input type="date" value={data.effectiveDate} onChange={e => update({ effectiveDate: e.target.value })} className="px-3 py-2 rounded-lg border border-border bg-background text-sm" />
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
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300 line-through">{getOldValue()}</div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <input type="text" value={data.newValue} onChange={e => update({ newValue: e.target.value })} className="px-3 py-2 rounded-lg border-2 border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-sm text-emerald-700 dark:text-emerald-300 font-medium" placeholder="Új érték" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Megjegyzés / Indoklás</label>
              <textarea value={data.reason} onChange={e => update({ reason: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" placeholder="Pl. Előléptetés, szervezeti változás, stb." />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" asChild><Link to={`/accounty/payroll/${id}/employees/${empId || ''}`}>Mégse</Link></Button>
            <Button onClick={handleSave} disabled={addModMut.isPending || !data.newValue.trim()} className="gap-1.5 bg-violet-600 hover:bg-violet-700">
              {addModMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Módosítás mentése
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
