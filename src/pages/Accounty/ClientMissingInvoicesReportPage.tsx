import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, TrendingUp, CheckCircle2, Clock, Zap, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/accounty/ExportButton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAccountyClients, useAccountyMissingItems } from '@/hooks/accounty';

const defaultBarData = [
  { name: 'Aug', requested: 12, resolved: 10 },
  { name: 'Sep', requested: 18, resolved: 15 },
  { name: 'Oct', requested: 15, resolved: 14 },
  { name: 'Nov', requested: 22, resolved: 18 },
  { name: 'Dec', requested: 20, resolved: 17 },
  { name: 'Jan', requested: 25, resolved: 19 },
];

const defaultPieData = [
  { name: 'Bejövő', value: 45 },
  { name: 'Kimenő', value: 25 },
  { name: 'Bank', value: 20 },
  { name: 'Bér', value: 10 },
];
const COLORS = ['hsl(173, 80%, 40%)', '#334155', '#64748B', '#94A3B8'];

export default function ClientMissingInvoicesReportPage() {
  const navigate = useNavigate();
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  
  const { data: clients } = useAccountyClients();
  const { data: missingItems } = useAccountyMissingItems(id || '');

  const clientName = useMemo(() => {
    const found = clients?.find(c => c.id === id);
    return found?.name || 'Betöltés...';
  }, [clients, id]);

  // Build KPIs from real missing items
  const kpis = useMemo(() => {
    if (!missingItems) return { requested: 0, resolved: 0, successRate: 0, pending: 0 };
    const requested = missingItems.length;
    const resolved = missingItems.filter(mi => mi.status === 'resolved').length;
    const ignored = missingItems.filter(mi => mi.status === 'ignored').length;
    const pending = missingItems.filter(mi => mi.status === 'pending').length;
    const successRate = requested > 0 ? Math.round(((resolved + ignored) / requested) * 100) : 0;
    return { requested, resolved, successRate, pending };
  }, [missingItems]);



  // Dynamic pie: category breakdown
  const dynamicPieData = useMemo(() => {
    if (!missingItems || missingItems.length === 0) return defaultPieData;
    const cats: Record<string, number> = {};
    const catLabels: Record<string, string> = { bejovo: 'Bejövő', kimeno: 'Kimenő', bank: 'Bank', ber: 'Bér' };
    missingItems.forEach(mi => {
      const label = catLabels[mi.category] || mi.category;
      cats[label] = (cats[label] || 0) + 1;
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value }));
  }, [missingItems]);

  // Dynamic bar: status breakdown as simple chart
  const dynamicBarData = useMemo(() => {
    if (!missingItems || missingItems.length === 0) return defaultBarData;
    const pending = missingItems.filter(mi => mi.status === 'pending').length;
    const resolved = missingItems.filter(mi => mi.status === 'resolved').length;
    const ignored = missingItems.filter(mi => mi.status === 'ignored').length;
    return [
      { name: 'Függőben', requested: pending, resolved: 0 },
      { name: 'Megoldott', requested: 0, resolved },
      { name: 'Ignorált', requested: ignored, resolved: 0 },
    ];
  }, [missingItems]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-24">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-4">
          <button 
            onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate(`/accounty/${companyId}/${dateRange}/reports`);
              }
            }}
            className="flex items-center justify-center w-8 h-8 mt-1 shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
            title="Vissza"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {clientName === 'Betöltés...' ? (
                <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              ) : (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{clientName}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Hiányzó számlák riport</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ügyfél-specifikus statisztikák és elemzések</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Select defaultValue="last_month">
            <SelectTrigger className="w-[180px] bg-card border-border">
              <SelectValue placeholder="Elmúlt hónap" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_month">Elmúlt hónap</SelectItem>
              <SelectItem value="last_quarter">Elmúlt negyedév</SelectItem>
              <SelectItem value="this_year">Idei év</SelectItem>
            </SelectContent>
          </Select>

          <ExportButton
            filename={`ugyfel_hianyzok_${id}_${new Date().toISOString().split('T')[0]}`}
            headers={['Dokumentum', 'Kategória', 'Állapot', 'Létrehozva']}
            label="Riport Exportálása"
            getRows={() => (missingItems || []).map(r => {
              const typeMap: Record<string, string> = { bejovo: 'Bejövő', kimeno: 'Kimenő', bank: 'Bank', ber: 'Bér' };
              const statusMap: Record<string, string> = { pending: 'Feldolgozandó', notified: 'Felszólítva', resolved: 'Rendben', ignored: 'Mellőzve' };
              return [
                r.description,
                typeMap[r.category] || r.category,
                statusMap[r.status] || r.status,
                new Date(r.created_at).toLocaleDateString('hu-HU')
              ];
            })}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Összes hiányzó tétel</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{kpis.requested}</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500 font-medium">
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            Supabase adat
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Megoldott</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{kpis.resolved}</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-primary font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            {kpis.successRate}% kezelt
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Függőben</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{kpis.pending}</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-amber-600 font-medium">
            <Clock className="w-3.5 h-3.5 mr-1" />
            Várakozik
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-soft">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Sikerességi arány</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{kpis.successRate}%</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-primary font-medium">
            <Zap className="w-3.5 h-3.5 mr-1" />
            Megoldott + Ignorált
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bar Chart */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-soft">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Státusz bontás</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Függőben / megoldott / ignorált</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dynamicBarData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }} />
                <Bar dataKey="requested" name="Kérések" fill="hsl(173, 80%, 40%)" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="resolved" name="Megoldott" fill="#475569" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-soft flex flex-col">
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Kategória bontás</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Hiányzó tételek kategóriánként</p>
          </div>
          <div className="flex-1 flex items-center justify-center -mt-4">
            <div className="h-48 w-full max-w-xs relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dynamicPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {dynamicPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Custom Legend to match screenshot closely */}
              <div className="flex justify-center gap-4 mt-2">
                {dynamicPieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                    {entry.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-xs font-medium text-slate-600 dark:text-slate-400 px-4">
            {dynamicPieData.map((entry, index) => (
              <div key={entry.name} className="flex justify-between items-center">
                <span className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  {entry.name}:
                </span>
                <span>{entry.value} db</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden pb-4">
        <div className="p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Összesítés</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{clientName} hiányzó tételeinek részletes bontása</p>
        </div>
        
        <table className="w-full text-sm text-left mt-2">
          <thead className="bg-card border-b border-border text-slate-500 dark:text-slate-400 text-xs">
            <tr>
              <th className="px-6 py-4 font-medium">Kategória</th>
              <th className="px-6 py-4 font-medium text-center">Összes</th>
              <th className="px-6 py-4 font-medium text-center">Megoldott</th>
              <th className="px-6 py-4 font-medium text-center">Függőben</th>
              <th className="px-6 py-4 font-medium">Arány</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {(() => {
              if (!missingItems || missingItems.length === 0) {
                return (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                      Nincs megjeleníthető adat.
                    </td>
                  </tr>
                );
              }
              const catLabels: Record<string, string> = { bejovo: ' Bejövő', kimeno: ' Kimenő', bank: ' Bank', ber: ' Bér' };
              const cats = ['bejovo', 'kimeno', 'bank', 'ber'];
              return cats.map(cat => {
                const items = missingItems.filter(mi => mi.category === cat);
                const total = items.length;
                if (total === 0) return null;
                const resolved = items.filter(mi => mi.status === 'resolved' || mi.status === 'ignored').length;
                const pending = items.filter(mi => mi.status === 'pending').length;
                const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;
                return (
                  <tr key={cat} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">{catLabels[cat] || cat}</td>
                    <td className="px-6 py-4 text-center font-medium text-slate-700 dark:text-slate-300">{total}</td>
                    <td className="px-6 py-4 text-center font-medium text-primary">{resolved}</td>
                    <td className="px-6 py-4 text-center font-medium text-amber-600">{pending}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-24 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${pct < 50 ? 'bg-red-500' : pct < 80 ? 'bg-amber-500' : 'bg-primary'}`} 
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                        <span className={`text-xs font-bold ${pct < 50 ? 'text-red-500' : pct < 80 ? 'text-amber-500' : 'text-primary'}`}>
                          {pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              }).filter(Boolean);
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
