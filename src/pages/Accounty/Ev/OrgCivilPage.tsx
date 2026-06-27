import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Building2, Heart, Shield, FileText,
  Calendar, TrendingUp, Users, AlertTriangle, CheckCircle2, Info,
  Download, Plus, Edit2, Trash2, ExternalLink, Scale, BookOpen, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useEvClientSettings, useCashbookEntries, type PenztarkonyvTetel } from '@/hooks/useEvData';

// ─── Types ──────────────────────────────────────────────────────────────────

interface IncomeRow {
  category: string;
  amount: number;
  isBusinessIncome: boolean;
}

interface ExpenseRow {
  category: string;
  amount: number;
  type: 'core' | 'business' | 'overhead';
}

type TabId = 'overview' | 'income' | 'expenses' | 'reports' | 'obligations';

// ─── Category mapping ───────────────────────────────────────────────────────

const INCOME_CATEGORY_LABELS: Record<string, { label: string; isBusiness: boolean }> = {
  bevetel_adokoteles: { label: 'Adóköteles bevétel', isBusiness: true },
  bevetel_fizetendo_afa: { label: 'Fizetendő ÁFA', isBusiness: true },
  bevetel_be_nem_szamito: { label: 'Be nem számító bevétel', isBusiness: false },
};

const EXPENSE_CATEGORY_LABELS: Record<string, { label: string; type: 'core' | 'business' | 'overhead' }> = {
  kiadas_anyag_arubeszerzes: { label: 'Anyag- és árubeszerzés', type: 'business' },
  kiadas_kozvetitett_szolgaltatas: { label: 'Közvetített szolgáltatás', type: 'business' },
  kiadas_alkalmazott_ber_kozteher: { label: 'Alkalmazott bér + közteher', type: 'overhead' },
  kiadas_vallalkozoi_kivet: { label: 'Vállalkozói kivét', type: 'business' },
  kiadas_egyeb_koltseg: { label: 'Egyéb költség', type: 'overhead' },
  kiadas_beruhazasi_koltseg: { label: 'Beruházási költség', type: 'business' },
  kiadas_levonhato_afa: { label: 'Levonható ÁFA', type: 'business' },
  kiadas_egyeb_nem_koltseg: { label: 'Egyéb nem költség', type: 'overhead' },
};

const ORG_TYPE_LABELS: Record<string, string> = {
  egyesulet: 'Egyesület',
  alapitvany: 'Alapítvány',
  egyhaz: 'Egyházi szervezet',
  tarsashaz: 'Társasház',
  lakasszov: 'Lakásszövetkezet',
  mrp: 'MRP szervezet',
  egyeb: 'Egyéb szervezet',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function OrgCivilPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const { data: settings, isLoading: settingsLoading } = useEvClientSettings(id, 2026);
  const { data: entries, isLoading: entriesLoading } = useCashbookEntries(id, 2026);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const isLoading = settingsLoading || entriesLoading;

  // Derive income rows from cashbook entries
  const incomeRows = useMemo<IncomeRow[]>(() => {
    if (!entries?.length) return [];
    const categoryMap = new Map<string, { amount: number; isBusiness: boolean }>();

    entries.filter((e: PenztarkonyvTetel) => e.entry_direction === 'bevetel' && !e.is_storno)
      .forEach((e: PenztarkonyvTetel) => {
        const cat = e.main_category;
        const meta = INCOME_CATEGORY_LABELS[cat] || { label: e.description || cat, isBusiness: false };
        // Group by description for more granular view
        const key = e.description || meta.label;
        const existing = categoryMap.get(key) || { amount: 0, isBusiness: meta.isBusiness };
        existing.amount += e.amount || 0;
        categoryMap.set(key, existing);
      });

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        isBusinessIncome: data.isBusiness,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [entries]);

  // Derive expense rows from cashbook entries
  const expenseRows = useMemo<ExpenseRow[]>(() => {
    if (!entries?.length) return [];
    const categoryMap = new Map<string, { amount: number; type: 'core' | 'business' | 'overhead' }>();

    entries.filter((e: PenztarkonyvTetel) => e.entry_direction === 'kiadas' && !e.is_storno)
      .forEach((e: PenztarkonyvTetel) => {
        const cat = e.main_category;
        const meta = EXPENSE_CATEGORY_LABELS[cat] || { label: e.description || cat, type: 'overhead' as const };
        const key = e.description || meta.label;
        const existing = categoryMap.get(key) || { amount: 0, type: meta.type };
        existing.amount += e.amount || 0;
        categoryMap.set(key, existing);
      });

    return Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        amount: data.amount,
        type: data.type,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [entries]);

  const totalIncome = incomeRows.reduce((s, r) => s + r.amount, 0);
  const businessIncome = incomeRows.filter(r => r.isBusinessIncome).reduce((s, r) => s + r.amount, 0);
  const coreIncome = totalIncome - businessIncome;
  const totalExpenses = expenseRows.reduce((s, r) => s + r.amount, 0);
  const balance = totalIncome - totalExpenses;

  const orgType = settings?.org_type || 'egyesulet';
  const isPublicBenefit = settings?.is_public_benefit ?? false;
  const orgName = client?.name || 'Szervezet';

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Áttekintés', icon: Building2 },
    { id: 'income', label: 'Bevételek', icon: TrendingUp },
    { id: 'expenses', label: 'Kiadások', icon: FileText },
    { id: 'reports', label: 'Beszámolók', icon: BookOpen },
    { id: 'obligations', label: 'Kötelezettségek', icon: Scale },
  ];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Áttekintés
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Egyesület / Alapítvány</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl shadow-lg">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{orgName}</h1>
            <p className="text-sm text-slate-500">
              {ORG_TYPE_LABELS[orgType] || orgType} ·
              {isPublicBenefit && <span className="text-green-600 font-medium"> Közhasznú</span>} ·
              {' '}{client?.tax_number || '-'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white dark:bg-slate-800 border border-border rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <Download className="w-3 h-3" /> Export
          </button>
        </div>
      </div>

      {/* KPI summary */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Összes bevétel', value: formatHuf(totalIncome), color: 'text-green-600', sub: '2026 YTD' },
            { label: 'Alaptevékenység', value: formatHuf(coreIncome), color: 'text-blue-600', sub: totalIncome > 0 ? `${((coreIncome / totalIncome) * 100).toFixed(0)}% arány` : '-' },
            { label: 'Vállalkozási bevétel', value: formatHuf(businessIncome), color: 'text-amber-600', sub: totalIncome > 0 ? `${((businessIncome / totalIncome) * 100).toFixed(0)}% arány` : '-' },
            { label: 'Egyenleg', value: formatHuf(balance), color: balance >= 0 ? 'text-green-600' : 'text-red-600', sub: balance >= 0 ? 'Pozitív' : 'Negatív' },
          ].map((kpi, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{kpi.label}</p>
              <p className={cn('text-lg font-bold font-mono tabular-nums', kpi.color)}>{kpi.value}</p>
              <p className="text-[10px] text-slate-400">{kpi.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-[1px]',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Organization details */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Szervezeti adatok
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-xs">
              {[
                { label: 'Nyilvántartási szám', value: settings?.registration_number || '-' },
                { label: 'Adószám', value: client?.tax_number || '-' },
                { label: 'Fő tevékenység', value: settings?.main_activity_code || '-' },
                { label: 'Szervezeti forma', value: ORG_TYPE_LABELS[orgType] || orgType },
                { label: 'Közhasznúság', value: isPublicBenefit ? 'Közhasznú' : 'Nem közhasznú' },
                { label: 'Könyvvezetés', value: settings?.bookkeeping_mode === 'kettos' ? 'Kettős könyvvitel' : 'Egyszeres könyvvitel' },
              ].map((row, i) => (
                <div key={i}>
                  <p className="text-slate-400 font-medium">{row.label}</p>
                  <p className="text-slate-900 dark:text-slate-100 font-semibold mt-0.5">{row.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Public benefit requirements */}
          {isPublicBenefit && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-600" /> Közhasznúsági feltételek teljesítése
              </h3>
              <div className="space-y-2">
                {(() => {
                  const coreRatio = totalIncome > 0 ? (coreIncome / totalIncome) * 100 : 0;
                  return [
                    { name: 'Erőforrás-felhasználás: cél szerinti ≥ 50%', met: coreRatio >= 50, value: totalIncome > 0 ? `${coreRatio.toFixed(0)}%` : 'Nincs adat' },
                    { name: 'Közhasznú tevékenység társadalmi hasznosulása', met: true, value: 'Dokumentált' },
                    { name: 'Közhasznúsági melléklet benyújtása', met: false, value: 'Határidő: 2027.05.31' },
                    { name: 'Éves beszámoló letétbe helyezése', met: false, value: 'Határidő: 2027.05.31' },
                  ];
                })().map((req, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {req.met
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    }
                    <span className="flex-1 text-slate-600 dark:text-slate-400">{req.name}</span>
                    <span className={cn('font-mono text-[11px]', req.met ? 'text-green-600' : 'text-amber-600')}>{req.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'income' && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-slate-50 dark:bg-slate-900/30">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-left">Bevétel kategória</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Összeg</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">Típus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {incomeRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">Nincs bevételi tétel</td>
                  </tr>
                ) : (
                  incomeRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">{row.category}</td>
                      <td className="px-4 py-2.5 text-sm font-mono tabular-nums text-right text-slate-700 dark:text-slate-300">{formatHuf(row.amount)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold',
                          row.isBusinessIncome
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        )}>
                          {row.isBusinessIncome ? 'Vállalkozási' : 'Alaptevékenység'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {incomeRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-slate-50 dark:bg-slate-900/30">
                    <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-slate-100">Összesen</td>
                    <td className="px-4 py-3 text-sm font-bold font-mono tabular-nums text-right text-green-600">{formatHuf(totalIncome)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-slate-50 dark:bg-slate-900/30">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-left">Kiadás kategória</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Összeg</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-center">Típus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {expenseRows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-400">Nincs kiadási tétel</td>
                  </tr>
                ) : (
                  expenseRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">{row.category}</td>
                      <td className="px-4 py-2.5 text-sm font-mono tabular-nums text-right text-slate-700 dark:text-slate-300">{formatHuf(row.amount)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold',
                          row.type === 'core' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : row.type === 'business' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        )}>
                          {row.type === 'core' ? 'Céltevékenység' : row.type === 'business' ? 'Vállalkozási' : 'Működési'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {expenseRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-slate-50 dark:bg-slate-900/30">
                    <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-slate-100">Összesen</td>
                    <td className="px-4 py-3 text-sm font-bold font-mono tabular-nums text-right text-red-600">{formatHuf(totalExpenses)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-3 animate-in fade-in duration-300">
          {[
            { name: 'Közhasznúsági melléklet — 2025', status: 'Benyújtva', date: '2026.05.28', statusColor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
            { name: 'Egyszerűsített éves beszámoló — 2025', status: 'Letétbe helyezve', date: '2026.05.30', statusColor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
            { name: 'Közhasznúsági melléklet — 2026', status: 'Előkészítés', date: 'Határidő: 2027.05.31', statusColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
            { name: 'Egyszerűsített éves beszámoló — 2026', status: 'Nem kezdett', date: 'Határidő: 2027.05.31', statusColor: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
          ].map((report, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <FileText className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">{report.name}</p>
                <p className="text-xs text-slate-400">{report.date}</p>
              </div>
              <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold', report.statusColor)}>
                {report.status}
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </div>
          ))}
        </div>
      )}

      {activeTab === 'obligations' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Éves kötelezettségek</h3>
            <div className="space-y-2">
              {[
                { task: 'Beszámoló elkészítése és letétbe helyezése', deadline: 'Május 31.', ref: 'Szt. 154. §', done: false },
                { task: 'Közhasznúsági melléklet (ha közhasznú)', deadline: 'Május 31.', ref: '2011. CLXXV. tv. 29. §', done: false },
                { task: 'Társasági adó bevallás (29-es bevallás)', deadline: 'Május 31.', ref: 'Tao tv. 9. §', done: false },
                { task: '1% felajánlás igénylése (SZJA 1%)', deadline: 'Szeptember 30.', ref: '1996. CXXVI. tv.', done: false },
                { task: 'ÁFA bevallás (ha áfa-alany)', deadline: 'Havi/negyedéves', ref: 'Áfa tv.', done: false },
                { task: 'OBH felé adatszolgáltatás', deadline: 'Június 30.', ref: '2011. CLXXV. tv.', done: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-xs p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className={cn('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0',
                    item.done ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-slate-600'
                  )}>
                    {item.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <span className="flex-1 text-slate-700 dark:text-slate-300">{item.task}</span>
                  <span className="text-slate-400 font-mono text-[11px]">{item.deadline}</span>
                  <span className="text-slate-400 text-[10px]">{item.ref}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
