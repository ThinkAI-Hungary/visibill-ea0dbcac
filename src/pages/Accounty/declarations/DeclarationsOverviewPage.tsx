import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Plus, CheckCircle, Clock, AlertTriangle, Users,
  Heart, Baby, Cake, CircleDot, Star, Eye, ChevronRight, Shield, Loader2, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDeclarations, type Declaration } from '@/hooks/useAccountyData';

const DECLARATION_TYPES = [
  { id: 'family', label: 'Családi kedvezmény', icon: Users, color: 'from-blue-500 to-indigo-500', desc: '1-3+ gyermek után járó adóalap-csökkentés', route: 'family', saving: '20 000 – 66 000 Ft/gyermek/hó' },
  { id: 'netak', label: 'NÉTAK — 4+ gyermek', icon: Star, color: 'from-amber-500 to-orange-500', desc: 'Négy vagy több gyermekes anyák kedvezménye — teljes SZJA mentesség', route: 'netak', saving: 'Teljes SZJA mentesség' },
  { id: 'mothers', label: '30 év alatti anyák', icon: Baby, color: 'from-pink-500 to-rose-500', desc: '30 év alatti, legalább 2 gyermekes anyák SZJA kedvezménye', route: 'mothers', saving: 'Max havi 107 650 Ft' },
  { id: 'young', label: '25 év alattiak kedvezménye', icon: Cake, color: 'from-green-500 to-emerald-500', desc: '25 év alatti fiatalok SZJA mentessége a bruttó átlagkeresetig', route: 'young', saving: 'Max havi 715 765 Ft adóalap' },
  { id: 'first_marriage', label: 'Első házasok kedvezménye', icon: CircleDot, color: 'from-violet-500 to-purple-500', desc: 'Első házasságkötéstől 24 hónapig járó kedvezmény', route: 'first-marriage', saving: '5 000 Ft/hó' },
  { id: 'personal', label: 'Személyi kedvezmény', icon: Heart, color: 'from-red-500 to-pink-500', desc: 'Súlyos fogyatékosság / rokkantság esetén járó kedvezmény', route: 'personal', saving: '16 140 Ft/hó' },
];

const PRIORITY_ORDER = [
  { num: 1, label: 'NÉTAK (4+ gyermek)', type: 'netak' },
  { num: 2, label: '30 év alatti anyák', type: 'mothers' },
  { num: 3, label: '25 év alattiak', type: 'young' },
  { num: 4, label: 'Személyi kedvezmény', type: 'personal' },
  { num: 5, label: 'Első házasok', type: 'first_marriage' },
  { num: 6, label: 'Családi kedvezmény', type: 'family' },
];

export default function DeclarationsOverviewPage() {
  const { id, empId } = useParams<{ id: string; empId: string }>();
  const [showPriority, setShowPriority] = useState(false);
  const { data: declarations, isLoading } = useDeclarations(id || '');

  const declList = declarations || [];
  const activeDecls = declList.filter(d => d.status === 'active');
  const expiredDecls = declList.filter(d => d.status === 'expired' || d.status === 'archived');
  const totalMonthlySaving = activeDecls.reduce((s, d) => s + (d.data?.monthlySaving || 0), 0);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/25"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Adóelőleg-nyilatkozatok</h1>
            <p className="text-sm text-slate-500">SZJA kedvezmények és nyilatkozatok kezelése</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/accounty/payroll/${id}/declarations/archive`}>
            <Button variant="outline" className="gap-1.5 text-sm"><Database className="w-4 h-4" /> Archívum</Button>
          </Link>
          <Button variant="outline" onClick={() => setShowPriority(!showPriority)} className="gap-1.5 text-sm"><Shield className="w-4 h-4" /> Érvényesítési sorrend</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-slate-500 uppercase font-bold">Aktív nyilatkozatok</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{activeDecls.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-slate-500 uppercase font-bold">Havi megtakarítás</p>
          <p className="text-2xl font-bold text-blue-600 font-mono mt-1">{totalMonthlySaving.toLocaleString('hu-HU')} Ft</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs text-slate-500 uppercase font-bold">Éves megtakarítás</p>
          <p className="text-2xl font-bold text-indigo-600 font-mono mt-1">{(totalMonthlySaving * 12).toLocaleString('hu-HU')} Ft</p>
        </div>
      </div>

      {showPriority && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20 p-5">
          <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-3">Törvényi érvényesítési sorrend (Szja tv.)</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">Az SZJA kedvezmények az alábbi sorrendben érvényesíthetők:</p>
          <div className="space-y-1.5">
            {PRIORITY_ORDER.map(p => {
              const hasActive = activeDecls.some(d => d.type === p.type);
              return (
                <div key={p.num} className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm', hasActive ? 'bg-emerald-100/50 dark:bg-emerald-500/10' : 'opacity-50')}>
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">{p.num}</span>
                  <span className="font-medium">{p.label}</span>
                  {hasActive && <CheckCircle className="w-4 h-4 text-emerald-600 ml-auto" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Declaration type cards */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Új nyilatkozat hozzáadása</h3>
        <div className="grid grid-cols-3 gap-3">
          {DECLARATION_TYPES.map(dt => (
            <Link key={dt.id} to={`/accounty/payroll/${id}/declarations/${dt.route}${empId ? `?empId=${empId}` : ''}`} className="p-4 rounded-xl border border-border hover:border-blue-300 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
              <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform', dt.color)}><dt.icon className="w-4 h-4" /></div>
              <p className="text-sm font-bold">{dt.label}</p>
              <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{dt.desc}</p>
              <p className="text-[10px] text-emerald-600 font-bold mt-1"> {dt.saving}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Active declarations list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-24 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
      ) : activeDecls.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-10 text-center">
          <Database className="w-8 h-8 mx-auto text-slate-400 mb-2" />
          <p className="text-sm text-slate-500">Nincsenek aktív nyilatkozatok.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border dark:bg-slate-900/30 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Aktív nyilatkozatok</h2>
            <span className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">{activeDecls.length}</span>
          </div>
          <div className="divide-y divide-border/50">
            {activeDecls.map(decl => {
              const dt = DECLARATION_TYPES.find(t => t.id === decl.type);
              return (
                <div key={decl.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br text-white flex items-center justify-center', dt?.color || 'from-slate-400 to-slate-500')}>
                    {dt && <dt.icon className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{dt?.label}</p>
                    <p className="text-xs text-slate-500">{decl.data?.employeeName || ''} — {decl.data?.details || ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono text-emerald-600">-{(decl.data?.monthlySaving || 0).toLocaleString('hu-HU')} Ft/hó</p>
                    <p className="text-[10px] text-slate-400">{decl.data?.startDate || ''} → {decl.data?.endDate || 'visszavonásig'}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                    <Link to={`/accounty/payroll/${id}/declarations/${dt?.route || decl.type}${decl.employeeId ? `?empId=${decl.employeeId}` : ''}`}><Eye className="w-3.5 h-3.5" /></Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {expiredDecls.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden opacity-60">
          <div className="px-5 py-3 border-b border-border dark:bg-slate-900/30"><h2 className="text-sm font-bold text-slate-400">Lejárt / Visszavont nyilatkozatok</h2></div>
          <div className="divide-y divide-border/50">
            {expiredDecls.map(decl => {
              const dt = DECLARATION_TYPES.find(t => t.id === decl.type);
              return (
                <div key={decl.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">{dt && <dt.icon className="w-4 h-4 text-slate-400" />}</div>
                  <div className="flex-1"><p className="text-sm text-slate-500">{dt?.label} — {decl.data?.employeeName || ''}</p></div>
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Lejárt</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
