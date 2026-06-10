import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Printer, CheckCircle, Clock, Eye,
  Users, AlertTriangle, Languages, Stamp, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PayslipPreview {
  id: string;
  name: string;
  tajNumber: string;
  grossSalary: number;
  netSalary: number;
  szja: number;
  tb: number;
  szocho: number;
  workedHours: number;
  leaveUsed: number;
  leaveRemaining: number;
  status: 'generated' | 'pending' | 'flagged';
}

const MOCK_SLIPS: PayslipPreview[] = [
  { id: '1', name: 'Nagy Anna', tajNumber: '123 456 789', grossSalary: 450000, netSalary: 299250, szja: 67500, tb: 83250, szocho: 58500, workedHours: 176, leaveUsed: 2, leaveRemaining: 18, status: 'generated' },
  { id: '2', name: 'Kiss Béla', tajNumber: '987 654 321', grossSalary: 380000, netSalary: 252700, szja: 57000, tb: 70300, szocho: 49400, workedHours: 168, leaveUsed: 0, leaveRemaining: 22, status: 'generated' },
  { id: '3', name: 'Tóth Éva', tajNumber: '111 222 333', grossSalary: 322800, netSalary: 214662, szja: 48420, tb: 59718, szocho: 41964, workedHours: 176, leaveUsed: 3, leaveRemaining: 15, status: 'generated' },
  { id: '4', name: 'Szabó Péter', tajNumber: '444 555 666', grossSalary: 520000, netSalary: 345800, szja: 78000, tb: 96200, szocho: 67600, workedHours: 160, leaveUsed: 1, leaveRemaining: 20, status: 'flagged' },
  { id: '5', name: 'Horváth Dávid', tajNumber: '777 888 999', grossSalary: 600000, netSalary: 399000, szja: 90000, tb: 111000, szocho: 78000, workedHours: 184, leaveUsed: 0, leaveRemaining: 25, status: 'pending' },
];

export default function PayslipGeneratorPage() {
  const { id } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<'official' | 'custom'>('official');
  const [language, setLanguage] = useState<'hu' | 'en'>('hu');
  const [avdh, setAvdh] = useState(false);
  const [slips] = useState(MOCK_SLIPS);
  const [generating, setGenerating] = useState(false);

  const generatedCount = slips.filter(s => s.status === 'generated').length;
  const deadline = new Date(2026, 5, 10); // June 10 (month after May)
  const daysUntil = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const fmt = (n: number) => n.toLocaleString('hu-HU');

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}/documents`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">Bérjegyzék generálás</h1>
            <p className="text-sm text-slate-500">Mt. 155. § — 2026. május havi bérjegyzékek</p>
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
                <option value="hu">Magyar</option>
                <option value="en">English</option>
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
            <Button onClick={() => { setGenerating(true); setTimeout(() => setGenerating(false), 2000); }} disabled={generating} className="w-full gap-1.5 bg-blue-600 hover:bg-blue-700 text-sm">
              {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
              {generating ? 'Generálás...' : 'Mind generálása'}
            </Button>
            <Button variant="outline" className="w-full gap-1.5 text-sm"><Download className="w-3.5 h-3.5" /> Tömeges ZIP letöltés</Button>
            <Button variant="outline" className="w-full gap-1.5 text-sm"><Printer className="w-3.5 h-3.5" /> Nyomtatás</Button>
          </div>
        </div>
      </div>

      {/* Legal content info */}
      <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 text-xs text-blue-800 dark:text-blue-300">
        <strong>Mt. 155. § (2) — Kötelező tartalom:</strong> Azonosítók, Időadatok, Bruttó elemek jogcímenként, Levonások tételesen, Nettó összeg, Munkáltatói közterhek, Szabadságkeret.
      </div>

      {/* Payslip list */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Bérjegyzékek ({slips.length} fő)</h2>
          <span className="text-xs text-emerald-600 font-bold">{generatedCount}/{slips.length} generálva</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/30 dark:bg-slate-900/20">
                <th className="text-left px-5 py-2 text-xs font-bold text-slate-500">Munkavállaló</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-slate-500">Bruttó</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-slate-500">SZJA</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-slate-500">TB</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 text-emerald-600">Nettó</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Óra</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Szab.</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Státusz</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {slips.map(slip => (
                <tr key={slip.id} className={cn('border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors', slip.status === 'flagged' && 'bg-yellow-50/50 dark:bg-yellow-500/5')}>
                  <td className="px-5 py-2.5">
                    <p className="font-medium">{slip.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{slip.tajNumber}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs">{fmt(slip.grossSalary)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-red-500">-{fmt(slip.szja)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs text-red-500">-{fmt(slip.tb)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-emerald-600">{fmt(slip.netSalary)}</td>
                  <td className="px-3 py-2.5 text-center text-xs">{slip.workedHours}</td>
                  <td className="px-3 py-2.5 text-center text-xs">{slip.leaveUsed}/{slip.leaveUsed + slip.leaveRemaining}</td>
                  <td className="px-3 py-2.5 text-center">
                    {slip.status === 'generated' && <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />}
                    {slip.status === 'pending' && <Clock className="w-4 h-4 text-slate-400 mx-auto" />}
                    {slip.status === 'flagged' && <AlertTriangle className="w-4 h-4 text-yellow-500 mx-auto" />}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Download className="w-3 h-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-t border-border flex items-center justify-between text-xs text-slate-500">
          <span>Összesen: Bruttó {fmt(slips.reduce((s, sl) => s + sl.grossSalary, 0))} Ft | Nettó {fmt(slips.reduce((s, sl) => s + sl.netSalary, 0))} Ft</span>
          <span>SZOCHO összesen: {fmt(slips.reduce((s, sl) => s + sl.szocho, 0))} Ft (13%)</span>
        </div>
      </div>
    </div>
  );
}
