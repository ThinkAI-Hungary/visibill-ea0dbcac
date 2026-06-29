import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Receipt, ArrowLeft, BookOpen, Calculator, FileText,
  TrendingUp, AlertTriangle, Calendar, Settings, ChevronRight,
  Wallet, BarChart3, Users, Car, Package, Shield,
  Landmark, ClipboardList, PiggyBank, Scale, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatMillionHuf, formatPercent, formatHuf, getEvThresholds } from '@/lib/evCalculations';
import type { ThresholdStatus } from '@/lib/evCalculations';
import { useEvClientSettings, useCashbookTotals } from '@/hooks/useEvData';

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
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [taxYear, setTaxYear] = useState(2026);

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: evSettings, isLoading: settingsLoading } = useEvClientSettings(id, taxYear);
  const { data: cashbookTotals, isLoading: totalsLoading } = useCashbookTotals(id, taxYear);

  const taxpayerForm = evSettings?.taxpayer_form || 'atalany';
  const employmentStatus = evSettings?.employment_status || 'foallasu';
  const vatStatus = evSettings?.vat_status || 'alanyi_mentes';

  const ytdRevenue = cashbookTotals?.totalBevetel || 0;
  const ytdExpenses = cashbookTotals?.totalKiadas || 0;
  const ytdIncome = ytdRevenue - ytdExpenses;

  const thresholds = getEvThresholds(ytdRevenue, taxpayerForm, false);

  // Navigation sections
  const sections = [
    {
      title: 'Törzsadatok & életciklus',
      description: 'Alapadatok, beállítások, tevékenység-történet',
      icon: Settings,
      color: 'indigo',
      items: [
        { to: `/accounty/client/${id}/ev/master-data`, label: 'Törzsadatok', icon: ClipboardList },
        { to: `/accounty/client/${id}/ev/lifecycle`, label: 'Életciklus', icon: Calendar },
        { to: `/accounty/client/${id}/ev/setup`, label: 'Beállítás varázsló', icon: Settings },
      ],
    },
    {
      title: 'Adózási forma & kalkulátorok',
      description: 'Adóalap számítás, forma-választó, összehasonlítás',
      icon: Calculator,
      color: 'indigo',
      items: [
        { to: `/accounty/client/${id}/ev/flat-rate`, label: 'Átalányadó kalkulátor', icon: PiggyBank },
        { to: `/accounty/client/${id}/ev/entrepreneurial/base`, label: 'Vállalkozói SZJA – adóalap', icon: TrendingUp },
        { to: `/accounty/client/${id}/ev/entrepreneurial/dividend`, label: 'Vállalkozói SZJA – osztalékalap', icon: Wallet },
        { to: `/accounty/client/${id}/ev/kata`, label: 'KATA kisadózó', icon: Shield },
        { to: `/accounty/client/${id}/ev/depreciation`, label: 'Értékcsökkenési leírás (ÉCS)', icon: BarChart3 },
        { to: `/accounty/client/${id}/ev/compare`, label: 'Adóforma-összehasonlítás', icon: Scale },
      ],
    },
    {
      title: 'Pénztárkönyv',
      description: 'Szja tv. 5. sz. melléklet szerinti könyvvezetés',
      icon: BookOpen,
      color: 'violet',
      items: [
        { to: `/accounty/client/${id}/ev/cashbook`, label: 'Pénztárkönyv', icon: BookOpen },
        { to: `/accounty/client/${id}/ev/cashbook/ledger`, label: 'Főkönyvi nézet', icon: BarChart3 },
        { to: `/accounty/client/${id}/ev/cashbook/close`, label: 'Időszaki zárás', icon: ClipboardList },
      ],
    },
    {
      title: 'Részletező nyilvántartások',
      description: 'Szja tv. 5. sz. melléklet II. rész',
      icon: FileText,
      color: 'teal',
      items: [
        { to: `/accounty/client/${id}/ev/records`, label: 'Nyilvántartások áttekintő', icon: FileText },
        { to: `/accounty/client/${id}/ev/records/receivables`, label: 'Vevői követelések', icon: Users },
        { to: `/accounty/client/${id}/ev/records/payables`, label: 'Szállítói tartozások', icon: Package },
        { to: `/accounty/client/${id}/ev/records/fixed-assets`, label: 'Tárgyi eszközök', icon: Landmark },
        { to: `/accounty/client/${id}/ev/records/vehicle-log`, label: 'Útnyilvántartás', icon: Car },
      ],
    },
    {
      title: 'Közteher-modul',
      description: 'Járulékok, HIPA, ÁFA, kamarai hozzájárulás, cégautóadó',
      icon: Landmark,
      color: 'rose',
      items: [
        { to: `/accounty/client/${id}/ev/contributions`, label: 'TB-járulék & szocho', icon: Calculator },
        { to: `/accounty/client/${id}/ev/hipa`, label: 'Helyi iparűzési adó', icon: Landmark },
        { to: `/accounty/client/${id}/ev/vat`, label: 'ÁFA kezelés', icon: Receipt },
        { to: `/accounty/client/${id}/ev/chamber`, label: 'Kamarai hozzájárulás', icon: Shield },
        { to: `/accounty/client/${id}/ev/car-tax`, label: 'Cégautóadó', icon: Car },
        { to: `/accounty/client/${id}/ev/innovation`, label: 'Innovációs járulék', icon: TrendingUp },
      ],
    },
    {
      title: 'Bevallások & Riportok',
      description: 'SZJA, járulék, KATA, HIPA, ÁFA/cégautó bevallások',
      icon: ClipboardList,
      color: 'cyan',
      items: [
        { to: `/accounty/client/${id}/ev/returns`, label: 'SZJA bevallás (25SZJA)', icon: FileText },
        { to: `/accounty/client/${id}/ev/returns/contrib`, label: 'Járulékbevallás (2658)', icon: Calculator },
        { to: `/accounty/client/${id}/ev/returns/kata`, label: 'KATA bevallás', icon: Shield },
        { to: `/accounty/client/${id}/ev/returns/hipa`, label: 'HIPA bevallás', icon: Landmark },
        { to: `/accounty/client/${id}/ev/returns/vat-car`, label: 'ÁFA / cégautóadó bevallás', icon: Car },
        { to: `/accounty/client/${id}/ev/income-report`, label: 'Jövedelem-kimutatás', icon: TrendingUp },
        { to: `/accounty/client/${id}/ev/optimization`, label: 'Adóoptimalizálás', icon: BarChart3 },
      ],
    },
    {
      title: 'Szervezeti nyilvántartás',
      description: 'Civil szervezet, társasház, egyszeres könyvvitel mód',
      icon: Users,
      color: 'indigo',
      items: [
        { to: `/accounty/client/${id}/ev/org/bookkeeping`, label: 'Könyvvezetés mód', icon: BookOpen },
        { to: `/accounty/client/${id}/ev/org/civil`, label: 'Civil szervezet', icon: Users },
        { to: `/accounty/client/${id}/ev/org/condominium`, label: 'Társasház', icon: Landmark },
        { to: `/accounty/client/${id}/ev/org/other`, label: 'Egyéb szervezet', icon: Package },
        { to: `/accounty/client/${id}/ev/org/simplified-report`, label: 'Egyszerűsített beszámoló', icon: FileText },
      ],
    },
  ];

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
      {/* Breadcrumb & Header */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">{client?.name || 'Ügyfél'}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {client?.name || 'Ügyfél'}
            </h1>
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
            to={`/accounty/client/${id}/ev/setup`}
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
          <p className={cn('text-xl font-bold', ytdIncome >= 0 ? 'text-indigo-600' : 'text-red-600')}>
            {totalsLoading ? '...' : formatMillionHuf(cashbookTotals?.balance || 0)}
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Tételek</p>
          <p className="text-xl font-bold text-violet-600">{totalsLoading ? '...' : Object.keys(cashbookTotals?.totals || {}).length}</p>
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
        {sections.map(section => (
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
