import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, CreditCard, Download, CheckCircle, AlertTriangle,
  Copy, Eye, RefreshCw, Send, Building, Users, Loader2, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTransfers, type Transfer } from '@/hooks/useAccountyData';
import { useToast } from '@/hooks/use-toast';

export default function TransferListPage() {
  const { id } = useParams<{ id: string }>();
  const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const { data: transfers, isLoading } = useTransfers(id || '', currentPeriod);
  const [exportFormat, setExportFormat] = useState<'mt940' | 'sepa' | 'csv'>('sepa');
  const [generated, setGenerated] = useState(false);
  const { toast } = useToast();

  const transferList = transfers || [];
  const fmt = (n: number) => n.toLocaleString('hu-HU');
  const readyCount = transferList.filter(t => t.status === 'approved').length;
  const totalAmount = transferList.filter(t => t.status === 'approved').reduce((s, t) => s + t.netSalary, 0);

  const handleGenerate = () => {
    toast({ title: 'Utalási lista generálva ', description: `${exportFormat.toUpperCase()} formátum — ${readyCount} tétel, összesen ${fmt(totalAmount)} Ft` });
    setGenerated(true);
    setTimeout(() => setGenerated(false), 2000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25"><CreditCard className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">Utalási lista</h1>
            <p className="text-sm text-slate-500">{currentPeriod} — Bér utalási állomány</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <select value={exportFormat} onChange={e => setExportFormat(e.target.value as any)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="sepa">SEPA XML</option><option value="mt940">MT940</option><option value="csv">CSV (egyedi)</option>
          </select>
          <Button onClick={handleGenerate} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled={transferList.length === 0}>
            {generated ? <CheckCircle className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            {generated ? 'Letöltve ' : `Exportálás (${exportFormat.toUpperCase()})`}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
      ) : transferList.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
          <Database className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm text-slate-500">Nincsenek utalási tételek erre az időszakra ({currentPeriod}).</p>
          <p className="text-xs text-slate-400">Az utalási lista a bérszámfejtés véglegesítése után generálódik.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 text-center"><p className="text-2xl font-bold text-blue-600">{transferList.length}</p><p className="text-xs text-slate-500">Összes tétel</p></div>
            <div className="bg-card rounded-xl border border-border p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{readyCount}</p><p className="text-xs text-slate-500">Utalásra kész</p></div>
            <div className="bg-card rounded-xl border border-border p-4 text-center"><p className="text-lg font-bold font-mono text-emerald-600">{fmt(totalAmount)} Ft</p><p className="text-xs text-slate-500">Összes nettó</p></div>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border dark:bg-slate-900/30 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Utalási tételek</h2>
              <span className="text-xs text-emerald-600 font-bold">{readyCount}/{transferList.length} kész</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-2 text-xs font-bold text-slate-500">Kedvezményezett</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-slate-500">Bankszámla</th>
                  <th className="text-right px-3 py-2 text-xs font-bold text-slate-500">Nettó összeg</th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Státusz</th>
                </tr>
              </thead>
              <tbody>
                {transferList.map(t => (
                  <tr key={t.id} className={cn('border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50', t.status === 'pending' && 'bg-yellow-50/30')}>
                    <td className="px-5 py-2.5 font-medium">{t.employeeName}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{t.bankAccount || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-600">{fmt(t.netSalary)}</td>
                    <td className="px-3 py-2.5 text-center">
                      {t.status === 'approved' && <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />}
                      {t.status === 'pending' && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold"> Ellenőrizni</span>}
                      {t.status === 'sent' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Utalva</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                  <td colSpan={2} className="px-5 py-2 text-xs">Összesen ({readyCount} tétel)</td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-600">{fmt(totalAmount)} Ft</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
