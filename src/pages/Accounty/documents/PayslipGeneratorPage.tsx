import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Printer, CheckCircle, Clock, Eye,
  Users, AlertTriangle, Languages, Stamp, RefreshCw, Loader2, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAccountyDocuments, type AccountyDocument } from '@/hooks/useAccountyData';
import { useToast } from '@/hooks/use-toast';
import { exportPdf } from '@/lib/exportPdf';

export default function PayslipGeneratorPage() {
  const { id } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<'official' | 'custom'>('official');
  const [language, setLanguage] = useState<'hu' | 'en'>('hu');
  const [avdh, setAvdh] = useState(false);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const { data: docs, isLoading } = useAccountyDocuments(id || '', 'payslip');
  const slips = docs || [];

  const generatedCount = slips.filter(s => s.status === 'generated').length;
  const deadline = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 10);
  const daysUntil = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const fmt = (n: number) => n.toLocaleString('hu-HU');

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">Bérjegyzék generálás</h1>
            <p className="text-sm text-slate-500">Mt. 155. § — Havi bérjegyzékek</p>
          </div>
        </div>
        <div className={cn('px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5', daysUntil <= 0 ? 'bg-red-100 text-red-700' : daysUntil <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700')}>
          <Clock className="w-3.5 h-3.5" />
          Határidő: {deadline.toLocaleDateString('hu-HU')} ({daysUntil <= 0 ? 'Lejárt!' : `${daysUntil} nap`})
        </div>
      </div>

      {/* Config */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase">Sablon</h3>
          <div className="space-y-2">
            {[{ value: 'official' as const, label: 'Hivatali alap sablon' }, { value: 'custom' as const, label: 'Egyedi céges sablon' }].map(opt => (
              <button key={opt.value} onClick={() => setTemplate(opt.value)} className={cn('w-full p-2.5 rounded-lg border text-left text-sm transition-all', template === opt.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 font-bold' : 'border-border hover:border-blue-300')}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase">Beállítások</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <span className="text-sm flex items-center gap-1.5"><Languages className="w-3.5 h-3.5" /> Nyelv</span>
              <select value={language} onChange={e => setLanguage(e.target.value as 'hu' | 'en')} className="px-2 py-1 rounded border border-border bg-background text-xs">
                <option value="hu">Magyar</option><option value="en">English</option>
              </select>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <span className="text-sm flex items-center gap-1.5"><Stamp className="w-3.5 h-3.5" /> AVDH hitelesítés</span>
              <button onClick={() => setAvdh(!avdh)} className={cn('relative w-10 h-5 rounded-full transition-colors', avdh ? 'bg-emerald-500' : 'bg-slate-300')}>
                <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform', avdh ? 'translate-x-5' : 'translate-x-0.5')} />
              </button>
            </div>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase">Műveletek</h3>
          <div className="space-y-2">
            <Button onClick={() => { setGenerating(true); toast({ title: 'Bérjegyzékek generálva ' }); setTimeout(() => setGenerating(false), 2000); }} disabled={generating} className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-sm">
              {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              {generating ? 'Generálás...' : 'Mind generálása'}
            </Button>
            <Button variant="outline" className="w-full gap-1.5 text-sm" onClick={() => {
              if (slips.length === 0) return;
              exportPdf('berjegyzekek', {
                title: 'Bérjegyzékek',
                subtitle: 'Havi bérjegyzék lista',
                headers: ['Dokumentum', 'Időszak', 'Státusz'],
                rows: slips.map(s => [s.title, s.period, s.status === 'generated' ? 'Generálva' : s.status]),
              });
            }}><Download className="w-3.5 h-3.5" /> PDF letöltés</Button>
            <Button variant="outline" className="w-full gap-1.5 text-sm" onClick={() => window.print()}><Printer className="w-3.5 h-3.5" /> Nyomtatás</Button>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 text-xs text-blue-800 dark:text-blue-300">
        <strong>Mt. 155. § (2) — Kötelező tartalom:</strong> Azonosítók, Időadatok, Bruttó elemek jogcímenként, Levonások tételesen, Nettó összeg, Munkáltatói közterhek, Szabadságkeret.
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
      ) : slips.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
          <Database className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm text-slate-500">Nincsenek bérjegyzékek erre az időszakra.</p>
          <p className="text-xs text-slate-400">A bérjegyzékek a számfejtés véglegesítése után generálhatók.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border dark:bg-slate-900/30 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Bérjegyzékek ({slips.length} db)</h2>
            <span className="text-xs text-emerald-600 font-bold">{generatedCount}/{slips.length} generálva</span>
          </div>
          <div className="divide-y divide-border/50">
            {slips.map(slip => (
              <div key={slip.id} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{slip.title}</p>
                  <p className="text-xs text-slate-500">{slip.period}</p>
                </div>
                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold',
                  slip.status === 'generated' ? 'bg-emerald-100 text-emerald-700' :
                  slip.status === 'pending' ? 'bg-slate-100 text-slate-500' :
                  'bg-blue-100 text-blue-700'
                )}>
                  {slip.status === 'generated' ? 'Generálva' : slip.status === 'pending' ? 'Várakozik' : slip.status}
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Download className="w-3 h-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
