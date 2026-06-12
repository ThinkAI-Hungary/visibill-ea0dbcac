import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, UserX, Calendar, CheckCircle, AlertTriangle,
  FileText, ArrowRight, Loader2, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useEmployeeJobs } from '@/hooks/useAccountyData';

const REASONS = [
  'Közös megegyezés', 'Munkavállaló felmondása', 'Munkáltatói felmondás',
  'Próbaidő alatti azonnali hatályú felmondás', 'Határozott idő lejárta',
];

export default function EmployeeExitWizardPage() {
  const { id, empId } = useParams<{ id: string; empId: string }>();
  const { toast } = useToast();
  const { data: jobs, isLoading } = useEmployeeJobs(id || '', empId || '');

  const activeJob = (jobs || []).find(j => j.status === 'active');

  const [step, setStep] = useState(0);
  const [reason, setReason] = useState('');
  const [lastDay, setLastDay] = useState(new Date().toISOString().split('T')[0]);
  const [leavePayDays, setLeavePayDays] = useState('0');
  const [severancePay, setSeverancePay] = useState(false);
  const [notes, setNotes] = useState('');

  const leavePayAmount = activeJob ? Number(leavePayDays) * Math.round(activeJob.baseSalary / 22) : 0;

  const canNext = () => {
    if (step === 0) return !!reason;
    if (step === 1) return !!lastDay;
    return true;
  };

  const handleFinish = () => {
    toast({ title: 'Kilépési folyamat rögzítve ✓', description: `${activeJob?.position || 'Munkavállaló'} — Utolsó nap: ${lastDay}` });
  };

  if (isLoading) return <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>;

  if (!activeJob) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}/employees/${empId || ''}`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="p-2.5 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg"><UserX className="w-5 h-5 text-white" /></div>
          <h1 className="text-2xl font-bold">Kilépési varázsló</h1>
        </div>
        <div className="bg-card rounded-xl border border-border p-12 text-center text-sm text-slate-400">Nincs aktív jogviszony ehhez a munkavállalóhoz.</div>
      </div>
    );
  }

  const STEPS = ['Kilépés oka', 'Dátumok', 'Pénzügyi elszámolás', 'Összesítés'];

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link to={`/accounty/payroll/${id}/employees/${empId || ''}`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="p-2.5 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg"><UserX className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold">Kilépési varázsló</h1>
          <p className="text-sm text-slate-500">{activeJob.position} — {activeJob.feor}</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <React.Fragment key={i}>
            <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all',
              i === step ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
              i < step ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20' :
              'bg-slate-100 text-slate-400 dark:bg-slate-800'
            )}>
              {i < step ? <CheckCircle className="w-3 h-3" /> : <span className="w-3 h-3 text-center">{i + 1}</span>}
              <span className="hidden sm:inline">{s}</span>
            </div>
            {i < STEPS.length - 1 && <ArrowRight className="w-3 h-3 text-slate-300" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Reason */}
      {step === 0 && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Jogviszony megszűnésének oka</h2>
          <div className="grid gap-2">
            {REASONS.map(r => (
              <button key={r} onClick={() => setReason(r)} className={cn('p-3 rounded-xl border-2 text-left text-sm font-medium transition-all', reason === r ? 'border-red-500 bg-red-50 dark:bg-red-500/10' : 'border-border hover:border-red-300')}>
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Dates */}
      {step === 1 && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Calendar className="w-4 h-4" /> Utolsó munkanap</h2>
          <input type="date" value={lastDay} onChange={e => setLastDay(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm" />
          <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 dark:text-yellow-300 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>Az 08E kijelentést az utolsó naptól számított 15 napon belül el kell küldeni a NAV felé.</div>
          </div>
        </div>
      )}

      {/* Step 2: Financial */}
      {step === 2 && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Pénzügyi elszámolás</h2>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Szabadság megváltás (napok)</label>
            <input type="number" min={0} value={leavePayDays} onChange={e => setLeavePayDays(e.target.value)} className="w-full max-w-xs px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" />
            <p className="text-[10px] text-slate-400 mt-1">Napi bér: {activeJob ? Math.round(activeJob.baseSalary / 22).toLocaleString('hu-HU') : 0} Ft | Megváltás: {leavePayAmount.toLocaleString('hu-HU')} Ft</p>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl border border-border">
            <div><p className="text-sm font-bold">Végkielégítés</p><p className="text-xs text-slate-500">Mt. 77. § szerint</p></div>
            <button onClick={() => setSeverancePay(!severancePay)} className={cn('relative w-12 h-6 rounded-full transition-colors', severancePay ? 'bg-emerald-500' : 'bg-slate-300')}>
              <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', severancePay ? 'translate-x-6' : 'translate-x-0.5')} />
            </button>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Megjegyzés</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none" placeholder="Különleges körülmények, megállapodások..." />
          </div>
        </div>
      )}

      {/* Step 3: Summary */}
      {step === 3 && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Összesítés</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-slate-500 text-xs">Munkavállaló:</p><p className="font-bold">{activeJob.position}</p></div>
            <div><p className="text-slate-500 text-xs">Kilépés oka:</p><p className="font-bold">{reason}</p></div>
            <div><p className="text-slate-500 text-xs">Utolsó munkanap:</p><p className="font-bold">{lastDay}</p></div>
            <div><p className="text-slate-500 text-xs">Szabadság megváltás:</p><p className="font-bold">{leavePayDays} nap ({leavePayAmount.toLocaleString('hu-HU')} Ft)</p></div>
            <div><p className="text-slate-500 text-xs">Végkielégítés:</p><p className="font-bold">{severancePay ? 'Igen' : 'Nem'}</p></div>
          </div>
          {notes && <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-xs text-slate-600">{notes}</div>}
          <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
            <FileText className="w-3.5 h-3.5 inline mr-1" />
            A mentés után a kilépő dokumentumcsomag automatikusan generálódik.
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>Vissza</Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="gap-1.5 bg-red-600 hover:bg-red-700">
            Tovább <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={handleFinish} className="gap-1.5 bg-red-600 hover:bg-red-700">
            <Save className="w-4 h-4" /> Kilépés véglegesítése
          </Button>
        )}
      </div>
    </div>
  );
}
