import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Home, Building2, Users, FileText,
  Calendar, TrendingUp, AlertTriangle, CheckCircle2, Info,
  Download, Plus, Wallet, Wrench, BarChart2, Scale, Loader2,
  Edit2, Trash2, Clock, ArrowUpRight, Store, Car, Box, Phone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import {
  useEvClientSettings, useCashbookEntries, type PenztarkonyvTetel,
  useCondoUnits, useCondoFunds, useCondoMaintenance,
  useUpsertCondoUnit, useUpsertCondoFund, useUpsertCondoMaintenance,
  useDeleteCondoUnit, useDeleteCondoMaintenance,
  type CondoUnit, type CondoFund, type CondoMaintenance as CondoMaintenanceType,
} from '@/hooks/useEvData';
import CondoUnitModal from '@/components/condo/CondoUnitModal';
import CondoFundModal from '@/components/condo/CondoFundModal';
import CondoMaintenanceModal from '@/components/condo/CondoMaintenanceModal';

// ─── Constants ──────────────────────────────────────────────────────────────

type TabId = 'overview' | 'funds' | 'debtors' | 'maintenance';

const ORG_TYPE_LABELS: Record<string, string> = {
  tarsashaz: 'Társasház',
  lakasszov: 'Lakásszövetkezet',
};

const UNIT_TYPE_ICONS: Record<string, React.ElementType> = {
  lakas: Home, uzlet: Store, garazs: Car, egyeb: Box,
};

const UNIT_TYPE_LABELS: Record<string, string> = {
  lakas: 'Lakás', uzlet: 'Üzlet', garazs: 'Garázs', egyeb: 'Egyéb',
};

const FUND_COLORS: Record<string, { bg: string; bar: string; text: string }> = {
  uzemeltetesi: { bg: 'bg-blue-50 dark:bg-blue-900/10', bar: 'bg-blue-500', text: 'text-blue-600' },
  felujitasi: { bg: 'bg-amber-50 dark:bg-amber-900/10', bar: 'bg-amber-500', text: 'text-amber-600' },
  tartalek: { bg: 'bg-emerald-50 dark:bg-emerald-900/10', bar: 'bg-emerald-500', text: 'text-emerald-600' },
  egyeb: { bg: 'bg-slate-50 dark:bg-slate-800', bar: 'bg-slate-500', text: 'text-slate-600' },
};

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  planned: { label: 'Tervezett', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Clock },
  in_progress: { label: 'Folyamatban', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Wrench },
  completed: { label: 'Befejezett', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  cancelled: { label: 'Törölve', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
};

const PRIORITY_CFG: Record<string, { label: string; color: string }> = {
  low: { label: 'Alacsony', color: 'text-slate-400' },
  normal: { label: 'Normál', color: 'text-blue-500' },
  high: { label: 'Magas', color: 'text-amber-500' },
  urgent: { label: 'Sürgős', color: 'text-red-500' },
};

const CATEGORY_LABELS: Record<string, string> = {
  altalanos: 'Általános', epuletgepeszet: 'Épületgépészet',
  felujitas: 'Felújítás', biztonsag: 'Biztonság', kozterulet: 'Közterület',
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function OrgCondominiumPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const { data: client } = useAccountyClient(id);
  const [searchParams] = useSearchParams();
  const taxYear = Number(searchParams.get('year') || '2026');
  const { data: settings } = useEvClientSettings(id, taxYear);
  const { data: entries, isLoading: entriesLoading } = useCashbookEntries(id, taxYear);
  const { data: units, isLoading: unitsLoading } = useCondoUnits(id);
  const { data: funds, isLoading: fundsLoading } = useCondoFunds(id);
  const { data: maintenance, isLoading: maintenanceLoading } = useCondoMaintenance(id);

  const upsertUnit = useUpsertCondoUnit();
  const deleteUnit = useDeleteCondoUnit();
  const upsertFund = useUpsertCondoFund();
  const upsertMaintenance = useUpsertCondoMaintenance();
  const deleteMaintenance = useDeleteCondoMaintenance();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [unitModal, setUnitModal] = useState<{ open: boolean; edit: CondoUnit | null }>({ open: false, edit: null });
  const [fundModal, setFundModal] = useState<{ open: boolean; edit: CondoFund | null }>({ open: false, edit: null });
  const [maintModal, setMaintModal] = useState<{ open: boolean; edit: CondoMaintenanceType | null }>({ open: false, edit: null });

  const isLoading = entriesLoading || unitsLoading || fundsLoading || maintenanceLoading;

  // ─── Computed data ──────────────────────────────────────────────────────────

  const totalMonthlyFee = useMemo(() => (units || []).reduce((s, u) => s + (u.is_active ? u.monthly_common_fee : 0), 0), [units]);
  const totalArrears = useMemo(() => (units || []).reduce((s, u) => s + (u.arrears_amount || 0), 0), [units]);
  const totalFundsBalance = useMemo(() => (funds || []).reduce((s, f) => s + f.current_balance, 0), [funds]);
  const activeUnitsCount = useMemo(() => (units || []).filter(u => u.is_active).length, [units]);
  const arrearsCount = useMemo(() => (units || []).filter(u => u.arrears_amount > 0).length, [units]);

  const maintenanceCostPlanned = useMemo(() =>
    (maintenance || []).filter(m => m.status !== 'cancelled').reduce((s, m) => s + m.estimated_cost, 0), [maintenance]);

  const condoName = client?.name || 'Társasház';
  const orgType = settings?.org_type || 'tarsashaz';

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSaveUnit = (unit: Partial<CondoUnit>) => {
    upsertUnit.mutate({ ...unit, company_id: id! }, {
      onSuccess: () => setUnitModal({ open: false, edit: null }),
    });
  };

  const handleSaveFund = (fund: Partial<CondoFund>) => {
    upsertFund.mutate({ ...fund, company_id: id! }, {
      onSuccess: () => setFundModal({ open: false, edit: null }),
    });
  };

  const handleSaveMaintenance = (item: Partial<CondoMaintenanceType>) => {
    upsertMaintenance.mutate({ ...item, company_id: id! }, {
      onSuccess: () => setMaintModal({ open: false, edit: null }),
    });
  };

  // ─── Tabs ─────────────────────────────────────────────────────────────────

  const tabs: { id: TabId; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'overview', label: 'Áttekintés', icon: BarChart2 },
    { id: 'funds', label: 'Pénzalapok', icon: Wallet, badge: funds?.length },
    { id: 'debtors', label: 'Lakók & Hátralékok', icon: Users, badge: arrearsCount || undefined },
    { id: 'maintenance', label: 'Karbantartás', icon: Wrench, badge: maintenance?.filter(m => m.status !== 'completed' && m.status !== 'cancelled').length },
  ];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to={`/accounty/${id}/${dateRange}/ev?year=${taxYear}`} className="hover:text-primary transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Áttekintés
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Társasház</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl shadow-lg shadow-sky-500/25">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{condoName}</h1>
            <p className="text-sm text-slate-500">
              {ORG_TYPE_LABELS[orgType] || 'Társasház'} · {activeUnitsCount} albetét · {client?.tax_number || '-'}
            </p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white dark:bg-slate-800 border border-border rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
          <Download className="w-3 h-3" /> Éves elszámolás
        </button>
      </div>

      {/* KPI row */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-card rounded-xl border border-border p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Albetétek</p>
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{activeUnitsCount}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Havi közös ktg.</p>
            <p className="text-lg font-bold text-green-600 font-mono tabular-nums">{formatHuf(totalMonthlyFee)}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Hátralékok</p>
            <p className={cn('text-lg font-bold font-mono tabular-nums', totalArrears > 0 ? 'text-red-600' : 'text-slate-400')}>
              {totalArrears > 0 ? formatHuf(totalArrears) : '0 Ft'}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Alapok egyenleg</p>
            <p className={cn('text-lg font-bold font-mono tabular-nums', totalFundsBalance >= 0 ? 'text-blue-600' : 'text-red-600')}>
              {formatHuf(totalFundsBalance)}
            </p>
          </div>
          <div className="bg-card rounded-xl border border-border p-3 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Karb. terv ktg.</p>
            <p className="text-lg font-bold text-amber-600 font-mono tabular-nums">{formatHuf(maintenanceCostPlanned)}</p>
          </div>
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
              {tab.badge != null && tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded-full">{tab.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
          {/* Funds overview */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-blue-500" /> Pénzalapok
              </h3>
              <button onClick={() => setActiveTab('funds')} className="text-[10px] text-primary hover:underline">Részletek →</button>
            </div>
            <div className="divide-y divide-border/50">
              {(!funds || funds.length === 0) ? (
                <div className="px-4 py-6 text-center text-xs text-slate-400">
                  Még nincs pénzalap rögzítve
                </div>
              ) : (
                funds.map(fund => {
                  const colors = FUND_COLORS[fund.fund_type] || FUND_COLORS.egyeb;
                  const pct = fund.target_balance > 0 ? Math.min(100, (fund.current_balance / fund.target_balance) * 100) : 0;
                  return (
                    <div key={fund.id} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{fund.fund_name}</span>
                        <span className={cn('text-xs font-bold font-mono tabular-nums', colors.text)}>{formatHuf(fund.current_balance)}</span>
                      </div>
                      {fund.target_balance > 0 && (
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all duration-500', colors.bar)} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Arrears summary */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> Hátralékok
              </h3>
              <button onClick={() => setActiveTab('debtors')} className="text-[10px] text-primary hover:underline">Részletek →</button>
            </div>
            <div className="divide-y divide-border/50">
              {arrearsCount === 0 ? (
                <div className="px-4 py-6 text-center">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-500" />
                  <p className="text-xs text-green-600 font-medium">Nincs hátralék</p>
                  <p className="text-[10px] text-slate-400 mt-1">Minden lakó rendben fizetett</p>
                </div>
              ) : (
                (units || []).filter(u => u.arrears_amount > 0).slice(0, 5).map(u => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                    <div>
                      <p className="font-semibold text-slate-700 dark:text-slate-300">{u.unit_number} — {u.owner_name}</p>
                      {u.last_payment_date && <p className="text-[10px] text-slate-400">Utolsó fiz.: {new Date(u.last_payment_date).toLocaleDateString('hu-HU')}</p>}
                    </div>
                    <span className="font-mono tabular-nums text-red-600 font-bold">{formatHuf(u.arrears_amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active maintenance */}
          <div className="md:col-span-2 bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-500" /> Aktív karbantartási feladatok
              </h3>
              <button onClick={() => setActiveTab('maintenance')} className="text-[10px] text-primary hover:underline">Összes →</button>
            </div>
            <div className="divide-y divide-border/50">
              {(!maintenance || maintenance.filter(m => m.status !== 'completed' && m.status !== 'cancelled').length === 0) ? (
                <div className="px-4 py-6 text-center text-xs text-slate-400">Nincs aktív feladat</div>
              ) : (
                maintenance.filter(m => m.status !== 'completed' && m.status !== 'cancelled').slice(0, 4).map(m => {
                  const cfg = STATUS_CFG[m.status] || STATUS_CFG.planned;
                  const prio = PRIORITY_CFG[m.priority] || PRIORITY_CFG.normal;
                  const Icon = cfg.icon;
                  return (
                    <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold', cfg.color)}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{m.title}</span>
                        <span className={cn('text-[10px]', prio.color)}>● {prio.label}</span>
                      </div>
                      <span className="font-mono tabular-nums text-slate-500">{m.estimated_cost > 0 ? formatHuf(m.estimated_cost) : '–'}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ FUNDS TAB ═══ */}
      {activeTab === 'funds' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{funds?.length || 0} pénzalap</p>
            <button
              onClick={() => setFundModal({ open: true, edit: null })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3 h-3" /> Új alap
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(funds || []).map(fund => {
              const colors = FUND_COLORS[fund.fund_type] || FUND_COLORS.egyeb;
              const pct = fund.target_balance > 0 ? Math.min(100, (fund.current_balance / fund.target_balance) * 100) : 0;
              return (
                <div key={fund.id} className={cn('rounded-xl border border-border p-5 space-y-3', colors.bg)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{fund.fund_name}</h3>
                      {fund.description && <p className="text-[10px] text-slate-500 mt-0.5">{fund.description}</p>}
                    </div>
                    <button
                      onClick={() => setFundModal({ open: true, edit: fund })}
                      className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <Edit2 className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] text-slate-400">Aktuális egyenleg</p>
                      <p className={cn('text-2xl font-bold font-mono tabular-nums', colors.text)}>{formatHuf(fund.current_balance)}</p>
                    </div>
                    {fund.target_balance > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Cél</p>
                        <p className="text-sm font-mono tabular-nums text-slate-500">{formatHuf(fund.target_balance)}</p>
                      </div>
                    )}
                  </div>

                  {fund.target_balance > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-400">Töltöttség</span>
                        <span className={cn('text-[10px] font-bold', colors.text)}>{Math.round(pct)}%</span>
                      </div>
                      <div className="w-full h-2 bg-white/50 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all duration-700', colors.bar)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}

                  {fund.monthly_contribution > 0 && (
                    <p className="text-[10px] text-slate-500">
                      Havi hozzájárulás/lakás: <span className="font-bold">{formatHuf(fund.monthly_contribution)}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {(!funds || funds.length === 0) && (
            <div className="bg-card rounded-xl border border-dashed border-border p-8 text-center">
              <Wallet className="w-8 h-8 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Még nincs pénzalap</p>
              <p className="text-xs text-slate-400 mt-1">Add hozzá az üzemeltetési, felújítási és tartalék alapokat</p>
            </div>
          )}
        </div>
      )}

      {/* ═══ DEBTORS / UNITS TAB ═══ */}
      {activeTab === 'debtors' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-500">{activeUnitsCount} aktív albetét</p>
              {arrearsCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                  {arrearsCount} hátralékos
                </span>
              )}
            </div>
            <button
              onClick={() => setUnitModal({ open: true, edit: null })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3 h-3" /> Új albetét
            </button>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-800/30">
                    <th className="text-left py-2.5 px-4 font-medium text-slate-500 uppercase tracking-wider">Albetét</th>
                    <th className="text-left py-2.5 px-4 font-medium text-slate-500 uppercase tracking-wider">Típus</th>
                    <th className="text-left py-2.5 px-4 font-medium text-slate-500 uppercase tracking-wider">Tulajdonos</th>
                    <th className="text-right py-2.5 px-4 font-medium text-slate-500 uppercase tracking-wider">Terület</th>
                    <th className="text-right py-2.5 px-4 font-medium text-slate-500 uppercase tracking-wider">Havi díj</th>
                    <th className="text-right py-2.5 px-4 font-medium text-slate-500 uppercase tracking-wider">Hátralék</th>
                    <th className="text-center py-2.5 px-4 font-medium text-slate-500 uppercase tracking-wider">Státusz</th>
                    <th className="py-2.5 px-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(!units || units.length === 0) ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                        <Building2 className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                        Még nincs albetét rögzítve
                      </td>
                    </tr>
                  ) : (
                    units.map(u => {
                      const UIcon = UNIT_TYPE_ICONS[u.unit_type] || Box;
                      const hasArrears = u.arrears_amount > 0;
                      return (
                        <tr key={u.id} className={cn(
                          'hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors',
                          hasArrears && 'bg-red-50/30 dark:bg-red-900/5'
                        )}>
                          <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-2">
                              <UIcon className="w-3.5 h-3.5 text-slate-400" />
                              {u.unit_number}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500">{UNIT_TYPE_LABELS[u.unit_type] || u.unit_type}</td>
                          <td className="py-2.5 px-4">
                            <p className="font-medium text-slate-700 dark:text-slate-300">{u.owner_name}</p>
                            {u.owner_contact && <p className="text-[10px] text-slate-400 flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{u.owner_contact}</p>}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500">{u.area_sqm ? `${u.area_sqm} m²` : '–'}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">{formatHuf(u.monthly_common_fee)}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                            <span className={hasArrears ? 'text-red-600 font-bold' : 'text-slate-400'}>
                              {hasArrears ? formatHuf(u.arrears_amount) : '0 Ft'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {hasArrears ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
                                <AlertTriangle className="w-3 h-3" />Hátralékos
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />Rendben
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setUnitModal({ open: true, edit: u })}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              >
                                <Edit2 className="w-3 h-3 text-slate-400" />
                              </button>
                              <button
                                onClick={() => { if (confirm('Biztosan törli?')) deleteUnit.mutate({ id: u.id, companyId: id! }); }}
                                className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              >
                                <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {units && units.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-border bg-slate-50/30 dark:bg-slate-800/20 font-bold text-xs">
                      <td colSpan={4} className="py-2.5 px-4 text-slate-900 dark:text-slate-100">Összesen ({activeUnitsCount} albetét)</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">{formatHuf(totalMonthlyFee)}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-red-600">{totalArrears > 0 ? formatHuf(totalArrears) : '0 Ft'}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MAINTENANCE TAB ═══ */}
      {activeTab === 'maintenance' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{maintenance?.length || 0} feladat</p>
            <button
              onClick={() => setMaintModal({ open: true, edit: null })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-3 h-3" /> Új feladat
            </button>
          </div>

          <div className="space-y-2">
            {(!maintenance || maintenance.length === 0) ? (
              <div className="bg-card rounded-xl border border-dashed border-border p-8 text-center">
                <Wrench className="w-8 h-8 mx-auto mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">Még nincs karbantartási feladat</p>
                <p className="text-xs text-slate-400 mt-1">Rögzítse a tervezett és folyamatban lévő munkákat</p>
              </div>
            ) : (
              maintenance.map(m => {
                const cfg = STATUS_CFG[m.status] || STATUS_CFG.planned;
                const prio = PRIORITY_CFG[m.priority] || PRIORITY_CFG.normal;
                const Icon = cfg.icon;
                return (
                  <div key={m.id} className={cn(
                    'bg-card rounded-xl border shadow-soft px-5 py-4 flex items-start justify-between gap-4',
                    m.status === 'completed' ? 'border-green-200 dark:border-green-800/50 opacity-70' : 'border-border'
                  )}>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{m.title}</h4>
                        <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full', cfg.color)}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </span>
                        <span className={cn('text-[10px] font-medium', prio.color)}>● {prio.label}</span>
                        <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {CATEGORY_LABELS[m.category] || m.category}
                        </span>
                      </div>

                      {m.description && <p className="text-xs text-slate-500">{m.description}</p>}

                      <div className="flex items-center gap-4 text-[10px] text-slate-400">
                        {m.vendor_name && <span>Kivitelező: <span className="font-medium text-slate-600 dark:text-slate-400">{m.vendor_name}</span></span>}
                        {m.planned_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Terv: {new Date(m.planned_date).toLocaleDateString('hu-HU')}</span>}
                        {m.completed_date && <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" />Kész: {new Date(m.completed_date).toLocaleDateString('hu-HU')}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        {m.estimated_cost > 0 && (
                          <p className="text-xs font-mono tabular-nums text-slate-500">
                            {m.actual_cost > 0 ? (
                              <><span className="text-slate-900 dark:text-slate-100 font-bold">{formatHuf(m.actual_cost)}</span> / {formatHuf(m.estimated_cost)}</>
                            ) : formatHuf(m.estimated_cost)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setMaintModal({ open: true, edit: m })}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 className="w-3 h-3 text-slate-400" />
                        </button>
                        <button
                          onClick={() => { if (confirm('Biztosan törli?')) deleteMaintenance.mutate({ id: m.id, companyId: id! }); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
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

      {/* Modals */}
      <CondoUnitModal
        open={unitModal.open}
        onClose={() => setUnitModal({ open: false, edit: null })}
        onSave={handleSaveUnit}
        editUnit={unitModal.edit}
      />
      <CondoFundModal
        open={fundModal.open}
        onClose={() => setFundModal({ open: false, edit: null })}
        onSave={handleSaveFund}
        editFund={fundModal.edit}
      />
      <CondoMaintenanceModal
        open={maintModal.open}
        onClose={() => setMaintModal({ open: false, edit: null })}
        onSave={handleSaveMaintenance}
        editItem={maintModal.edit}
      />
    </div>
  );
}
