import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, CreditCard, Download, CheckCircle, AlertTriangle,
  Copy, Eye, RefreshCw, Send, Building, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TransferRow {
  id: string;
  name: string;
  bankName: string;
  iban: string;
  netAmount: number;
  status: 'pending' | 'ready' | 'sent';
  note?: string;
}

const MOCK_TRANSFERS: TransferRow[] = [
  { id: '1', name: 'Nagy Anna', bankName: 'OTP Bank', iban: 'HU42 1177 3016 1111 1018 0000 0000', netAmount: 299250, status: 'ready' },
  { id: '2', name: 'Kiss Béla', bankName: 'K&H Bank', iban: 'HU93 1040 2166 2222 2017 0000 0000', netAmount: 252700, status: 'ready' },
  { id: '3', name: 'Tóth Éva', bankName: 'Erste Bank', iban: 'HU12 1160 0006 3333 3018 0000 0000', netAmount: 214662, status: 'pending', note: 'IBAN hiányzik — ellenőrizni!' },
  { id: '4', name: 'Szabó Péter', bankName: 'OTP Bank', iban: 'HU78 1177 3016 4444 4018 0000 0000', netAmount: 345800, status: 'ready' },
  { id: '5', name: 'Horváth Dávid', bankName: 'Raiffeisen', iban: 'HU55 1200 0001 5555 5018 0000 0000', netAmount: 399000, status: 'ready' },
];

export default function TransferListPage() {
  const { id } = useParams<{ id: string }>();
  const [transfers, setTransfers] = useState(MOCK_TRANSFERS);
  const [exportFormat, setExportFormat] = useState<'mt940' | 'sepa' | 'csv'>('sepa');
  const [generated, setGenerated] = useState(false);

  const fmt = (n: number) => n.toLocaleString('hu-HU');
  const readyCount = transfers.filter(t => t.status === 'ready').length;
  const totalAmount = transfers.filter(t => t.status === 'ready').reduce((s, t) => s + t.netAmount, 0);

  const handleGenerate = () => { setGenerated(true); setTimeout(() => setGenerated(false), 2000); };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}/documents`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25"><CreditCard className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">Utalási lista</h1>
            <p className="text-sm text-slate-500">2026. május — Bér utalási állomány generálás</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <select value={exportFormat} onChange={e => setExportFormat(e.target.value as any)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="sepa">SEPA XML</option>
            <option value="mt940">MT940</option>
            <option value="csv">CSV (egyedi)</option>
          </select>
          <Button onClick={handleGenerate} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
            {generated ? <CheckCircle className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {generated ? 'Letöltve ✓' : `Exportálás (${exportFormat.toUpperCase()})`}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{transfers.length}</p>
          <p className="text-xs text-slate-500">Összes tétel</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{readyCount}</p>
          <p className="text-xs text-slate-500">Utalásra kész</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-lg font-bold font-mono text-emerald-600">{fmt(totalAmount)} Ft</p>
          <p className="text-xs text-slate-500">Összes nettó</p>
        </div>
      </div>

      {/* Source account */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Forrás számla</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-mono">HU98 1177 3016 9999 0018 0000 0000 — OTP Bank</p>
          </div>
        </div>
        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Egyenleg: 12 540 000 Ft</p>
      </div>

      {/* Transfer table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Utalási tételek</h2>
          <span className="text-xs text-emerald-600 font-bold">{readyCount}/{transfers.length} kész</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50/30">
              <th className="text-left px-5 py-2 text-xs font-bold text-slate-500">Kedvezményezett</th>
              <th className="text-left px-3 py-2 text-xs font-bold text-slate-500">Bank</th>
              <th className="text-left px-3 py-2 text-xs font-bold text-slate-500">IBAN</th>
              <th className="text-right px-3 py-2 text-xs font-bold text-slate-500">Nettó összeg</th>
              <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Státusz</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map(t => (
              <tr key={t.id} className={cn('border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50', t.status === 'pending' && 'bg-yellow-50/30 dark:bg-yellow-500/5')}>
                <td className="px-5 py-2.5 font-medium">{t.name}</td>
                <td className="px-3 py-2.5 text-xs text-slate-500">{t.bankName}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{t.iban}</td>
                <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">{fmt(t.netAmount)}</td>
                <td className="px-3 py-2.5 text-center">
                  {t.status === 'ready' && <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />}
                  {t.status === 'pending' && (
                    <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold" title={t.note}>⚠️ Ellenőrizni</span>
                  )}
                  {t.status === 'sent' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Utalva</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
              <td colSpan={3} className="px-5 py-2 text-xs">Összesen ({readyCount} tétel)</td>
              <td className="px-3 py-2 text-right font-mono text-emerald-600">{fmt(totalAmount)} Ft</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
