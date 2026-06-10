import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, LogOut, ChevronRight, CheckCircle, AlertTriangle, Calendar,
  FileText, Shield, Calculator, Download, Clock, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MOCK_EMP = {
  name: 'Kiss Béla',
  tajNumber: '987 654 321',
  startDate: '2024-01-15',
  position: 'Adótanácsadó',
  baseSalary: 380000,
  leaveRemaining: 12,
  leaveUsed: 10,
};

type ExitReason = 'resignation' | 'mutual' | 'employer_notice' | 'employer_immediate' | 'probation' | 'fixed_term_end';
type Step = 'reason' | 'dates' | 'settlement' | 'checklist' | 'summary';

const EXIT_REASONS: { value: ExitReason; label: string; desc: string; noticeDays: number }[] = [
  { value: 'resignation', label: 'Munkavállaló felmondása', desc: 'Mt. 67. § — 30 napos felmondási idő', noticeDays: 30 },
  { value: 'mutual', label: 'Közös megegyezés', desc: 'Mt. 64. § (1) — Tetszőleges dátum', noticeDays: 0 },
  { value: 'employer_notice', label: 'Munkáltató rendes felmondása', desc: 'Mt. 68-69. § — Felmondási idő a jogviszony hosszától függ', noticeDays: 30 },
  { value: 'employer_immediate', label: 'Azonnali hatályú felmondás', desc: 'Mt. 78. § — Nincs felmondási idő', noticeDays: 0 },
  { value: 'probation', label: 'Próbaidő alatti felmondás', desc: 'Mt. 79. § (1) — Azonnali', noticeDays: 0 },
  { value: 'fixed_term_end', label: 'Határozott idő lejárta', desc: 'Automatikus megszűnés', noticeDays: 0 },
];

const CHECKLIST_ITEMS = [
  { id: 'igazolas', label: 'Munkáltatói igazolás kiállítása', desc: 'Mt. 80. § (2)', required: true },
  { id: 'tb_igazolas', label: 'TB igazolás', desc: 'OEP felé történő bejelentés', required: true },
  { id: 'kifizetolap', label: 'Végkielégítés számfejtése', desc: 'Ha jár — Mt. 77. §', required: false },
  { id: '08e', label: '08E kijelentés benyújtása', desc: 'NAV felé T1041E adat — 15 napon belül', required: true },
  { id: 'adat', label: 'Adattovábbítás KSH/NEAK felé', desc: 'Havi stat. jelentés', required: true },
  { id: 'cafe', label: 'Cafeteria záró rendezés', desc: 'SZÉP-kártya egyenleg', required: false },
  { id: 'beteg', label: 'Betegszabadság záró igazolás', desc: 'NEAK nyilvántartás zárása', required: false },
  { id: 'leave_pay', label: 'Szabadság megváltás számfejtése', desc: 'Ki nem vett szabadság kifizetése', required: false },
  { id: 'portal', label: 'Client Portal hozzáférés deaktiválása', desc: 'Accounty rendszer', required: false },
];

const STEPS: { id: Step; label: string }[] = [
  { id: 'reason', label: 'Jogcím' },
  { id: 'dates', label: 'Dátumok' },
  { id: 'settlement', label: 'Elszámolás' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'summary', label: 'Összegzés' },
];

export default function EmployeeExitWizardPage() {
  const { id, empId } = useParams<{ id: string; empId: string }>();
  const [step, setStep] = useState<Step>('reason');
  const [reason, setReason] = useState<ExitReason>('resignation');
  const [lastDay, setLastDay] = useState('');
  const [noticeSent, setNoticeSent] = useState('');
  const [leavePayDays, setLeavePayDays] = useState(String(MOCK_EMP.leaveRemaining));
  const [severancePay, setSeverancePay] = useState('0');
  const [checklistDone, setChecklistDone] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);

  const toggleChecklist = (itemId: string) => {
    setChecklistDone(prev => {
      const next = new Set(prev);
      next.has(itemId) ? next.delete(itemId) : next.add(itemId);
      return next;
    });
  };

  const selectedReason = EXIT_REASONS.find(r => r.value === reason)!;
  const stepIndex = STEPS.findIndex(s => s.id === step);

  const handleSubmit = () => { setSaved(true); };

  const leavePayAmount = Number(leavePayDays) * Math.round(MOCK_EMP.baseSalary / 22);
  const totalSettlement = leavePayAmount + Number(severancePay);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/accounty/payroll/${id}/employees/${empId || ''}`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="p-2.5 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl shadow-lg shadow-red-500/25"><LogOut className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold">Kiléptetés varázsló</h1>
          <p className="text-sm text-slate-500">{MOCK_EMP.name} — {MOCK_EMP.position}</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 px-4">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <button onClick={() => setStep(s.id)} className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all',
              stepIndex > i ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
              step === s.id ? 'bg-red-600 text-white ring-2 ring-red-300' :
              'bg-slate-100 text-slate-500 dark:bg-slate-700'
            )}>
              {stepIndex > i ? <CheckCircle className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
              {s.label}
            </button>
            {i < STEPS.length - 1 && <div className={cn('w-8 h-0.5', stepIndex > i ? 'bg-emerald-500' : 'bg-slate-200')} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step: Reason */}
      {step === 'reason' && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-bold">Megszűnés jogcíme</h2>
          <div className="space-y-2">
            {EXIT_REASONS.map(r => (
              <button key={r.value} onClick={() => setReason(r.value)} className={cn(
                'w-full p-4 rounded-xl border-2 text-left transition-all',
                reason === r.value ? 'border-red-500 bg-red-50 dark:bg-red-500/10' : 'border-border hover:border-red-300'
              )}>
                <p className="text-sm font-bold">{r.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Dates */}
      {step === 'dates' && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-bold">Dátumok és határidők</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Felmondás kézbesítése</label>
              <input type="date" value={noticeSent} onChange={e => setNoticeSent(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-red-500 outline-none" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Utolsó munkanap</label>
              <input type="date" value={lastDay} onChange={e => setLastDay(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-red-500 outline-none" />
            </div>
          </div>
          {selectedReason.noticeDays > 0 && noticeSent && (
            <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Felmondási idő: {selectedReason.noticeDays} nap — Legkorábbi utolsó nap: {
                new Date(new Date(noticeSent).getTime() + selectedReason.noticeDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
              }
            </div>
          )}
          <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3 text-xs text-blue-800 dark:text-blue-300">
            <strong>08E bejelentési határidő:</strong> Az utolsó naptól számított 15 napon belül (legkésőbb: {
              lastDay ? new Date(new Date(lastDay).getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : '—'
            })
          </div>
        </div>
      )}

      {/* Step: Settlement */}
      {step === 'settlement' && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-bold">Záró elszámolás</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Ki nem vett szabadság (nap)</label>
              <input type="number" value={leavePayDays} onChange={e => setLeavePayDays(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-red-500 outline-none" />
              <p className="text-[10px] text-slate-400 mt-1">Napi bér: {Math.round(MOCK_EMP.baseSalary / 22).toLocaleString('hu-HU')} Ft | Megváltás: {leavePayAmount.toLocaleString('hu-HU')} Ft</p>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Végkielégítés összege (Ft)</label>
              <input type="number" value={severancePay} onChange={e => setSeverancePay(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono focus:ring-2 focus:ring-red-500 outline-none" />
              <p className="text-[10px] text-slate-400 mt-1">Mt. 77. § — Csak munkáltató felmondása esetén</p>
            </div>
          </div>
          <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-500/10 dark:to-pink-500/10 rounded-lg p-4 text-right">
            <p className="text-xs text-slate-500">Záró elszámolás összesen</p>
            <p className="text-2xl font-bold font-mono text-red-600">{totalSettlement.toLocaleString('hu-HU')} Ft</p>
          </div>
        </div>
      )}

      {/* Step: Checklist */}
      {step === 'checklist' && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-3">
          <h2 className="text-lg font-bold">Kilépési checklist</h2>
          <p className="text-xs text-slate-500 mb-2">{checklistDone.size}/{CHECKLIST_ITEMS.length} feladat kész — Pirossal jelölt: kötelező</p>
          {CHECKLIST_ITEMS.map(item => (
            <button key={item.id} onClick={() => toggleChecklist(item.id)} className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all',
              checklistDone.has(item.id) ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20' :
              item.required ? 'bg-red-50/30 dark:bg-red-500/5 border border-red-200/50 dark:border-red-500/10' :
              'border border-border hover:bg-slate-50 dark:hover:bg-slate-800/50'
            )}>
              <div className={cn('w-5 h-5 rounded flex items-center justify-center shrink-0',
                checklistDone.has(item.id) ? 'bg-emerald-500 text-white' : 'border border-slate-300'
              )}>
                {checklistDone.has(item.id) && <CheckCircle className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1">
                <p className={cn('text-sm font-medium', checklistDone.has(item.id) && 'line-through text-slate-400')}>{item.label}</p>
                <p className="text-[10px] text-slate-400">{item.desc}</p>
              </div>
              {item.required && !checklistDone.has(item.id) && (
                <span className="text-[10px] text-red-500 font-bold">KÖTELEZŐ</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Step: Summary */}
      {step === 'summary' && !saved && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-bold">Kiléptetés összegzése</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p><span className="text-slate-500">Munkavállaló:</span> <strong>{MOCK_EMP.name}</strong></p>
              <p><span className="text-slate-500">Jogcím:</span> <strong>{selectedReason.label}</strong></p>
              <p><span className="text-slate-500">Utolsó nap:</span> <strong>{lastDay || '—'}</strong></p>
            </div>
            <div className="space-y-2">
              <p><span className="text-slate-500">Szabadság megváltás:</span> <strong>{leavePayAmount.toLocaleString('hu-HU')} Ft</strong></p>
              <p><span className="text-slate-500">Végkielégítés:</span> <strong>{Number(severancePay).toLocaleString('hu-HU')} Ft</strong></p>
              <p><span className="text-slate-500">Checklist:</span> <strong>{checklistDone.size}/{CHECKLIST_ITEMS.length}</strong></p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSubmit} className="gap-1.5 bg-red-600 hover:bg-red-700">
              <LogOut className="w-4 h-4" /> Kiléptetés véglegesítése
            </Button>
          </div>
        </div>
      )}

      {saved && (
        <div className="bg-card rounded-xl border border-border p-16 text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto" />
          <h2 className="text-xl font-bold">Kiléptetés véglegesítve</h2>
          <p className="text-sm text-slate-500">{MOCK_EMP.name} — Utolsó munkanap: {lastDay}</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" className="gap-1.5"><Download className="w-4 h-4" /> Munkáltatói igazolás</Button>
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
              <Link to={`/accounty/payroll/${id}/employees`}>Vissza a listához</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Navigation */}
      {!saved && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].id)} disabled={stepIndex === 0}>Vissza</Button>
          {stepIndex < STEPS.length - 1 && (
            <Button onClick={() => setStep(STEPS[stepIndex + 1].id)} className="gap-1.5">
              Tovább <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
