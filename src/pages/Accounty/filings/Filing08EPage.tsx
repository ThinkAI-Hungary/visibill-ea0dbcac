import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Plus, Trash2, Save, CheckCircle, AlertTriangle,
  Clock, Users, Search, ChevronRight, Download, Eye, Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Employee08E {
  id: string;
  name: string;
  tajNumber: string;
  changeType: 'bejelentes' | 'valtozas' | 'kijelentes';
  changeCode: string;
  effectiveDate: string;
  feor: string;
  weeklyHours: number;
  insured: boolean;
  status: 'draft' | 'ready' | 'sent';
}

const CHANGE_CODES = [
  { code: '01', label: 'Biztosítási jogviszony kezdete', type: 'bejelentes' },
  { code: '02', label: 'Jogviszony megszűnése', type: 'kijelentes' },
  { code: '03', label: 'Heti munkaidő változás', type: 'valtozas' },
  { code: '04', label: 'FEOR-kód változás', type: 'valtozas' },
  { code: '05', label: 'Munkáltató személyében bekövetkezett változás', type: 'valtozas' },
  { code: '06', label: 'Munkavégzés helye szerinti telephely változás', type: 'valtozas' },
  { code: '07', label: 'Biztosítás szünetelése', type: 'valtozas' },
  { code: '08', label: 'Biztosítás szünetelésének vége', type: 'valtozas' },
];

const MOCK_ROWS: Employee08E[] = [
  { id: '1', name: 'Kiss Béla', tajNumber: '987 654 321', changeType: 'kijelentes', changeCode: '02', effectiveDate: '2026-06-15', feor: '2412', weeklyHours: 40, insured: true, status: 'ready' },
  { id: '2', name: 'Horváth Dávid', tajNumber: '777 888 999', changeType: 'bejelentes', changeCode: '01', effectiveDate: '2026-06-01', feor: '3119', weeklyHours: 40, insured: true, status: 'draft' },
  { id: '3', name: 'Tóth Éva', tajNumber: '111 222 333', changeType: 'valtozas', changeCode: '03', effectiveDate: '2026-06-01', feor: '4110', weeklyHours: 20, insured: true, status: 'sent' },
];

export default function Filing08EPage() {
  const { id } = useParams<{ id: string }>();
  const [rows, setRows] = useState(MOCK_ROWS);
  const [showAdd, setShowAdd] = useState(false);

  const STATUS_BADGE: Record<string, { label: string; color: string }> = {
    draft: { label: 'Piszkozat', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
    ready: { label: 'Beküldésre kész', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
    sent: { label: 'Beküldve', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
  };

  const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    bejelentes: { label: 'Bejelentés', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
    valtozas: { label: 'Változás', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' },
    kijelentes: { label: 'Kijelentés', color: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}/filings`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/25"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">08E — Biztosítotti bejelentés</h1>
            <p className="text-sm text-slate-500">Art. 50. § — Biztosítotti bejelentés, változás-bejelentés, kijelentés</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAdd(!showAdd)} variant="outline" className="gap-1.5"><Plus className="w-4 h-4" /> Sor hozzáadása</Button>
          <Button className="gap-1.5 bg-blue-600 hover:bg-blue-700"><Send className="w-4 h-4" /> Beküldés a NAV-nak</Button>
        </div>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-xl p-4 text-sm text-yellow-800 dark:text-yellow-300">
        <AlertTriangle className="w-4 h-4 inline mr-1" />
        <strong>Határidő:</strong> A biztosítási jogviszony kezdetét/végét/változását 15 napon belül be kell jelenteni a NAV felé.
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Bejelentés', count: rows.filter(r => r.changeType === 'bejelentes').length, color: 'text-green-600' },
          { label: 'Változás', count: rows.filter(r => r.changeType === 'valtozas').length, color: 'text-yellow-600' },
          { label: 'Kijelentés', count: rows.filter(r => r.changeType === 'kijelentes').length, color: 'text-red-600' },
        ].map(c => (
          <div key={c.label} className="bg-card rounded-xl border border-border p-4 text-center">
            <p className={cn('text-2xl font-bold', c.color)}>{c.count}</p>
            <p className="text-xs text-slate-500">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Change codes reference */}
      <details className="bg-card rounded-xl border border-border">
        <summary className="px-5 py-3 cursor-pointer text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-t-xl">
          Változáskód referencia (kattints a megnyitáshoz)
        </summary>
        <div className="px-5 pb-4 grid grid-cols-2 gap-2">
          {CHANGE_CODES.map(cc => (
            <div key={cc.code} className="flex items-center gap-2 text-sm">
              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs">{cc.code}</span>
              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-bold', TYPE_LABELS[cc.type].color)}>{TYPE_LABELS[cc.type].label}</span>
              <span className="text-slate-600 dark:text-slate-400">{cc.label}</span>
            </div>
          ))}
        </div>
      </details>

      {/* Data table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Bejelentendő sorok ({rows.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/30">
                <th className="text-left px-5 py-2 text-xs font-bold text-slate-500">Munkavállaló</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Típus</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Kód</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Hatály</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">FEOR</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Óra/hét</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Biz.</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Státusz</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-2.5">
                    <p className="font-medium">{row.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{row.tajNumber}</p>
                  </td>
                  <td className="px-3 py-2.5 text-center"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', TYPE_LABELS[row.changeType].color)}>{TYPE_LABELS[row.changeType].label}</span></td>
                  <td className="px-3 py-2.5 text-center"><span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs">{row.changeCode}</span></td>
                  <td className="px-3 py-2.5 text-center text-xs">{row.effectiveDate}</td>
                  <td className="px-3 py-2.5 text-center text-xs font-mono">{row.feor}</td>
                  <td className="px-3 py-2.5 text-center text-xs">{row.weeklyHours}</td>
                  <td className="px-3 py-2.5 text-center">{row.insured ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" /> : <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-center"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', STATUS_BADGE[row.status].color)}>{STATUS_BADGE[row.status].label}</span></td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
