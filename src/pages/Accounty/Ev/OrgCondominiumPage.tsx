import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Home, Building2, Users, FileText,
  Calendar, TrendingUp, AlertTriangle, CheckCircle2, Info,
  Download, Plus, Wallet, Wrench, BarChart2, Scale, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useEvClientSettings, useCashbookEntries, type PenztarkonyvTetel } from '@/hooks/useEvData';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AggregatedItem {
  category: string;
  monthly: number;
  ytd: number;
}

type TabId = 'overview' | 'funds' | 'debtors' | 'maintenance';

const ORG_TYPE_LABELS: Record<string, string> = {
  tarsashaz: 'Társasház',
  lakasszov: 'Lakásszövetkezet',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function OrgCondominiumPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const { data: settings, isLoading: settingsLoading } = useEvClientSettings(id, 2026);
  const { data: entries, isLoading: entriesLoading } = useCashbookEntries(id, 2026);
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const isLoading = settingsLoading || entriesLoading;

  // Current month for monthly average
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const monthsElapsed = Math.max(currentMonth, 1);

  // Aggregate income by description
  const incomeItems = useMemo<AggregatedItem[]>(() => {
    if (!entries?.length) return [];
    const map = new Map<string, number>();

    entries.filter((e: PenztarkonyvTetel) => e.entry_direction === 'bevetel' && !e.is_storno)
      .forEach((e: PenztarkonyvTetel) => {
        const key = e.description || 'Egyéb bevétel';
        map.set(key, (map.get(key) || 0) + (e.amount || 0));
      });

    return Array.from(map.entries())
      .map(([category, ytd]) => ({
        category,
        monthly: Math.round(ytd / monthsElapsed),
        ytd,
      }))
      .sort((a, b) => b.ytd - a.ytd);
  }, [entries, monthsElapsed]);

  // Aggregate expenses by description
  const expenseItems = useMemo<AggregatedItem[]>(() => {
    if (!entries?.length) return [];
    const map = new Map<string, number>();

    entries.filter((e: PenztarkonyvTetel) => e.entry_direction === 'kiadas' && !e.is_storno)
      .forEach((e: PenztarkonyvTetel) => {
        const key = e.description || 'Egyéb kiadás';
        map.set(key, (map.get(key) || 0) + (e.amount || 0));
      });

    return Array.from(map.entries())
      .map(([category, ytd]) => ({
        category,
        monthly: Math.round(ytd / monthsElapsed),
        ytd,
      }))
      .sort((a, b) => b.ytd - a.ytd);
  }, [entries, monthsElapsed]);

  const totalMonthlyIncome = incomeItems.reduce((s, r) => s + r.monthly, 0);
  const totalMonthlyExpense = expenseItems.reduce((s, r) => s + r.monthly, 0);
  const totalYtdIncome = incomeItems.reduce((s, r) => s + r.ytd, 0);
  const totalYtdExpense = expenseItems.reduce((s, r) => s + r.ytd, 0);

  // Fund data — derived from cashbook balance
  const totalFundsBalance = totalYtdIncome - totalYtdExpense;

  const condoName = client?.name || 'Társasház';
  const orgType = settings?.org_type || 'tarsashaz';

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Áttekintés', icon: BarChart2 },
    { id: 'funds', label: 'Pénzalapok', icon: Wallet },
    { id: 'debtors', label: 'Hátralékok', icon: AlertTriangle },
    { id: 'maintenance', label: 'Karbantartás', icon: Wrench },
  ];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Áttekintés
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Társasház</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl shadow-lg">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{condoName}</h1>
            <p className="text-sm text-slate-500">
              {ORG_TYPE_LABELS[orgType] || 'Társasház'} · {client?.tax_number || '-'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white dark:bg-slate-800 border border-border rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <Download className="w-3 h-3" /> Éves elszámolás
          </button>
        </div>
      </div>

      {/* KPI row */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Havi bevétel (átlag)', value: formatHuf(totalMonthlyIncome), color: 'text-green-600' },
            { label: 'Havi kiadás (átlag)', value: formatHuf(totalMonthlyExpense), color: 'text-red-600' },
            { label: 'Havi egyenleg', value: formatHuf(totalMonthlyIncome - totalMonthlyExpense), color: totalMonthlyIncome >= totalMonthlyExpense ? 'text-green-600' : 'text-red-600' },
            { label: 'YTD egyenleg', value: formatHuf(totalFundsBalance), color: totalFundsBalance >= 0 ? 'text-blue-600' : 'text-red-600' },
            { label: 'Tételek (YTD)', value: `${entries?.length || 0}`, color: 'text-slate-900 dark:text-slate-100' },
          ].map((kpi, i) => (
            <div key={i} className="bg-card rounded-xl border border-border p-3 space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{kpi.label}</p>
              <p className={cn('text-lg font-bold font-mono tabular-nums', kpi.color)}>{kpi.value}</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
          {/* Income */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-green-50 dark:bg-green-900/10">
              <h3 className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Bevételek (havi átlag)
              </h3>
            </div>
            <div className="divide-y divide-border/50">
              {incomeItems.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-slate-400">Nincs bevételi tétel</div>
              ) : (
                incomeItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <span className="text-slate-700 dark:text-slate-300">{item.category}</span>
                    <span className="font-mono tabular-nums text-green-600 font-medium">{formatHuf(item.monthly)}</span>
                  </div>
                ))
              )}
              <div className="flex items-center justify-between px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-900/30 font-bold">
                <span className="text-slate-900 dark:text-slate-100">Összesen</span>
                <span className="font-mono tabular-nums text-green-600">{formatHuf(totalMonthlyIncome)}</span>
              </div>
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-red-50 dark:bg-red-900/10">
              <h3 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Kiadások (havi átlag)
              </h3>
            </div>
            <div className="divide-y divide-border/50">
              {expenseItems.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-slate-400">Nincs kiadási tétel</div>
              ) : (
                expenseItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <span className="text-slate-700 dark:text-slate-300">{item.category}</span>
                    <span className="font-mono tabular-nums text-red-600 font-medium">{formatHuf(item.monthly)}</span>
                  </div>
                ))
              )}
              <div className="flex items-center justify-between px-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-900/30 font-bold">
                <span className="text-slate-900 dark:text-slate-100">Összesen</span>
                <span className="font-mono tabular-nums text-red-600">{formatHuf(totalMonthlyExpense)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'funds' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-card rounded-xl border border-border p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-blue-500" />
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Pénzügyi egyenleg (YTD)</p>
            </div>
            <p className={cn('text-2xl font-bold font-mono tabular-nums', totalFundsBalance >= 0 ? 'text-blue-600' : 'text-red-600')}>
              {formatHuf(totalFundsBalance)}
            </p>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-400">YTD Bevétel</p>
                <p className="text-sm font-bold text-green-600 font-mono">{formatHuf(totalYtdIncome)}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/10 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-400">YTD Kiadás</p>
                <p className="text-sm font-bold text-red-600 font-mono">{formatHuf(totalYtdExpense)}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-600 dark:text-blue-400">
                A részletes alap-bontás (közös költség, felújítási alap, tartalék) az analitikus könyvelésben, az egyes bankszámlák alapján érhető el.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'debtors' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-red-50 dark:bg-red-900/10">
              <h3 className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Hátralékos lakók
              </h3>
            </div>
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Users className="w-8 h-8 mb-3 opacity-50" />
              <p className="text-sm font-medium">Hátralék-kezelés</p>
              <p className="text-xs mt-1">A hátralékos lakók nyilvántartása a részletes analitikában elérhető.</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Wrench className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm font-medium">Karbantartási napló</p>
            <p className="text-xs mt-1">A karbantartási tételek a pénztárkönyv alapján követhetők.</p>
          </div>
        </div>
      )}

      {/* Legal info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            <p className="font-semibold">Társasházi törvény — 2003. évi CXXXIII. tv.</p>
            <p>A társasház egyszeres könyvvitelt vezet (Szt. 161. §). Az éves közgyűlésre elkészítendő a számviteli beszámoló és a következő évi költségvetés.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
