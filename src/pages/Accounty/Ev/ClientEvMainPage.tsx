import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Receipt, ArrowLeft, BookOpen, Calculator, FileText,
  TrendingUp, AlertTriangle, Calendar, Settings, ChevronRight,
  Wallet, BarChart3, Users, Car, Package, Shield,
  Landmark, ClipboardList, PiggyBank, Scale, Loader2, ChevronLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatMillionHuf, formatPercent, formatHuf, getEvThresholds } from '@/lib/evCalculations';
import type { ThresholdStatus } from '@/lib/evCalculations';
import { useEvClientSettings, useEvRealTotals, useCashbookTotals } from '@/hooks/useEvData';

// ─── Employment/VAT labels ──────────────────────────────────────────────────

const FORM_LABELS: Record<string, string> = {
  atalany: 'Átalányadó',
  vszja: 'VSZJA',
  kata: 'KATA',
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  foallasu: 'Főfoglalkozású',
  mellekallasu: 'Mellékfoglalkozású',
  kiegeszito: 'Kiegészítő tev.',
};

const VAT_LABELS: Record<string, string> = {
  alanyi_mentes: 'Alanyi mentes',
  afas: 'ÁFA-köteles',
  penzforgalmi: 'Pénzforgalmi ÁFA',
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

export default function ClientEvMainPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const { data: client, isLoading: clientLoading } = useAccountyClient(id);
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
  const { data: evSettings, isLoading: settingsLoading } = useEvClientSettings(id, taxYear);
  const { data: realTotals, isLoading: totalsLoading } = useEvRealTotals(id, taxYear);
  const { data: cashbookTotals, isLoading: cashbookLoading } = useCashbookTotals(id, taxYear);

  const taxpayerForm = evSettings?.taxpayer_form || 'atalany';
  const employmentStatus = evSettings?.employment_status || 'foallasu';
  const vatStatus = evSettings?.vat_status || 'alanyi_mentes';

  const ytdRevenue = realTotals?.totalBevetel || 0;
  const ytdExpenses = realTotals?.totalKiadas || 0;
  const ytdIncome = realTotals?.balance || 0;

  const thresholds = getEvThresholds(ytdRevenue, taxpayerForm, false);

  // Navigation sections
  const sections = useMemo(() => [
    {
      title: 'Törzsadatok & életciklus',
      description: 'Alapadatok, beállítások, tevékenység-történet',
      icon: Settings,
      color: 'indigo',
      items: [
        { to: `/accounty/${companyId}/${dateRange}/ev/master-data?year=${taxYear}`, label: 'Törzsadatok', icon: ClipboardList },
        { to: `/accounty/${companyId}/${dateRange}/ev/lifecycle?year=${taxYear}`, label: 'Életciklus', icon: Calendar },
        { to: `/accounty/${companyId}/${dateRange}/ev/setup?year=${taxYear}`, label: 'Beállítás varázsló', icon: Settings },
      ],
    },
    {
      title: 'Adózási forma & kalkulátorok',
      description: 'Adóalap számítás, forma-választó, összehasonlítás',
      icon: Calculator,
      color: 'indigo',
      items: [
        { to: `/accounty/${companyId}/${dateRange}/ev/flat-rate?year=${taxYear}`, label: 'Átalányadó kalkulátor', icon: PiggyBank },
        { to: `/accounty/${companyId}/${dateRange}/ev/entrepreneurial/base?year=${taxYear}`, label: 'Vállalkozói SZJA – adóalap', icon: TrendingUp },
        { to: `/accounty/${companyId}/${dateRange}/ev/entrepreneurial/dividend?year=${taxYear}`, label: 'Vállalkozói SZJA – osztalékalap', icon: Wallet },
        { to: `/accounty/${companyId}/${dateRange}/ev/kata?year=${taxYear}`, label: 'KATA kisadózó', icon: Shield },
        { to: `/accounty/${companyId}/${dateRange}/ev/depreciation?year=${taxYear}`, label: 'Értékcsökkenési leírás (ÉCS)', icon: BarChart3 },
        { to: `/accounty/${companyId}/${dateRange}/ev/compare?year=${taxYear}`, label: 'Adóforma-összehasonlítás', icon: Scale },
      ],
    },
    {
      title: 'Pénztárkönyv',
      description: 'Szja tv. 5. sz. melléklet szerinti könyvvezetés',
      icon: BookOpen,
      color: 'violet',
      items: [
        { to: `/accounty/${companyId}/${dateRange}/ev/cashbook?year=${taxYear}`, label: 'Pénztárkönyv', icon: BookOpen },
        { to: `/accounty/${companyId}/${dateRange}/ev/cashbook/ledger?year=${taxYear}`, label: 'Főkönyvi nézet', icon: BarChart3 },
        { to: `/accounty/${companyId}/${dateRange}/ev/cashbook/close?year=${taxYear}`, label: 'Időszaki zárás', icon: ClipboardList },
      ],
    },
    {
      title: 'Részletező nyilvántartások',
      description: 'Szja tv. 5. sz. melléklet II. rész',
      icon: FileText,
      color: 'teal',
      items: [
        { to: `/accounty/${companyId}/${dateRange}/ev/records?year=${taxYear}`, label: 'Nyilvántartások áttekintő', icon: FileText },
        { to: `/accounty/${companyId}/${dateRange}/ev/records/receivables?year=${taxYear}`, label: 'Vevői követelések', icon: Users },
        { to: `/accounty/${companyId}/${dateRange}/ev/records/payables?year=${taxYear}`, label: 'Szállítói tartozások', icon: Package },
        { to: `/accounty/${companyId}/${dateRange}/ev/records/fixed-assets?year=${taxYear}`, label: 'Tárgyi eszközök', icon: Landmark },
        { to: `/accounty/${companyId}/${dateRange}/ev/records/vehicle-log?year=${taxYear}`, label: 'Útnyilvántartás', icon: Car },
      ],
    },
    {
      title: 'Közteher-modul',
      description: 'Járulékok, HIPA, ÁFA, kamarai hozzájárulás, cégautóadó',
      icon: Landmark,
      color: 'rose',
      items: [
        { to: `/accounty/${companyId}/${dateRange}/ev/contributions?year=${taxYear}`, label: 'TB-járulék & szocho', icon: Calculator },
        { to: `/accounty/${companyId}/${dateRange}/ev/hipa?year=${taxYear}`, label: 'Helyi iparűzési adó', icon: Landmark },
        { to: `/accounty/${companyId}/${dateRange}/ev/vat?year=${taxYear}`, label: 'ÁFA kezelés', icon: Receipt },
        { to: `/accounty/${companyId}/${dateRange}/ev/chamber?year=${taxYear}`, label: 'Kamarai hozzájárulás', icon: Shield },
        { to: `/accounty/${companyId}/${dateRange}/ev/car-tax?year=${taxYear}`, label: 'Cégautóadó', icon: Car },
        { to: `/accounty/${companyId}/${dateRange}/ev/innovation?year=${taxYear}`, label: 'Innovációs járulék', icon: TrendingUp },
      ],
    },
    {
      title: 'Bevallások & Riportok',
      description: 'SZJA, járulék, KATA, HIPA, ÁFA/cégautó bevallások',
      icon: ClipboardList,
      color: 'cyan',
      items: [
        { to: `/accounty/${companyId}/${dateRange}/ev/returns?year=${taxYear}`, label: 'SZJA bevallás (25SZJA)', icon: FileText },
        { to: `/accounty/${companyId}/${dateRange}/ev/returns/contrib?year=${taxYear}`, label: 'Járulékbevallás (2658)', icon: Calculator },
        { to: `/accounty/${companyId}/${dateRange}/ev/returns/kata?year=${taxYear}`, label: 'KATA bevallás', icon: Shield },
        { to: `/accounty/${companyId}/${dateRange}/ev/returns/hipa?year=${taxYear}`, label: 'HIPA bevallás', icon: Landmark },
        { to: `/accounty/${companyId}/${dateRange}/ev/returns/vat-car?year=${taxYear}`, label: 'ÁFA / cégautóadó bevallás', icon: Car },
        { to: `/accounty/${companyId}/${dateRange}/ev/income-report?year=${taxYear}`, label: 'Jövedelem-kimutatás', icon: TrendingUp },
        { to: `/accounty/${companyId}/${dateRange}/ev/optimization?year=${taxYear}`, label: 'Adóoptimalizálás', icon: BarChart3 },
      ],
    },
    {
      title: 'Szervezeti nyilvántartás',
      description: 'Civil szervezet, társasház, egyszeres könyvvitel mód',
      icon: Users,
      color: 'indigo',
      items: [
        { to: `/accounty/${companyId}/${dateRange}/ev/org/bookkeeping?year=${taxYear}`, label: 'Könyvvezetés mód', icon: BookOpen },
        { to: `/accounty/${companyId}/${dateRange}/ev/org/civil?year=${taxYear}`, label: 'Civil szervezet', icon: Users },
        { to: `/accounty/${companyId}/${dateRange}/ev/org/condominium?year=${taxYear}`, label: 'Társasház', icon: Landmark },
        { to: `/accounty/${companyId}/${dateRange}/ev/org/other?year=${taxYear}`, label: 'Egyéb szervezet', icon: Package },
        { to: `/accounty/${companyId}/${dateRange}/ev/org/simplified-report?year=${taxYear}`, label: 'Egyszerűsített beszámoló', icon: FileText },
      ],
    },
  ], [id, taxYear]);

  const visibleSections = useMemo(() => {
    const isOrg = !!evSettings?.org_type;
    return sections.filter(sec => {
      if (sec.title === 'Szervezeti nyilvántartás') {
        return isOrg;
      }
      return true;
    });
  }, [sections, evSettings?.org_type]);

  const colorMap: Record<string, string> = {
    indigo: 'from-indigo-500 to-purple-600 shadow-indigo-500/20',
    violet: 'from-violet-500 to-fuchsia-600 shadow-violet-500/20',
    teal: 'from-teal-500 to-cyan-600 shadow-teal-500/20',
    rose: 'from-rose-500 to-pink-600 shadow-rose-500/20',
    cyan: 'from-cyan-500 to-blue-600 shadow-cyan-500/20',
  };

  const colorHover: Record<string, string> = {
    indigo: 'hover:border-indigo-200 dark:hover:border-indigo-800',
    violet: 'hover:border-violet-200 dark:hover:border-violet-800',
    teal: 'hover:border-teal-200 dark:hover:border-teal-800',
    rose: 'hover:border-rose-200 dark:hover:border-rose-800',
    cyan: 'hover:border-cyan-200 dark:hover:border-cyan-800',
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-4">
          <Link 
            to={`/accounty/${companyId}/${dateRange}/overview`}
            className="flex items-center justify-center w-8 h-8 mt-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm shrink-0"
            title="Vissza az áttekintéshez"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {clientLoading ? (
                <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              ) : (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{client?.name || 'Ügyfél'}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Egyéni vállalkozás (EV)</h1>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs text-slate-400 font-mono">{client?.taxNumber || ''}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">
                {FORM_LABELS[taxpayerForm] || taxpayerForm}
              </span>
              <span className="text-xs text-slate-400">{EMPLOYMENT_LABELS[employmentStatus] || employmentStatus}</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-400">{VAT_LABELS[vatStatus] || vatStatus}</span>
              {evSettings?.org_type && (
                <>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600">
                    {ORG_TYPE_LABELS[evSettings.org_type] || evSettings.org_type}
                  </span>
                </>
              )}
              {evSettings?.bookkeeping_mode && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-900/30 text-sky-600">
                  {evSettings.bookkeeping_mode === 'egyszeres' ? 'Egyszeres' : 'Kettős'}
                </span>
              )}
            </div>
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
          </select>
          <Link
            to={`/accounty/${companyId}/${dateRange}/ev/setup`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" /> Beállítások
          </Link>
        </div>
      </div>

      {/* YTD Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Bevétel (YTD)</p>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{totalsLoading ? '...' : formatMillionHuf(ytdRevenue)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Kiadások</p>
          <p className="text-xl font-bold text-red-500">{totalsLoading ? '...' : formatMillionHuf(ytdExpenses)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Jövedelem</p>
          <p className="text-xl font-bold text-green-600">{totalsLoading ? '...' : formatMillionHuf(ytdIncome)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Egyenleg</p>
          <p className={cn('text-xl font-bold', (cashbookTotals?.balance || 0) >= 0 ? 'text-indigo-600' : 'text-red-600')}>
            {cashbookLoading ? '...' : formatMillionHuf(cashbookTotals?.balance || 0)}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Tételek</p>
          <p className="text-xl font-bold text-violet-600">{totalsLoading ? '...' : (realTotals?.itemCount || 0)}</p>
        </div>
      </div>

      {/* Threshold alerts */}
      {thresholds.some(t => t.status !== 'green') && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Értékhatár-figyelmeztetés</p>
          </div>
          <div className="space-y-2">
            {thresholds.filter(t => t.status !== 'green').map(t => (
              <div key={t.name} className="flex items-center justify-between text-sm">
                <span className="text-amber-700 dark:text-amber-400">{t.name}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-amber-100 dark:bg-amber-800/50 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        t.status === 'red' ? 'bg-red-500' : 'bg-amber-500'
                      )}
                      style={{ width: `${Math.min(100, t.percentage)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono tabular-nums text-amber-600">
                    {formatHuf(t.currentValue)} / {formatHuf(t.limit)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation sections */}
      <div className="space-y-4">
        {visibleSections.map(section => (
          <div key={section.title} className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50 flex items-center gap-3">
              <div className={cn('p-1.5 rounded-lg bg-gradient-to-br shadow-md', colorMap[section.color])}>
                <section.icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{section.title}</h2>
                <p className="text-[11px] text-slate-400">{section.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
              {section.items.map((item, idx) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3 transition-all group',
                    colorHover[section.color],
                    'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                    idx < section.items.length - (section.items.length % 3 === 0 ? 3 : section.items.length % 3)
                      ? 'border-b border-border/30'
                      : '',
                    (idx + 1) % 3 !== 0 ? 'sm:border-r border-border/30' : ''
                  )}
                >
                  <item.icon className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors flex-1">
                    {item.label}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
