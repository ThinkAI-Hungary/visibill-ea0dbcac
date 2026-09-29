import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronRight,
  CandlestickChart,
  Info,
  BookOpen,
  Pencil,
  Check,
  X,
  Search,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { getActiveLocale } from '@/lib/locale/formatters';

export interface FxMonthlySummary {
  month: string;
  gain: number;
  loss: number;
  net: number;
  count: number;
}

export interface FxDifferenceRow {
  invoice_id: string;
  invoice_source: string;
  invoice_number: string;
  partner_name: string;
  invoice_direction: string;
  currency: string;
  foreign_amount: number;
  delivery_date: string;
  delivery_rate: number;
  delivery_huf: number;
  settlement_date: string;
  settlement_rate: number;
  settlement_huf: number;
  fx_difference: number;
  settlement_month: string;
}

export interface GlAccount {
  id: string;
  gl_number: string;
  short_name: string;
}

export interface FxGlSettings {
  fx_gain_gl_number: string | null;
  fx_loss_gl_number: string | null;
}

export interface FxDifferencesSectionProps {
  fxDifferences: FxDifferenceRow[];
  fxMonthlySummary: FxMonthlySummary[];
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
  fxGlSettings?: FxGlSettings | null;
  glAccounts?: GlAccount[];
  onSaveFxGl?: (gainGl: string, lossGl: string) => void;
}

const monthLabelsHu: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Már', '04': 'Ápr', '05': 'Máj', '06': 'Jún',
  '07': 'Júl', '08': 'Aug', '09': 'Szep', '10': 'Okt', '11': 'Nov', '12': 'Dec',
};

const monthLabelsHr: Record<string, string> = {
  '01': 'Sij', '02': 'Velj', '03': 'Ožu', '04': 'Tra', '05': 'Svi', '06': 'Lip',
  '07': 'Srp', '08': 'Kol', '09': 'Ruj', '10': 'Lis', '11': 'Stu', '12': 'Pro',
};

const fmtMonth = (m: string, isHr: boolean) => {
  const [year, month] = m.split('-');
  const labels = isHr ? monthLabelsHr : monthLabelsHu;
  return `${year}. ${labels[month] || month}`;
};

const fmtCurrencySigned = (v: number) => {
  const sign = v > 0 ? '+' : '';
  return `${sign}${formatCurrency(v)}`;
};

const fmtRate = (v: number) => (v != null ? Number(v).toFixed(2) : '—');

const CustomTooltip = ({ active, payload, isHr, t }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl text-xs z-50">
      <div className="font-semibold mb-1.5 text-foreground">{fmtMonth(d.month, isHr)}</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{t('dashboard:fx_differences.gain', 'Nyereség')}:</span>
          <span className="text-emerald-500 font-medium tabular-nums">{fmtCurrencySigned(d.gain)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{t('dashboard:fx_differences.loss', 'Veszteség')}:</span>
          <span className="text-destructive font-medium tabular-nums">{fmtCurrencySigned(d.loss)}</span>
        </div>
        <div className="border-t border-border pt-1 flex justify-between gap-4">
          <span className="text-muted-foreground font-medium">{t('dashboard:fx_differences.net', 'Nettó')}:</span>
          <span className={`font-bold tabular-nums ${d.net >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
            {fmtCurrencySigned(d.net)}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground pt-0.5">
          {t('dashboard:fx_differences.items_count', { count: d.count, defaultValue: `${d.count} tétel` })}
        </div>
      </div>
    </div>
  );
};

const FxDifferencesSection = React.memo(function FxDifferencesSection({
  fxDifferences,
  fxMonthlySummary,
  isOpen,
  onOpenChange,
  fxGlSettings,
  glAccounts = [],
  onSaveFxGl,
}: FxDifferencesSectionProps) {
  const { t } = useTranslation(['dashboard', 'common']);
  const isHr = getActiveLocale() === 'hr';

  // ── GL mapping state ──
  const [isEditingGl, setIsEditingGl] = useState(false);
  const currentGain = fxGlSettings?.fx_gain_gl_number || '';
  const currentLoss = fxGlSettings?.fx_loss_gl_number || '';
  const defaultGain = '976';
  const defaultLoss = '876';

  const [gainGl, setGainGl] = useState(currentGain || defaultGain);
  const [lossGl, setLossGl] = useState(currentLoss || defaultLoss);

  const startEditGl = useCallback(() => {
    setGainGl(currentGain || defaultGain);
    setLossGl(currentLoss || defaultLoss);
    setIsEditingGl(true);
  }, [currentGain, currentLoss]);

  const handleSaveGl = useCallback(() => {
    onSaveFxGl?.(gainGl, lossGl);
    setIsEditingGl(false);
  }, [gainGl, lossGl, onSaveFxGl]);

  const handleCancelGl = useCallback(() => {
    setIsEditingGl(false);
  }, []);

  const sortedGlAccounts = useMemo(() => {
    if (!glAccounts?.length) return [];
    return [...glAccounts].sort((a, b) => a.gl_number.localeCompare(b.gl_number));
  }, [glAccounts]);

  // ── Totals ──
  const annualNet = useMemo(() => fxMonthlySummary.reduce((s, m) => s + m.net, 0), [fxMonthlySummary]);
  const annualGain = useMemo(() => fxMonthlySummary.reduce((s, m) => s + m.gain, 0), [fxMonthlySummary]);
  const annualLoss = useMemo(() => fxMonthlySummary.reduce((s, m) => s + m.loss, 0), [fxMonthlySummary]);
  const totalCount = useMemo(() => fxMonthlySummary.reduce((s, m) => s + m.count, 0), [fxMonthlySummary]);

  // ── Currencies ──
  const currencyBreakdown = useMemo(() => {
    const c: Record<string, { currency: string; net: number; count: number }> = {};
    fxDifferences.forEach(row => {
      const cur = row.currency || '?';
      if (!c[cur]) c[cur] = { currency: cur, net: 0, count: 0 };
      c[cur].net += row.fx_difference;
      c[cur].count += 1;
    });
    return Object.values(c).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
  }, [fxDifferences]);

  // ── Chart data ──
  const chartData = useMemo(() =>
    fxMonthlySummary.map(m => ({
      ...m,
      label: fmtMonth(m.month, isHr),
    })),
    [fxMonthlySummary, isHr]
  );

  // ── Filter and Search State ──
  const [selectedCurrencyFilter, setSelectedCurrencyFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // ── Opened months accordion state (default open latest month with data) ──
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>(() => {
    if (fxMonthlySummary.length > 0) {
      const latestMonth = fxMonthlySummary[fxMonthlySummary.length - 1]?.month;
      return latestMonth ? { [latestMonth]: true } : {};
    }
    return {};
  });

  const toggleMonth = useCallback((month: string) => {
    setExpandedMonths(prev => ({
      ...prev,
      [month]: !prev[month],
    }));
  }, []);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return fxDifferences.filter(row => {
      const matchesCurrency = selectedCurrencyFilter === 'all' || row.currency === selectedCurrencyFilter;
      if (!matchesCurrency) return false;
      if (!term) return true;
      const invoiceNum = (row.invoice_number || '').toLowerCase();
      const partner = (row.partner_name || '').toLowerCase();
      return invoiceNum.includes(term) || partner.includes(term);
    });
  }, [fxDifferences, selectedCurrencyFilter, searchTerm]);

  // Group filtered items by month
  const rowsByMonth = useMemo(() => {
    const m: Record<string, FxDifferenceRow[]> = {};
    filteredRows.forEach(row => {
      const key = row.settlement_month || 'unknown';
      if (!m[key]) m[key] = [];
      m[key].push(row);
    });
    return m;
  }, [filteredRows]);

  // Distinct months in descending order
  const distinctMonths = useMemo(() => {
    const months = Array.from(new Set(fxDifferences.map(r => r.settlement_month || 'unknown')));
    return months.sort((a, b) => b.localeCompare(a));
  }, [fxDifferences]);

  if (fxDifferences.length === 0 && fxMonthlySummary.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card className="border border-border/80 shadow-card overflow-hidden">
        {/* Szekció Fejléc Bar */}
        <CollapsibleTrigger asChild>
          <CardHeader className={cn(
            "cursor-pointer hover:bg-muted/30 transition-colors px-5 py-4 space-y-0",
            isOpen && "border-b border-border/40"
          )}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <CandlestickChart className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base font-semibold leading-tight text-foreground truncate">
                    {t('dashboard:fx_differences.title', 'Árfolyam-különbözetek')}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate hidden sm:block">
                    {t('dashboard:fx_differences.subtitle', 'Devizás számlák teljesítés vs. befolyás közötti árfolyamváltozás')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {/* Deviza címkék (pills) */}
                <div className="hidden md:flex items-center gap-1.5">
                  {currencyBreakdown.map(c => (
                    <span
                      key={c.currency}
                      className="px-2 py-0.5 text-[11px] font-mono font-medium rounded bg-muted/60 text-muted-foreground border border-border/50"
                    >
                      {c.currency}: {c.count}
                    </span>
                  ))}
                  {totalCount > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded bg-muted/60 text-muted-foreground border border-border/50">
                      {t('dashboard:fx_differences.items_count', { count: totalCount, defaultValue: `${totalCount} tétel` })}
                    </span>
                  )}
                </div>

                {/* Éves Konszolidált Nettó Összeg */}
                <div className={cn(
                  'text-base sm:text-lg font-bold tabular-nums tracking-tight',
                  annualNet >= 0 ? 'text-emerald-500' : 'text-destructive'
                )}>
                  {fmtCurrencySigned(annualNet)}
                </div>

                {/* Collapse nyíl */}
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        {/* Szekció Belső Tartalom (Fintech Dense Split: 5 hasáb bal, 7 hasáb jobb) */}
        <CollapsibleContent>
          <CardContent className="p-4 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              
              {/* ════════ BAL OLDAL (5 hasáb / ~40%): KPI-k + Mini Havi Chart + Főkönyvi Sáv ════════ */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-4">
                
                {/* 1. 2×2 Mini KPI Rács */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Nettó különbözet */}
                  <div className="rounded-lg bg-muted/30 border border-border/60 p-3 flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">
                      {t('dashboard:fx_differences.net_difference', 'Nettó különbözet')}
                    </span>
                    <span className={cn(
                      'text-lg font-bold tabular-nums tracking-tight',
                      annualNet >= 0 ? 'text-emerald-500' : 'text-destructive'
                    )}>
                      {fmtCurrencySigned(annualNet)}
                    </span>
                  </div>

                  {/* TAO Hatás (9%) */}
                  <div className="rounded-lg bg-muted/30 border border-border/60 p-3 flex flex-col justify-between" title={t('dashboard:fx_differences.informative', 'Tájékoztató jellegű kalkuláció')}>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                      {t('dashboard:fx_differences.tax_impact', 'TAO hatás (9%)')}
                      <Info className="w-2.5 h-2.5 text-muted-foreground/70" />
                    </span>
                    <span className={cn(
                      'text-lg font-bold tabular-nums tracking-tight',
                      annualNet >= 0 ? 'text-destructive' : 'text-emerald-500'
                    )}>
                      {annualNet >= 0
                        ? `+${formatCurrency(Math.round(annualNet * 0.09))}`
                        : formatCurrency(Math.round(annualNet * 0.09))}
                    </span>
                  </div>

                  {/* Realizált nyereség */}
                  <div className="rounded-lg bg-muted/30 border border-border/60 p-3 flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">
                      {t('dashboard:fx_differences.total_gain', 'Össz. nyereség')}
                    </span>
                    <span className="text-lg font-bold tabular-nums text-emerald-500 tracking-tight">
                      {fmtCurrencySigned(annualGain)}
                    </span>
                  </div>

                  {/* Realizált veszteség */}
                  <div className="rounded-lg bg-muted/30 border border-border/60 p-3 flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">
                      {t('dashboard:fx_differences.total_loss', 'Össz. veszteség')}
                    </span>
                    <span className="text-lg font-bold tabular-nums text-destructive tracking-tight">
                      {fmtCurrencySigned(annualLoss)}
                    </span>
                  </div>
                </div>

                {/* 2. Havi Nettó Árfolyam-eredmény Grafikon */}
                <div className="rounded-lg bg-muted/20 border border-border/60 p-3.5 flex flex-col flex-1 min-h-[190px] justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-foreground">
                      {t('dashboard:fx_differences.monthly_trend', 'Havi nettó árfolyam-eredmény')}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {new Date().getFullYear()}.
                    </span>
                  </div>

                  {chartData.length > 0 ? (
                    <div className="h-[140px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v: number) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}e` : String(v)}
                          />
                          <RechartsTooltip content={<CustomTooltip isHr={isHr} t={t} />} />
                          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" opacity={0.6} />
                          <Bar dataKey="net" radius={[3, 3, 0, 0]} maxBarSize={28}>
                            {chartData.map((entry, i) => (
                              <Cell
                                key={i}
                                fill={entry.net >= 0 ? '#10b981' : '#ef4444'}
                                fillOpacity={0.85}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[140px] flex items-center justify-center text-xs text-muted-foreground">
                      {t('common:no_data', 'Nincs adat')}
                    </div>
                  )}
                </div>

                {/* 3. Kompakt Beágyazott Főkönyvi Számlaszámok Sáv */}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs" data-fx-gl-mapping>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span>{t('dashboard:fx_differences.gl_classification', 'Főkönyvi besorolás')}</span>
                    </div>
                    {!isEditingGl && onSaveFxGl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                        onClick={startEditGl}
                      >
                        <Pencil className="w-3 h-3" />
                        {t('common:buttons.edit', 'Szerkesztés')}
                      </Button>
                    )}
                  </div>

                  {isEditingGl ? (
                    <div className="space-y-2.5 pt-1 animate-in fade-in duration-150">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                            {t('dashboard:fx_differences.gain', 'Nyereség')} (GL)
                          </label>
                          {sortedGlAccounts.length > 0 ? (
                            <Select value={gainGl} onValueChange={setGainGl}>
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="976" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[200px]">
                                {sortedGlAccounts.map(g => (
                                  <SelectItem key={g.id} value={g.gl_number.split('-')[0].replace(/\./g, '')} className="text-xs">
                                    {g.gl_number} — {g.short_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={gainGl}
                              onChange={e => setGainGl(e.target.value)}
                              className="h-7 text-xs font-mono"
                              placeholder="976"
                            />
                          )}
                        </div>

                        <div>
                          <label className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                            {t('dashboard:fx_differences.loss', 'Veszteség')} (GL)
                          </label>
                          {sortedGlAccounts.length > 0 ? (
                            <Select value={lossGl} onValueChange={setLossGl}>
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue placeholder="876" />
                              </SelectTrigger>
                              <SelectContent className="max-h-[200px]">
                                {sortedGlAccounts.map(g => (
                                  <SelectItem key={g.id} value={g.gl_number.split('-')[0].replace(/\./g, '')} className="text-xs">
                                    {g.gl_number} — {g.short_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={lossGl}
                              onChange={e => setLossGl(e.target.value)}
                              className="h-7 text-xs font-mono"
                              placeholder="876"
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 pt-0.5">
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] gap-1" onClick={handleCancelGl}>
                          <X className="w-3 h-3" />
                          {t('common:buttons.cancel', 'Mégse')}
                        </Button>
                        <Button size="sm" className="h-6 px-2.5 text-[11px] gap-1" onClick={handleSaveGl}>
                          <Check className="w-3 h-3" />
                          {t('common:buttons.save', 'Mentés')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-card border border-border/70 font-semibold text-foreground">
                        {currentGain || defaultGain} ({t('dashboard:fx_differences.gain', 'Nyereség')})
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-card border border-border/70 font-semibold text-foreground">
                        {currentLoss || defaultLoss} ({t('dashboard:fx_differences.loss', 'Veszteség')})
                      </span>
                    </div>
                  )}
                </div>

              </div>

              {/* ════════ JOBB OLDAL (7 hasáb / ~60%): 520px-es ScrollArea Havi Accordion ════════ */}
              <div className="lg:col-span-7 h-[520px] flex flex-col border border-border/80 rounded-lg bg-card overflow-hidden shadow-sm">
                
                {/* Toolbar: Devizaszűrő tabok + Élő kereső */}
                <div className="px-4 py-2.5 border-b border-border/40 flex flex-wrap items-center justify-between gap-2 bg-muted/20 shrink-0">
                  <div className="flex items-center gap-1 overflow-x-auto">
                    <Button
                      variant={selectedCurrencyFilter === 'all' ? 'secondary' : 'ghost'}
                      size="sm"
                      className={cn(
                        "h-7 px-2.5 text-xs font-medium",
                        selectedCurrencyFilter === 'all' && "bg-background shadow-xs text-foreground font-semibold"
                      )}
                      onClick={() => setSelectedCurrencyFilter('all')}
                    >
                      {t('common:all', 'Mind')} ({fxDifferences.length})
                    </Button>
                    {currencyBreakdown.map(c => (
                      <Button
                        key={c.currency}
                        variant={selectedCurrencyFilter === c.currency ? 'secondary' : 'ghost'}
                        size="sm"
                        className={cn(
                          "h-7 px-2.5 text-xs font-medium",
                          selectedCurrencyFilter === c.currency && "bg-background shadow-xs text-foreground font-semibold"
                        )}
                        onClick={() => setSelectedCurrencyFilter(c.currency)}
                      >
                        {c.currency} ({c.count})
                      </Button>
                    ))}
                  </div>

                  <div className="relative w-44">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={t('dashboard:fx_differences.search_placeholder', 'Keresés...')}
                      className="h-7 pl-8 pr-6 text-xs bg-background"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Görgethető Havi Lista (Radix ScrollArea) */}
                <ScrollArea className="flex-1 p-0">
                  {distinctMonths.length === 0 || filteredRows.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                      <CandlestickChart className="w-8 h-8 opacity-40 mb-2" />
                      <p className="text-xs font-medium">{t('dashboard:fx_differences.no_matching_items', 'Nincs a feltételeknek megfelelő árfolyam-tétel.')}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {distinctMonths.map(month => {
                        const monthRows = rowsByMonth[month] || [];
                        if (monthRows.length === 0) return null;

                        const isExpanded = !!expandedMonths[month];
                        const monthGain = monthRows.reduce((s, r) => s + (r.fx_difference > 0 ? r.fx_difference : 0), 0);
                        const monthLoss = monthRows.reduce((s, r) => s + (r.fx_difference < 0 ? r.fx_difference : 0), 0);
                        const monthNet = monthRows.reduce((s, r) => s + r.fx_difference, 0);

                        return (
                          <div key={month} className="month-group">
                            {/* Hónap Fejléc Sor (Accordion trigger) */}
                            <div
                              onClick={() => toggleMonth(month)}
                              className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-muted/40 transition-colors bg-card select-none"
                            >
                              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                                <ChevronRight className={cn(
                                  "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                                  isExpanded && "rotate-90 text-foreground"
                                )} />
                                <span>{fmtMonth(month, isHr)}</span>
                                <span className="text-[11px] font-normal text-muted-foreground">
                                  ({monthRows.length} {t('dashboard:fx_differences.table.items', 'tétel')})
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-xs tabular-nums font-medium">
                                <span className="text-emerald-500 hidden sm:inline">{fmtCurrencySigned(monthGain)}</span>
                                <span className="text-destructive hidden sm:inline">{fmtCurrencySigned(monthLoss)}</span>
                                <span className={cn(
                                  "font-bold",
                                  monthNet >= 0 ? "text-emerald-500" : "text-destructive"
                                )}>
                                  {fmtCurrencySigned(monthNet)}
                                </span>
                              </div>
                            </div>

                            {/* Kibontott Tételek (Sub-items) */}
                            {isExpanded && (
                              <div className="bg-muted/15 divide-y divide-border/20 border-t border-border/20">
                                {monthRows.map(row => {
                                  const isGain = row.fx_difference >= 0;
                                  const glNum = isGain ? (currentGain || defaultGain) : (currentLoss || defaultLoss);

                                  return (
                                    <div
                                      key={`${row.invoice_source}-${row.invoice_id}`}
                                      className="px-4 py-2 pl-9 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 hover:bg-muted/40 transition-colors text-xs"
                                    >
                                      {/* Bal oldal: Deviza badge, számlaszám, partner, árfolyamok */}
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-4">
                                            {row.currency}
                                          </Badge>
                                          <span className="font-semibold text-foreground truncate max-w-[200px]" title={row.invoice_number}>
                                            {row.invoice_number}
                                          </span>
                                          <span className="text-[11px] text-muted-foreground truncate max-w-[160px]" title={row.partner_name}>
                                            · {row.partner_name || '—'}
                                          </span>
                                        </div>

                                        <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                                          <span>Telj: {row.delivery_date} ({fmtRate(row.delivery_rate)})</span>
                                          <span>→</span>
                                          <span>Kifiz: {row.settlement_date} ({fmtRate(row.settlement_rate)})</span>
                                        </div>
                                      </div>

                                      {/* Jobb oldal: Deviza összeg, Különbözet, GL pill */}
                                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 tabular-nums">
                                        <span className="text-[11px] text-muted-foreground">
                                          {Math.abs(row.foreign_amount).toLocaleString(isHr ? 'hr-HR' : 'hu-HU')} {row.currency}
                                        </span>

                                        <span className={cn(
                                          "font-semibold text-xs",
                                          isGain ? "text-emerald-500" : "text-destructive"
                                        )}>
                                          {fmtCurrencySigned(row.fx_difference)}
                                        </span>

                                        <span
                                          className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-card border border-border text-muted-foreground shrink-0"
                                          title={`Főkönyvi számlaszám: ${glNum}`}
                                        >
                                          {glNum}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>

              </div>

            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
});

export default FxDifferencesSection;
