import { useDateRange } from '@/contexts/DateRangeContext';
import React, { useState, useMemo } from 'react';
import { Link, useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
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
const FORM_LABELS_HR: Record<string, string> = {
  atalany: 'Paušalni porez',
  vszja: 'Dohodak',
  kata: 'KATA',
};

const EMPLOYMENT_LABELS_HR: Record<string, string> = {
  foallasu: 'Puno radno vrijeme',
  mellekallasu: 'Nepuno radno vrijeme',
  kiegeszito: 'Dopunska djelatnost',
};

const VAT_LABELS_HR: Record<string, string> = {
  alanyi_mentes: 'Izvan sustava PDV-a',
  afas: 'U sustavu PDV-a',
  penzforgalmi: 'Prema naplaćenim naknadama',
};

const ORG_TYPE_LABELS_HR: Record<string, string> = {
  egyesulet: 'Udruga',
  alapitvany: 'Zaklada',
  egyhaz: 'Vjerska zajednica',
  tarsashaz: 'Stambena zgrada',
  lakasszov: 'Stambena zadruga',
  mrp: 'ESOP organizacija',
  egyeb: 'Ostale organizacije',
};

function formatEvAmount(amount: number, isHr: boolean): string {
  if (isHr) {
    if (Math.abs(amount) >= 1_000_000) {
      return `${(amount / 1_000_000).toFixed(1)} M €`;
    }
    return new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount) + ' €';
  }
  return formatMillionHuf(amount);
}


// ─── Component ──────────────────────────────────────────────────────────────

export default function ClientEvMainPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const prefix = pathname.startsWith('/hr') ? '/hr' : '';
  const isHr = pathname.startsWith('/hr');
  const id = companyId;
  const { data: client, isLoading: clientLoading } = useAccountyClient(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const { dateFrom, setDateFrom, setDateTo, dateFromFormatted, dateToFormatted } = useDateRange();
  const taxYear = dateFrom.getFullYear();
  
  const setTaxYear = (year: number) => {
    setDateFrom(new Date(year, 0, 1));
    setDateTo(new Date(year, 11, 31));
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
      title: isHr ? 'Matični podaci i životni ciklus' : 'Törzsadatok & életciklus',
      description: isHr ? 'Osnovni podaci, postavke, povijest aktivnosti' : 'Alapadatok, beállítások, tevékenység-történet',
      icon: Settings,
      color: 'indigo',
      items: [
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/master-data?year=${taxYear}`, label: isHr ? 'Matični podaci' : 'Törzsadatok', icon: ClipboardList },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/lifecycle?year=${taxYear}`, label: isHr ? 'Životni ciklus' : 'Életciklus', icon: Calendar },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/setup?year=${taxYear}`, label: isHr ? 'Čarobnjak za postavke' : 'Beállítás varázsló', icon: Settings },
      ],
    },
    {
      title: isHr ? 'Porezni oblik i kalkulatori' : 'Adózási forma & kalkulátorok',
      description: isHr ? 'Izračun porezne osnovice, odabir oblika, usporedba' : 'Adóalap számítás, forma-választó, összehasonlítás',
      icon: Calculator,
      color: 'indigo',
      items: [
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/flat-rate?year=${taxYear}`, label: isHr ? 'Kalkulator paušalnog poreza' : 'Átalányadó kalkulátor', icon: PiggyBank },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/entrepreneurial/base?year=${taxYear}`, label: isHr ? 'Porez na dohodak – osnovica' : 'Vállalkozói SZJA – adóalap', icon: TrendingUp },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/entrepreneurial/dividend?year=${taxYear}`, label: isHr ? 'Porez na dohodak – udio u dobiti' : 'Vállalkozói SZJA – osztalékalap', icon: Wallet },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/kata?year=${taxYear}`, label: isHr ? 'KATA paušalist' : 'KATA kisadózó', icon: Shield },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/depreciation?year=${taxYear}`, label: isHr ? 'Amortizacija (DI)' : 'Értékcsökkenési leírás (ÉCS)', icon: BarChart3 },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/thresholds?year=${taxYear}`, label: isHr ? 'Praćenje pragova (Limit)' : 'Értékhatár-figyelő (Keretfigyelő)', icon: AlertTriangle },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/compare?year=${taxYear}`, label: isHr ? 'Usporedba poreznih oblika' : 'Adóforma-összehasonlítás', icon: Scale },
      ],
    },
    {
      title: isHr ? 'Knjiga primitaka i izdataka (KPI)' : 'Pénztárkönyv',
      description: isHr ? 'Vođenje evidencije prema propisima' : 'Szja tv. 5. sz. melléklet szerinti könyvvezetés',
      icon: BookOpen,
      color: 'violet',
      items: [
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/cashbook?year=${taxYear}`, label: isHr ? 'Knjiga primitaka i izdataka' : 'Pénztárkönyv', icon: BookOpen },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/cashbook/ledger?year=${taxYear}`, label: isHr ? 'Glavna knjiga' : 'Főkönyvi nézet', icon: BarChart3 },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/cashbook/close?year=${taxYear}`, label: isHr ? 'Periodično zatvaranje' : 'Időszaki zárás', icon: ClipboardList },
      ],
    },
    {
      title: isHr ? 'Pomoćne evidencije' : 'Részletező nyilvántartások',
      description: isHr ? 'Evidencija tražbina i obveza' : 'Szja tv. 5. sz. melléklet II. rész',
      icon: FileText,
      color: 'teal',
      items: [
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/records?year=${taxYear}`, label: isHr ? 'Pregled evidencija' : 'Nyilvántartások áttekintő', icon: FileText },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/records/receivables?year=${taxYear}`, label: isHr ? 'Potraživanja od kupaca' : 'Vevői követelések', icon: Users },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/records/payables?year=${taxYear}`, label: isHr ? 'Obveze prema dobavljačima' : 'Szállítói tartozások', icon: Package },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/records/fixed-assets?year=${taxYear}`, label: isHr ? 'Dugotrajna imovina' : 'Tárgyi eszközök', icon: Landmark },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/records/vehicle-log?year=${taxYear}`, label: isHr ? 'Evidencija o korištenju vozila (Loko)' : 'Útnyilvántartás', icon: Car },
      ],
    },
    {
      title: isHr ? 'Javna davanja i doprinosi' : 'Közteher-modul',
      description: isHr ? 'Doprinosi, komorski doprinos, porez na tvrtku, PDV' : 'Járulékok, HIPA, ÁFA, kamarai hozzájárulás, cégautóadó',
      icon: Landmark,
      color: 'rose',
      items: [
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/contributions?year=${taxYear}`, label: isHr ? 'MIO i zdravstveni doprinosi' : 'TB-járulék & szocho', icon: Calculator },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/hipa?year=${taxYear}`, label: isHr ? 'Lokalni porez na poslovanje' : 'Helyi iparűzési adó', icon: Landmark },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/vat?year=${taxYear}`, label: isHr ? 'Upravljanje PDV-om' : 'ÁFA kezelés', icon: Receipt },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/chamber?year=${taxYear}`, label: isHr ? 'Komorski doprinos' : 'Kamarai hozzájárulás', icon: Shield },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/car-tax?year=${taxYear}`, label: isHr ? 'Porez na cestovna motorna vozila' : 'Cégautóadó', icon: Car },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/innovation?year=${taxYear}`, label: isHr ? 'Naknada za općekorisne funkcije šuma' : 'Innovációs járulék', icon: TrendingUp },
      ],
    },
    {
      title: isHr ? 'Prijave i izvještaji' : 'Bevallások & Riportok',
      description: isHr ? 'Godišnja prijava, JOPPD, PDV obrasci' : 'SZJA, járulék, KATA, HIPA, ÁFA/cégautó bevallások',
      icon: ClipboardList,
      color: 'cyan',
      items: [
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/returns?year=${taxYear}`, label: isHr ? 'Godišnja prijava poreza (DOH)' : 'SZJA bevallás (25SZJA)', icon: FileText },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/returns/contrib?year=${taxYear}`, label: isHr ? 'Obrazac JOPPD' : 'Járulékbevallás (2658)', icon: Calculator },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/returns/kata?year=${taxYear}`, label: isHr ? 'KATA prijava' : 'KATA bevallás', icon: Shield },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/returns/hipa?year=${taxYear}`, label: isHr ? 'Prijava lokalnog poreza' : 'HIPA bevallás', icon: Landmark },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/returns/vat-car?year=${taxYear}`, label: isHr ? 'PDV / Prijava motornih vozila' : 'ÁFA / cégautóadó bevallás', icon: Car },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/income-report?year=${taxYear}`, label: isHr ? 'Izvještaj o dohotku' : 'Jövedelem-kimutatás', icon: TrendingUp },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/optimization?year=${taxYear}`, label: isHr ? 'Porezna optimizacija' : 'Adóoptimalizálás', icon: BarChart3 },
      ],
    },
    {
      title: isHr ? 'Evidencija organizacija' : 'Szervezeti nyilvántartás',
      description: isHr ? 'Udruge, stambene zgrade, jednostavno knjigovodstvo' : 'Civil szervezet, társasház, egyszeres könyvvitel mód',
      icon: Users,
      color: 'indigo',
      items: [
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/org/bookkeeping?year=${taxYear}`, label: isHr ? 'Način vođenja knjiga' : 'Könyvvezetés mód', icon: BookOpen },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/org/civil?year=${taxYear}`, label: isHr ? 'Udruga' : 'Civil szervezet', icon: Users },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/org/condominium?year=${taxYear}`, label: isHr ? 'Stambena zgrada' : 'Társasház', icon: Landmark },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/org/other?year=${taxYear}`, label: isHr ? 'Ostale organizacije' : 'Egyéb szervezet', icon: Package },
        { to: `${prefix}/eaisybooks/${companyId}/${dateRange}/ev/org/simplified-report?year=${taxYear}`, label: isHr ? 'Pojednostavljeni izvještaj' : 'Egyszerűsített beszámoló', icon: FileText },
      ],
    },
  ], [id, taxYear, isHr, prefix, companyId, dateRange]);

  const visibleSections = useMemo(() => {
    const isOrg = !!evSettings?.org_type;
    return sections.filter(sec => {
      if (sec.title === (isHr ? 'Evidencija organizacija' : 'Szervezeti nyilvántartás')) {
        return isOrg;
      }
      return true;
    });
  }, [sections, evSettings?.org_type]);

  const colorMap: Record<string, string> = {
    indigo: 'from-indigo-500 to-purple-600 shadow-primary/20',
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
    <div className="w-full space-y-6 page-animate">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-4">
          <button 
            onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate(`${prefix}/eaisybooks?tab=ev`);
              }
            }}
            className="flex items-center justify-center w-8 h-8 mt-1.5 rounded-lg border border-border bg-card hover:bg-muted transition-colors shadow-sm shrink-0"
            title={isHr ? 'Natrag' : 'Vissza'}
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {clientLoading ? (
                <div className="h-3.5 w-32 bg-muted rounded animate-pulse" />
              ) : (
                <span className="text-xs font-semibold text-muted-foreground">{client?.name || (isHr ? 'Klijent' : 'Ügyfél')}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{isHr ? 'Obrt' : 'Egyéni vállalkozás (EV)'}</h1>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground font-mono">{client?.taxNumber || ''}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                {isHr ? (FORM_LABELS_HR[taxpayerForm] || taxpayerForm) : (FORM_LABELS[taxpayerForm] || taxpayerForm)}
              </span>
              <span className="text-xs text-muted-foreground">{isHr ? (EMPLOYMENT_LABELS_HR[employmentStatus] || employmentStatus) : (EMPLOYMENT_LABELS[employmentStatus] || employmentStatus)}</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{isHr ? (VAT_LABELS_HR[vatStatus] || vatStatus) : (VAT_LABELS[vatStatus] || vatStatus)}</span>
              {evSettings?.org_type && (
                <>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600">
                    {isHr ? (ORG_TYPE_LABELS_HR[evSettings.org_type] || evSettings.org_type) : (ORG_TYPE_LABELS[evSettings.org_type] || evSettings.org_type)}
                  </span>
                </>
              )}
              {evSettings?.bookkeeping_mode && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 dark:bg-sky-900/30 text-sky-600">
                  {evSettings.bookkeeping_mode === 'egyszeres' ? (isHr ? 'Jednostavno' : 'Egyszeres') : (isHr ? 'Dvojno' : 'Kettős')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={taxYear}
            onChange={(e) => ((y) => { setDateFrom(new Date(y, 0, 1)); setDateTo(new Date(y, 11, 31)); })(Number(e.target.value))}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground"
          >
            <option value={2026}>{isHr ? 'Porezna godina 2026.' : '2026. adóév'}</option>
            <option value={2025}>{isHr ? 'Porezna godina 2025.' : '2025. adóév'}</option>
          </select>
          <Link
            to={`${prefix}/eaisybooks/${companyId}/${dateRange}/ev/setup`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" /> {isHr ? 'Postavke' : 'Beállítások'}
          </Link>
        </div>
      </div>

      {/* YTD Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card rounded-lg border border-border p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">{isHr ? 'Prihod (YTD)' : 'Bevétel (YTD)'}</p>
          <p className="text-xl font-bold text-foreground">{totalsLoading ? '...' : formatEvAmount(ytdRevenue, isHr)}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">{isHr ? 'Rashodi' : 'Kiadások'}</p>
          <p className="text-xl font-bold text-red-500">{totalsLoading ? '...' : formatEvAmount(ytdExpenses, isHr)}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">{isHr ? 'Dohodak' : 'Jövedelem'}</p>
          <p className="text-xl font-bold text-green-600">{totalsLoading ? '...' : formatEvAmount(ytdIncome, isHr)}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">{isHr ? 'Saldo' : 'Egyenleg'}</p>
          <p className={cn('text-xl font-bold', (cashbookTotals?.balance || 0) >= 0 ? 'text-primary' : 'text-red-600')}>
            {cashbookLoading ? '...' : formatEvAmount(cashbookTotals?.balance || 0, isHr)}
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">{isHr ? 'Broj stavki' : 'Tételek'}</p>
          <p className="text-xl font-bold text-violet-600">{totalsLoading ? '...' : (realTotals?.itemCount || 0)}</p>
        </div>
      </div>

      {/* Threshold alerts */}
      {thresholds.some(t => t.status !== 'green') && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">{isHr ? 'Upozorenje o limitu' : 'Értékhatár-figyelmeztetés'}</p>
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
          <div key={section.title} className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50 flex items-center gap-3">
              <div className={cn('p-1.5 rounded-lg bg-gradient-to-br shadow-md', colorMap[section.color])}>
                <section.icon className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">{section.title}</h2>
                <p className="text-[11px] text-muted-foreground">{section.description}</p>
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
                    'hover:bg-muted/50',
                    idx < section.items.length - (section.items.length % 3 === 0 ? 3 : section.items.length % 3)
                      ? 'border-b border-border/30'
                      : '',
                    (idx + 1) % 3 !== 0 ? 'sm:border-r border-border/30' : ''
                  )}
                >
                  <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground/60 transition-colors shrink-0" />
                  <span className="text-sm text-foreground/90 group-hover:text-foreground dark:group-hover:text-slate-100 transition-colors flex-1">
                    {item.label}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
