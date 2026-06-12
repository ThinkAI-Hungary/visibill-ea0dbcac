import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Send, CheckCircle, Clock,
  AlertTriangle, Loader2, Database, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useFilings, type Filing } from '@/hooks/useAccountyData';

const fmt = (n: number) => n.toLocaleString('hu-HU') + ' Ft';

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft: { label: 'Piszkozat', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
  ready: { label: 'Ellenőrizendő', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  submitted: { label: 'Beküldve', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
  accepted: { label: 'Elfogadva', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
};

export default function Filing2608Page() {
  const { id } = useParams<{ id: string }>();
  const [period, setPeriod] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const { data: filings, isLoading } = useFilings(id || '', '2608');

  const currentFiling = (filings || []).find(f => f.period === period);
  const alapRows = (currentFiling?.data?.alapRows || []) as { key: string; label: string; amount: number }[];
  const mlapRows = (currentFiling?.data?.mlapRows || []) as { name: string; tajNumber: string; grossSalary: number; netSalary: number }[];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">2608-as bevallás</h1>
            <p className="text-sm text-slate-500">Havi járulékbevallás</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
      ) : !currentFiling ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
          <Database className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm text-slate-500">Nincs bevallás a kiválasztott időszakra ({period}).</p>
          <p className="text-xs text-slate-400">A bevallás a számfejtés véglegesítése után kerül generálásra.</p>
        </div>
      ) : (
        <>
          {/* Status */}
          <div className="flex items-center gap-3">
            <span className={cn('px-3 py-1 rounded-full text-xs font-bold', STATUS_BADGE[currentFiling.status]?.color)}>{STATUS_BADGE[currentFiling.status]?.label}</span>
            {currentFiling.submittedAt && <span className="text-xs text-slate-400">Beküldve: {new Date(currentFiling.submittedAt).toLocaleDateString('hu-HU')}</span>}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Biztosítottak</p>
              <p className="text-2xl font-bold text-blue-600">{mlapRows.length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Bruttó összesen</p>
              <p className="text-lg font-bold font-mono">{fmt(alapRows.find(r => r.key === 'gross_total')?.amount || 0)}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Családi kedvezmény</p>
              <p className="text-lg font-bold font-mono text-emerald-600">{fmt(alapRows.find(r => r.key === 'family_benefit')?.amount || 0)}</p>
            </div>
          </div>

          {/* A-lap */}
          {alapRows.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
                <h2 className="text-sm font-bold">A-lap — Összesítő</h2>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {alapRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-2 text-xs text-slate-500">{row.label}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs font-bold">{fmt(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* M-lapok */}
          {mlapRows.length > 0 && (
            <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
                <h2 className="text-sm font-bold">M-lapok ({mlapRows.length} fő)</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50/30">
                    <th className="text-left px-5 py-2 text-xs font-bold text-slate-500 uppercase">Név</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">TAJ</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 uppercase">Bruttó</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 uppercase">Nettó</th>
                  </tr>
                </thead>
                <tbody>
                  {mlapRows.map((m, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-5 py-2 font-medium">{m.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500">{m.tajNumber}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{fmt(m.grossSalary)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">{fmt(m.netSalary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="gap-1.5"><Download className="w-4 h-4" /> XML letöltés</Button>
            <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700"><Send className="w-4 h-4" /> Beküldés NAV-nak</Button>
          </div>
        </>
      )}
    </div>
  );
}
