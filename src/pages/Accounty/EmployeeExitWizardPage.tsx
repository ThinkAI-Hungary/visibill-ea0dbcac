import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, UserX, Calendar, CheckCircle, AlertTriangle,
  FileText, ArrowRight, Loader2, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePayrollEmployments } from '@/hooks/usePayrollData';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';

const REASONS = [
  'Közös megegyezés', 'Munkavállaló felmondása', 'Munkáltatói felmondás',
  'Próbaidő alatti azonnali hatályú felmondás', 'Határozott idő lejárta',
];

const EXIT_DOCS = [
  { id: 'cert', label: 'Munkáltatói igazolás', ref: 'Mt. 80. § (2)', required: true },
  { id: 'tb', label: 'TB igazolás (OEP)', ref: 'Tbj. 50. §', required: true },
  { id: 'm30', label: 'Jövedelemigazolás (M30)', ref: 'Szja tv. 46. § (4)', required: true },
  { id: 'leave', label: 'Szabadság-elszámolás', ref: 'Mt. 125. §', required: true },
  { id: 'final_payslip', label: 'Záró bérjegyzék', ref: 'Mt. 155. §', required: true },
  { id: 'deregister', label: '08E kijelentés', ref: 'Art. 50. §', required: true },
  { id: 'severance', label: 'Végkielégítés számfejtés', ref: 'Mt. 77. §', required: false },
  { id: 'pension', label: 'Szolgálati idő igazolás', ref: 'Tny. 96. §', required: false },
  { id: 'competition', label: 'Versenytilalmi megállapodás', ref: 'Mt. 228. §', required: false },
];

export default function EmployeeExitWizardPage() {
  const { companyId, empId } = useParams<{ companyId: string; empId: string }>();
  const id = companyId;
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: employments = [], isLoading, isError: empError, refetch: refetchEmp } = usePayrollEmployments(empId || '');
  const [saving, setSaving] = useState(false);

  // Find active employment, or fall back to any non-terminated, or the first one
  const activeJob = employments.find(e => e.status === 'active')
    || employments.find(e => e.status !== 'terminated')
    || employments[0];

  const [step, setStep] = useState(0);
  const [reason, setReason] = useState('');
  const [lastDay, setLastDay] = useState(new Date().toISOString().split('T')[0]);
  const [leavePayDays, setLeavePayDays] = useState('0');
  const [severancePay, setSeverancePay] = useState(false);
  const [notes, setNotes] = useState('');
  const [checkedDocs, setCheckedDocs] = useState<Set<string>>(new Set());

  const leavePayAmount = activeJob ? Number(leavePayDays) * Math.round((activeJob.base_salary || 0) / 22) : 0;

  const canNext = () => {
    if (step === 0) return !!reason;
    if (step === 1) return !!lastDay;
    return true;
  };

  const handleFinish = async () => {
    if (!id || !empId || !activeJob) return;
    setSaving(true);
    try {
      // 1. Terminate the employment
      const { error: empErr } = await supabase
        .from('accounty_employments')
        .update({
          status: 'terminated',
          end_date: lastDay,
          metadata: {
            termination_reason: reason,
            termination_notes: notes || undefined,
            terminated_at: new Date().toISOString(),
            severance_pay: severancePay,
            leave_pay_days: Number(leavePayDays),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeJob.id);
      if (empErr) throw empErr;

      // 2. Generate 08E kijelentés filing
      const rowData = {
        name: activeJob.job_title || '',
        tajNumber: '',
        changeType: 'kijelentes',
        changeCode: '02',
        effectiveDate: lastDay,
        feor: activeJob.feor_code || '',
        weeklyHours: activeJob.weekly_hours || 40,
        insured: true,
      };
      await supabase.from('accounty_filings').insert({
        company_id: id,
        filing_type: '08e',
        period_year: new Date(lastDay).getFullYear(),
        period_month: new Date(lastDay).getMonth() + 1,
        status: 'draft',
        xml_data: JSON.stringify(rowData),
        channel: 'onya',
      });

      // 3. Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['accounty'] });

      toast({ title: 'Kilépés rögzítve', description: `${activeJob.job_title || 'Jogviszony'} — Utolsó nap: ${lastDay}. 08E kijelentés generálva.` });
      navigate(`/accounty/payroll/${id}/employees/${empId}/exit-docs`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (empError) return <AccountyErrorState message="Nem sikerült betölteni a jogviszony adatokat." onRetry={() => refetchEmp()} />;
  if (isLoading) return <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>;

  if (!activeJob) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg"><UserX className="w-5 h-5 text-white" /></div>
          <h1 className="text-2xl font-bold">Kilépési varázsló</h1>
        </div>
        <div className="bg-card rounded-xl border border-border p-12 text-center text-sm text-slate-400">Nincs aktív jogviszony ehhez a munkavállalóhoz.</div>
      </div>
    );
  }

  const STEPS = ['Kilépés oka', 'Dátumok', 'Pénzügyi elszámolás', 'Dokumentumok', 'Összesítés'];

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
        <div className="p-2.5 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg"><UserX className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold">Kilépési varázsló</h1>
          <p className="text-sm text-slate-500">{activeJob.job_title || activeJob.employment_type} — {activeJob.feor_code}</p>
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
            <p className="text-[10px] text-slate-400 mt-1">Napi bér: {activeJob ? Math.round((activeJob.base_salary || 0) / 22).toLocaleString('hu-HU') : 0} Ft | Megváltás: {leavePayAmount.toLocaleString('hu-HU')} Ft</p>
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

      {/* Step 3: Documents checklist */}
      {step === 3 && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Kilépő dokumentumcsomag</h2>
          <p className="text-xs text-slate-500">Jelöld be, mely dokumentumok készültek el vagy relevánsak.</p>
          <div className="space-y-2">
            {EXIT_DOCS.map(doc => (
              <button key={doc.id} onClick={() => setCheckedDocs(prev => {
                const next = new Set(prev);
                next.has(doc.id) ? next.delete(doc.id) : next.add(doc.id);
                return next;
              })} className={cn('w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left text-sm transition-all',
                checkedDocs.has(doc.id) ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-border hover:border-slate-300'
              )}>
                <div className={cn('w-5 h-5 rounded flex items-center justify-center shrink-0',
                  checkedDocs.has(doc.id) ? 'bg-emerald-500 text-white' : 'border border-slate-300'
                )}>
                  {checkedDocs.has(doc.id) && <CheckCircle className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1">
                  <span className="font-medium">{doc.label}</span>
                  {doc.required && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">KÖTELEZŐ</span>}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{doc.ref}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">{checkedDocs.size}/{EXIT_DOCS.length} dokumentum jelölve</p>
        </div>
      )}

      {/* Step 4: Summary */}
      {step === 4 && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Összesítés</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-slate-500 text-xs">Munkavállaló:</p><p className="font-bold">{activeJob.job_title || activeJob.employment_type}</p></div>
            <div><p className="text-slate-500 text-xs">Kilépés oka:</p><p className="font-bold">{reason}</p></div>
            <div><p className="text-slate-500 text-xs">Utolsó munkanap:</p><p className="font-bold">{lastDay}</p></div>
            <div><p className="text-slate-500 text-xs">Szabadság megváltás:</p><p className="font-bold">{leavePayDays} nap ({leavePayAmount.toLocaleString('hu-HU')} Ft)</p></div>
            <div><p className="text-slate-500 text-xs">Végkielégítés:</p><p className="font-bold">{severancePay ? 'Igen' : 'Nem'}</p></div>
            <div><p className="text-slate-500 text-xs">Dokumentumok:</p><p className="font-bold">{checkedDocs.size}/{EXIT_DOCS.length} kész</p></div>
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
          <Button onClick={handleFinish} disabled={saving} className="gap-1.5 bg-red-600 hover:bg-red-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Mentés...' : 'Kilépés véglegesítése'}
          </Button>
        )}
      </div>
    </div>
  );
}
