import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Receipt, Search, ChevronRight, TrendingUp, AlertTriangle,
  Users, Calendar, BarChart3, ArrowUpRight, ArrowDownRight,
  Filter, Building2, UserCheck, Wallet, ShieldCheck, Loader2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAccountyClients, type AccountyClient } from '@/hooks/accounty';
import { formatMillionHuf, formatPercent, getEvThresholds, type ThresholdStatus } from '@/lib/evCalculations';
import {
  useAllEvClientSettings, useEvYtdRevenue, useEvYtdTotals,
  useAllEvTaxReturns, type EvTaxpayerForm, type EvClientSettings,
} from '@/hooks/useEvData';
import EvAlertsCenter, { type PortfolioAlert } from '@/components/nav/EvAlertsCenter';

// ─── Types ──────────────────────────────────────────────────────────────────

type EvFilingStatus = 'not_started' | 'data_entry' | 'cashbook_open' | 'period_closed' | 'returns_ready' | 'submitted' | 'accepted';

interface EnrichedEvClient extends AccountyClient {
  taxpayerForm: EvTaxpayerForm | null;
  employmentStatus: string;
  vatStatus: string;
  ytdRevenue: number;
  ytdIncome: number;
  filingStatus: EvFilingStatus;
  thresholdStatus: ThresholdStatus;
  isOrgType: boolean;
  orgType?: string;
}

const FORM_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  atalany: { label: 'Átalány', color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  vszja:   { label: 'VSZJA', color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-900/30' },
  kata:    { label: 'KATA', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/30' },
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  foallasu: 'Főfoglalkozás',
  mellekallasu: 'Mellékállás',
  kiegeszito: 'Kiegészítő',
};

const VAT_LABELS: Record<string, string> = {
  alanyi_mentes: 'Alanyi mentes',
  afas: 'ÁFA-alany',
  penzforgalmi: 'Pénzforgalmi',
};

const FILING_STATUS: Record<EvFilingStatus, { label: string; color: string; bg: string }> = {
  not_started:   { label: 'Nincs elindítva', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
  data_entry:    { label: 'Adatrögzítés', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/30' },
  cashbook_open: { label: 'Pénztárkönyv nyitott', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  period_closed: { label: 'Időszak lezárva', color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  returns_ready: { label: 'Bevallás kész', color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/30' },
  submitted:     { label: 'Beküldve', color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-900/30' },
  accepted:      { label: 'Elfogadva', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/30' },
};

const THRESHOLD_CONFIG: Record<ThresholdStatus, { color: string; bg: string; label: string }> = {
  green:  { color: 'text-green-600', bg: 'bg-green-500', label: 'OK' },
  yellow: { color: 'text-amber-600', bg: 'bg-amber-500', label: 'Figyelem' },
  red:    { color: 'text-red-600', bg: 'bg-red-500', label: 'Túllépés' },
};

const ORG_TYPE_LABELS: Record<string, string> = {
  egyesulet: 'Egyesület',
  alapitvany: 'Alapítvány',
  egyhaz: 'Egyház',
  tarsashaz: 'Társasház',
  lakasszov: 'Lakásszövetkezet',
  mrp: 'MRP',
  egyeb: 'Szervezet',
};

type FilterMode = 'all' | 'atalany' | 'vszja' | 'kata' | 'threshold_warning' | 'org';

export default function EvPortfolioDashboard() {
  const { data: clients = [], isLoading: clientsLoading } = useAccountyClients();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const taxYear = Number(searchParams.get('year') || '2026');

  const setTaxYear = (year: number) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('year', String(year));
      return next;
    });
  };

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: allSettings = [], isLoading: settingsLoading } = useAllEvClientSettings(taxYear);
  const { data: ytdTotalsMap, isLoading: totalsLoading } = useEvYtdTotals(taxYear);
  const { data: allReturns = [], isLoading: returnsLoading } = useAllEvTaxReturns(taxYear);

  const { data: customerTotalsMap, isLoading: customerTotalsLoading } = useQuery({
    queryKey: ['portfolio-kata-customer-totals', taxYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nav_invoices')
        .select('company_id, customer_name, invoice_gross_amount')
        .eq('invoice_direction', 'OUTBOUND')
        .gte('invoice_issue_date', `${taxYear}-01-01`)
        .lte('invoice_issue_date', `${taxYear}-12-31`);
      
      if (error) throw error;
      
      const map = new Map<string, { customerName: string; total: number }[]>();
      (data || []).forEach(inv => {
        if (!inv.company_id || !inv.customer_name) return;
        const list = map.get(inv.company_id) || [];
        const existing = list.find(item => item.customerName === inv.customer_name);
        const amount = Number(inv.invoice_gross_amount) || 0;
        if (existing) {
          existing.total += amount;
        } else {
          list.push({ customerName: inv.customer_name, total: amount });
        }
        map.set(inv.company_id, list);
      });
      return map;
    }
  });

  const isLoading = clientsLoading || settingsLoading || totalsLoading || returnsLoading || customerTotalsLoading;

  // Build a lookup: company_id → settings
  const settingsMap = useMemo(() => {
    const map = new Map<string, any>();
    allSettings.forEach((s: any) => {
      map.set(s.company_id, s);
    });
    return map;
  }, [allSettings]);

  // Enrich clients with real DB data
  const enriched = useMemo<EnrichedEvClient[]>(() => {
    return clients.map((c: AccountyClient) => {
      const settings = settingsMap.get(c.companyId);
      const totals = ytdTotalsMap?.get(c.companyId) || { revenue: 0, expense: 0 };
      const revenue = totals.revenue;
      const expense = totals.expense;
      const form = settings?.taxpayer_form ?? null;

      // Compute threshold status from real revenue
      let thresholdStatus: ThresholdStatus = 'green';
      if (form) {
        const thresholds = getEvThresholds(revenue, form, settings?.cost_ratio_category === 'retail_90');
        thresholdStatus = thresholds.reduce<ThresholdStatus>((worst, t) => {
          if (t.status === 'red') return 'red';
          if (t.status === 'yellow' && worst !== 'red') return 'yellow';
          return worst;
        }, 'green');
      }

      // Check KATA customer limits
      const customerTotals = customerTotalsMap?.get(c.companyId) || [];
      const hasCustomerDanger = customerTotals.some(cust => cust.total >= 3_000_000);
      const hasCustomerWarning = customerTotals.some(cust => cust.total >= 2_500_000);

      // Check tax returns for this company
      const companyReturns = (allReturns || []).filter((ret: any) => ret.company_id === c.companyId);
      const hasPastDueReturn = companyReturns.some((ret: any) => {
        if (!ret.deadline) return false;
        const isPast = new Date(ret.deadline).getTime() < Date.now();
        const isNotDone = ret.status !== 'submitted' && ret.status !== 'accepted';
        return isPast && isNotDone;
      });
      const hasUpcomingReturn = companyReturns.some((ret: any) => {
        if (!ret.deadline) return false;
        const deadlineDate = new Date(ret.deadline);
        const isPast = deadlineDate.getTime() < Date.now();
        const isNotDone = ret.status !== 'submitted' && ret.status !== 'accepted';
        const diffDays = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return !isPast && isNotDone && diffDays <= 5;
      });

      // Elevate threshold status if there are critical return or customer limit alerts
      if (hasPastDueReturn || hasCustomerDanger) {
        thresholdStatus = 'red';
      } else if (thresholdStatus !== 'red' && (hasUpcomingReturn || hasCustomerWarning)) {
        thresholdStatus = 'yellow';
      }

      // Derive filing status: if no settings → not_started, if settings exist → data_entry
      // (A proper filing_status field would come from the tax_returns table in future)
      let filingStatus: EvFilingStatus = 'not_started';
      if (settings) {
        filingStatus = 'data_entry';
      }

      return {
        ...c,
        taxpayerForm: form,
        employmentStatus: settings ? (EMPLOYMENT_LABELS[settings.employment_status] || settings.employment_status) : '—',
        vatStatus: settings ? (VAT_LABELS[settings.vat_status] || settings.vat_status) : '—',
        ytdRevenue: revenue,
        ytdIncome: revenue - expense, // Real Income = Revenue - Expenses from eaisybill invoices!
        filingStatus,
        thresholdStatus,
        isOrgType: !!settings?.org_type,
        orgType: settings?.org_type || undefined,
      };
    });
  }, [clients, settingsMap, ytdTotalsMap, allReturns, customerTotalsMap]);

  // Compute portfolio level warnings / dangers for Alerts Center
  const portfolioAlerts = useMemo<PortfolioAlert[]>(() => {
    const list: PortfolioAlert[] = [];

    // 1. Threshold alerts (ÁFA and KATA revenue)
    enriched.forEach(c => {
      if (!c.taxpayerForm) return;

      // 1.1 ÁFA alanyi mentesség check
      if (c.vatStatus === 'Alanyi mentes' || c.vatStatus === 'alanyi_mentes') {
        const afaLimit = taxYear === 2026 ? 20_000_000 : 18_000_000;
        if (c.ytdRevenue >= afaLimit) {
          list.push({
            id: `afa-danger-${c.companyId}`,
            companyId: c.companyId,
            companyName: c.name,
            type: 'danger',
            title: 'ÁFA alanyi mentesség határ túllépés',
            message: `A vállalkozás bevétele (${c.ytdRevenue.toLocaleString('hu-HU')} Ft) átlépte az alanyi ÁFA mentesség ${afaLimit.toLocaleString('hu-HU')} Ft-os határértékét!`,
            targetUrl: `/accounty/client/${c.companyId}/ev/vat`,
          });
        } else if (c.ytdRevenue >= afaLimit * 0.85) {
          list.push({
            id: `afa-warning-${c.companyId}`,
            companyId: c.companyId,
            companyName: c.name,
            type: 'warning',
            title: 'ÁFA alanyi mentesség határ közelít',
            message: `A vállalkozás bevétele (${c.ytdRevenue.toLocaleString('hu-HU')} Ft) megközelítette az alanyi ÁFA mentességi határt (a limit ${(c.ytdRevenue / afaLimit * 100).toFixed(0)}%-ánál jár).`,
            targetUrl: `/accounty/client/${c.companyId}/ev/vat`,
          });
        }
      }

      // 1.2 KATA éves limit check
      if (c.taxpayerForm === 'kata') {
        const kataLimit = 18_000_000;
        if (c.ytdRevenue >= kataLimit) {
          list.push({
            id: `kata-danger-${c.companyId}`,
            companyId: c.companyId,
            companyName: c.name,
            type: 'danger',
            title: 'KATA éves keret túllépés',
            message: `A vállalkozás bevétele (${c.ytdRevenue.toLocaleString('hu-HU')} Ft) átlépte a KATA éves ${kataLimit.toLocaleString('hu-HU')} Ft-os keretét!`,
            targetUrl: `/accounty/client/${c.companyId}/ev/kata`,
          });
        } else if (c.ytdRevenue >= kataLimit * 0.85) {
          list.push({
            id: `kata-warning-${c.companyId}`,
            companyId: c.companyId,
            companyName: c.name,
            type: 'warning',
            title: 'KATA éves keret közelít',
            message: `A vállalkozás bevétele (${c.ytdRevenue.toLocaleString('hu-HU')} Ft) megközelítette a KATA éves keretet (a limit ${(c.ytdRevenue / kataLimit * 100).toFixed(0)}%-ánál jár).`,
            targetUrl: `/accounty/client/${c.companyId}/ev/kata`,
          });
        }

        // 1.3 KATA 3M Ft-os partner/customer limit check
        const customerTotals = customerTotalsMap?.get(c.companyId) || [];
        customerTotals.forEach(cust => {
          if (cust.total >= 3_000_000) {
            list.push({
              id: `kata-cust-danger-${c.companyId}-${cust.customerName}`,
              companyId: c.companyId,
              companyName: c.name,
              type: 'danger',
              title: 'KATA partner 3M Ft limit túllépés',
              message: `A(z) "${cust.customerName}" partner felé kiállított számlák összege (${cust.total.toLocaleString('hu-HU')} Ft) átlépte a 3 millió Ft-os KATA limitet (40%-os adófizetési kötelezettség keletkezett).`,
              targetUrl: `/accounty/client/${c.companyId}/ev/kata`,
            });
          } else if (cust.total >= 2_500_000) {
            list.push({
              id: `kata-cust-warning-${c.companyId}-${cust.customerName}`,
              companyId: c.companyId,
              companyName: c.name,
              type: 'warning',
              title: 'KATA partner 3M Ft limit közelít',
              message: `A(z) "${cust.customerName}" partner felé kiállított számlák összege (${cust.total.toLocaleString('hu-HU')} Ft) megközelítette a 3 millió Ft-os KATA limitet (a limit ${(cust.total / 30000).toFixed(0)}%-ánál jár).`,
              targetUrl: `/accounty/client/${c.companyId}/ev/kata`,
            });
          }
        });
      }
    });

    // 2. Tax returns deadline checks
    (allReturns || []).forEach((ret: any) => {
      const compId = ret.company_id;
      const compName = ret.companies?.name || 'Ismeretlen ügyfél';
      
      if (!ret.deadline) return;
      const deadlineDate = new Date(ret.deadline);
      const isPastDue = deadlineDate.getTime() < Date.now();
      const isNotDone = ret.status !== 'submitted' && ret.status !== 'accepted';
      
      const diffDays = Math.ceil((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      let targetUrl = `/accounty/client/${compId}/ev/returns`;
      if (ret.form_code === '2658') {
        targetUrl = `/accounty/client/${compId}/ev/returns/contrib`;
      } else if (ret.form_code === 'KATA') {
        targetUrl = `/accounty/client/${compId}/ev/returns/kata`;
      } else if (ret.form_code === 'HIPAK') {
        targetUrl = `/accounty/client/${compId}/ev/returns/hipa`;
      } else if (ret.form_code === '2553') {
        targetUrl = `/accounty/client/${compId}/ev/returns`;
      }

      if (isPastDue && isNotDone) {
        list.push({
          id: `return-danger-${ret.id}`,
          companyId: compId,
          companyName: compName,
          type: 'danger',
          title: 'Lejárt bevallási határidő',
          message: `A(z) ${ret.form_code || 'bevallás'} leadási határideje lejárt! (Határidő: ${new Date(ret.deadline).toLocaleDateString('hu-HU')}, jelenlegi állapot: ${ret.status})`,
          targetUrl,
        });
      } else if (!isPastDue && isNotDone && diffDays <= 5) {
        list.push({
          id: `return-warning-${ret.id}`,
          companyId: compId,
          companyName: compName,
          type: 'warning',
          title: 'Közelgő bevallási határidő',
          message: `A(z) ${ret.form_code || 'bevallás'} leadási határideje ${diffDays} napon belül van! (Határidő: ${new Date(ret.deadline).toLocaleDateString('hu-HU')})`,
          targetUrl,
        });
      }
    });

    return list;
  }, [enriched, allReturns, customerTotalsMap, taxYear]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c: EnrichedEvClient) =>
        c.name.toLowerCase().includes(q) || c.taxNumber?.toLowerCase().includes(q)
      );
    }
    switch (filterMode) {
      case 'atalany': list = list.filter((c: EnrichedEvClient) => c.taxpayerForm === 'atalany'); break;
      case 'vszja': list = list.filter((c: EnrichedEvClient) => c.taxpayerForm === 'vszja'); break;
      case 'kata': list = list.filter((c: EnrichedEvClient) => c.taxpayerForm === 'kata'); break;
      case 'threshold_warning': list = list.filter((c: EnrichedEvClient) => c.thresholdStatus !== 'green'); break;
      case 'org': list = list.filter((c: EnrichedEvClient) => c.isOrgType); break;
    }
    return list;
  }, [enriched, searchQuery, filterMode]);

  // Summary stats
  const totalClients = enriched.length;
  const atalanyCount = enriched.filter((c: EnrichedEvClient) => c.taxpayerForm === 'atalany').length;
  const vszjaCount = enriched.filter((c: EnrichedEvClient) => c.taxpayerForm === 'vszja').length;
  const kataCount = enriched.filter((c: EnrichedEvClient) => c.taxpayerForm === 'kata').length;
  const warningCount = enriched.filter((c: EnrichedEvClient) => c.thresholdStatus !== 'green').length;
  const submittedCount = enriched.filter((c: EnrichedEvClient) => ['submitted', 'accepted'].includes(c.filingStatus)).length;
  const totalRevenue = enriched.reduce((sum: number, c: EnrichedEvClient) => sum + c.ytdRevenue, 0);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              EV & Egyszeres könyvvitel
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {taxYear}. adóév — egyéni vállalkozók és szervezetek
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={taxYear}
            onChange={(e) => setTaxYear(Number(e.target.value))}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground"
          >
            <option value={2026}>2026. adóév</option>
            <option value={2025}>2025. adóév</option>
            <option value={2024}>2024. adóév</option>
          </select>
        </div>
      </div>

      {/* Alerts Center */}
      <EvAlertsCenter alerts={portfolioAlerts} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Összes ügyfél</p>
          <p className="text-2xl font-bold text-indigo-600">{totalClients}</p>
          <div className="flex gap-2 mt-1.5">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-medium">
              Á: {atalanyCount}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-600 font-medium">
              V: {vszjaCount}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 font-medium">
              K: {kataCount}
            </span>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Összesített bevétel</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {formatMillionHuf(totalRevenue)}
          </p>
          <p className="text-[10px] text-green-600 flex items-center gap-0.5 mt-1">
            <ArrowUpRight className="w-3 h-3" /> Göngyölített
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Bevallás beadva</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-green-600">{submittedCount}</p>
            <p className="text-xs text-slate-400 pb-1">/ {totalClients}</p>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-2">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${totalClients > 0 ? (submittedCount / totalClients) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Értékhatár-figyelmeztetés</p>
          <p className={cn('text-2xl font-bold', warningCount > 0 ? 'text-amber-600' : 'text-slate-400')}>
            {warningCount}
          </p>
          {warningCount > 0 && (
            <p className="text-[10px] text-amber-600 flex items-center gap-0.5 mt-1">
              <AlertTriangle className="w-3 h-3" /> Azonnali figyelmet igényel
            </p>
          )}
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Bevallási határidő</p>
          <p className="text-base font-bold text-slate-900 dark:text-slate-100">
            {taxYear === 2026 ? '2027. máj. 20.' : `${taxYear + 1}. máj. 20.`}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">SZJA bevallás</p>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Következő járulék</p>
          <p className="text-base font-bold text-slate-900 dark:text-slate-100">
            {taxYear === 2026 ? '2026. okt. 12.' : '—'}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Q3 2658 határidő</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Keresés ügyfél neve, adószám..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5">
          {([
            ['all', 'Mind'],
            ['atalany', 'Átalány'],
            ['vszja', 'VSZJA'],
            ['kata', 'KATA'],
            ['threshold_warning', '⚠ Határ'],
            ['org', 'Szervezetek'],
          ] as [FilterMode, string][]).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterMode(v)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                filterMode === v
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border dark:bg-slate-900/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ügyfél</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Adózási forma</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Foglalkoztatás</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bevétel (YTD)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Jövedelem</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Határ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Státusz</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-slate-400">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 text-indigo-400 animate-spin" />
                    Betöltés...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-slate-400">
                    <Receipt className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    {enriched.length === 0 ? 'Nincs EV ügyfél rögzítve' : 'Nincs találat'}
                  </td>
                </tr>
              ) : (
                filtered.map((client: EnrichedEvClient) => {
                  const form = client.taxpayerForm ? FORM_LABELS[client.taxpayerForm] : null;
                  const fs = FILING_STATUS[client.filingStatus];
                  const ts = THRESHOLD_CONFIG[client.thresholdStatus];
                  return (
                    <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-4 py-3">
                        <Link
                          to={`/accounty/client/${client.companyId}/ev`}
                          className="text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 transition-colors"
                        >
                          {client.name}
                        </Link>
                        {client.taxNumber && (
                          <p className="text-[10px] text-slate-400 font-mono">{client.taxNumber}</p>
                        )}
                        {client.isOrgType && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-teal-50 dark:bg-teal-900/30 text-teal-600 font-medium">
                            {ORG_TYPE_LABELS[client.orgType || ''] || 'Szervezet'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {form ? (
                          <span className={cn('px-2 py-1 rounded-full text-xs font-semibold', form.bg, form.color)}>
                            {form.label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {client.employmentStatus}
                        <p className="text-[10px] text-slate-400">{client.vatStatus}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                          {client.ytdRevenue > 0 ? formatMillionHuf(client.ytdRevenue) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          'text-sm font-semibold tabular-nums',
                          client.ytdIncome > 0 ? 'text-green-600' : 'text-slate-400'
                        )}>
                          {client.ytdIncome > 0 ? formatMillionHuf(client.ytdIncome) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {client.taxpayerForm ? (
                          <span className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold',
                            client.thresholdStatus === 'green' ? 'bg-green-50 dark:bg-green-900/30 text-green-600' :
                            client.thresholdStatus === 'yellow' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600' :
                            'bg-red-50 dark:bg-red-900/30 text-red-600'
                          )}>
                            {client.thresholdStatus === 'green' ? '✓' : client.thresholdStatus === 'yellow' ? '⚠' : '✕'}
                            {' '}{ts.label}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-1 rounded-full text-xs font-semibold', fs.bg, fs.color)}>
                          {fs.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/accounty/client/${client.companyId}/ev`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-500"
                        >
                          Megnyit <ChevronRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
