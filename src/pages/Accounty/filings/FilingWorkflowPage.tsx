import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Eye, Shield, Send, CheckCircle, FileText, Download,
  AlertTriangle, Clock, Stamp, XCircle, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Step = 'preview' | 'sign' | 'submit' | 'receipt';

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: 'preview', label: 'Előnézet', icon: Eye },
  { id: 'sign', label: 'Aláírás (AVDH)', icon: Stamp },
  { id: 'submit', label: 'Beküldés', icon: Send },
  { id: 'receipt', label: 'Nyugta', icon: CheckCircle },
];

export default function FilingWorkflowPage() {
  const { id, filingId } = useParams<{ id: string; filingId: string }>();
  const [step, setStep] = useState<Step>('preview');
  const [signing, setSigning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const stepIndex = STEPS.findIndex(s => s.id === step);

  const handleSign = () => {
    setSigning(true);
    setTimeout(() => { setSigning(false); setStep('submit'); }, 2000);
  };

  const handleSubmit = () => {
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setSubmitted(true); setStep('receipt'); }, 3000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link to={`/accounty/payroll/${id}/filings`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/25"><Send className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold">Bevallás beküldés</h1>
          <p className="text-sm text-slate-500">Bevallás #{filingId || 'new'} — Előnézet → Aláírás → Beküldés</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 px-4">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <button onClick={() => i <= stepIndex && setStep(s.id)} className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all',
              stepIndex > i ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
              step === s.id ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' :
              'bg-slate-100 text-slate-500 dark:bg-slate-700'
            )}>
              {stepIndex > i ? <CheckCircle className="w-3.5 h-3.5" /> : <s.icon className="w-3.5 h-3.5" />}
              {s.label}
            </button>
            {i < STEPS.length - 1 && <div className={cn('w-8 h-0.5', stepIndex > i ? 'bg-emerald-500' : 'bg-slate-200')} />}
          </React.Fragment>
        ))}
      </div>

      {/* Preview step */}
      {step === 'preview' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-6">
            <h2 className="text-sm font-bold mb-4">Bevallás előnézet</h2>
            <div className="bg-white dark:bg-slate-950 border border-border rounded-lg p-8 min-h-[400px] font-mono text-xs space-y-4">
              <div className="text-center border-b border-border pb-4">
                <p className="text-lg font-bold">NEMZETI ADÓ- ÉS VÁMHIVATAL</p>
                <p className="text-sm mt-1">2608 — Havi bevallás a kifizetésekkel, juttatásokkal összefüggő adóról</p>
                <p className="text-sm">és járulékokról</p>
                <p className="text-xs text-slate-500 mt-2">Időszak: 2026. május</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div><span className="text-slate-500">Adóalany neve:</span> <strong>Teszt Kft.</strong></div>
                <div><span className="text-slate-500">Adószám:</span> <strong>12345678-2-41</strong></div>
                <div><span className="text-slate-500">Biztosítottak száma:</span> <strong>42 fő</strong></div>
                <div><span className="text-slate-500">Bruttó bér összesen:</span> <strong>15 420 000 Ft</strong></div>
              </div>
              <div className="border-t border-border pt-4 space-y-1.5">
                <div className="flex justify-between"><span>Levont SZJA:</span><span className="font-bold">2 313 000 Ft</span></div>
                <div className="flex justify-between"><span>TB járulék (18,5%):</span><span className="font-bold">2 852 700 Ft</span></div>
                <div className="flex justify-between"><span>SZOCHO (13%):</span><span className="font-bold">2 004 600 Ft</span></div>
                <div className="flex justify-between text-emerald-600"><span>Családi kedvezmény:</span><span className="font-bold">-380 000 Ft</span></div>
                <div className="flex justify-between border-t border-border pt-2 text-base"><span className="font-bold">Fizetendő összesen:</span><span className="font-bold text-red-600">6 790 300 Ft</span></div>
              </div>
            </div>
          </div>
          <div className="flex justify-between">
            <Button variant="outline" className="gap-1.5"><Download className="w-4 h-4" /> PDF letöltés</Button>
            <Button onClick={() => setStep('sign')} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
              Tovább az aláíráshoz <Stamp className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Sign step */}
      {step === 'sign' && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-8 text-center space-y-6">
            <Stamp className="w-16 h-16 mx-auto text-indigo-500" />
            <div>
              <h2 className="text-lg font-bold">Elektronikus aláírás (AVDH)</h2>
              <p className="text-sm text-slate-500 mt-1">A bevallás beküldéséhez AVDH (Azonosításra Visszavezetett Dokumentumhitelesítés) szükséges.</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-4 text-left text-sm text-blue-800 dark:text-blue-300">
              <strong>Aláírási módok:</strong>
              <ul className="mt-2 space-y-1 list-disc pl-4 text-xs">
                <li>Ügyfélkapu+ (FIDO2 kulccsal)</li>
                <li>DÁP — Digitális Állampolgárság mobilalkalmazás</li>
                <li>eSzemélyi kártyával (NFC olvasó szükséges)</li>
              </ul>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-4 text-sm text-yellow-800 dark:text-yellow-300">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              <strong>Demo mód:</strong> Valós AVDH aláírás a NAV API integrációt igényli. Most szimulált aláírás történik.
            </div>
            <Button onClick={handleSign} disabled={signing} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
              {signing ? <><Loader2 className="w-4 h-4 animate-spin" /> Aláírás folyamatban...</> : <><Shield className="w-4 h-4" /> AVDH Aláírás indítása</>}
            </Button>
          </div>
        </div>
      )}

      {/* Submit step */}
      {step === 'submit' && !submitted && (
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-8 text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Bevallás aláírva — beküldésre kész</h2>
              <p className="text-sm text-slate-500 mt-1">Az elektronikus aláírás sikeres. A bevallás beküldése a NAV ÁNYK rendszerébe történik.</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4 text-left text-sm grid grid-cols-2 gap-3">
              <div><span className="text-slate-500">Bevallás típus:</span> <strong>2608</strong></div>
              <div><span className="text-slate-500">Időszak:</span> <strong>2026. május</strong></div>
              <div><span className="text-slate-500">Aláíró:</span> <strong>Kovács Péter</strong></div>
              <div><span className="text-slate-500">Aláírás időpont:</span> <strong>{new Date().toLocaleString('hu-HU')}</strong></div>
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Beküldés a NAV-nak...</> : <><Send className="w-4 h-4" /> Beküldés megerősítése</>}
            </Button>
          </div>
        </div>
      )}

      {/* Receipt step */}
      {step === 'receipt' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-500/10 dark:to-green-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 p-10 text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">Bevallás sikeresen beküldve!</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">A NAV rendszere befogadta a bevallást.</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-border p-5 text-left text-sm max-w-md mx-auto space-y-2">
              <div className="flex justify-between"><span className="text-slate-500">Hivatkozási szám:</span><span className="font-mono font-bold">NAV-2608-2026-05-{Math.random().toString(36).slice(2, 8).toUpperCase()}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Beküldés időpont:</span><span>{new Date().toLocaleString('hu-HU')}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Státusz:</span><span className="text-emerald-600 font-bold">Befogadva</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Feldolgozás várható:</span><span>24 órán belül</span></div>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" className="gap-1.5"><Download className="w-4 h-4" /> Nyugta letöltése</Button>
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                <Link to={`/accounty/payroll/${id}/filings`}>Vissza a bevallásokhoz</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
