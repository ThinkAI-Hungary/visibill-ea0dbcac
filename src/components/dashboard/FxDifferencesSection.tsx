import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, ArrowUpDown, ChevronDown, ChevronRight, CandlestickChart, Info, BookOpen, Pencil, Check, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { useTranslation } from 'react-i18next';
import { getActiveLocale } from '@/lib/locale/formatters';

interface FxMonthlySummary {
  month: string;
  gain: number;
  loss: number;
  net: number;
  count: number;
}

interface FxDifferenceRow {
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

interface GlAccount {
  id: string;
  gl_number: string;
  short_name: string;
}

interface FxGlSettings {
  fx_gain_gl_number: string | null;
  fx_loss_gl_number: string | null;
}

interface FxDifferencesSectionProps {
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

const fmtRate = (v: number) => v.toFixed(2);

const CustomTooltip = ({ active, payload, isHr, t }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl text-sm">
      <div className="font-semibold mb-1.5">{fmtMonth(d.month, isHr)}</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">{t('dashboard:fx_differences.gain', 'Nyereség')}:</span>
          <span className="text-emerald-500 font-medium tabular-nums">{fmtCurrencySigned(d.gain)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">{t('dashboard:fx_differences.loss', 'Veszteség')}:</span>
          <span className="text-destructive font-medium tabular-nums">{fmtCurrencySigned(d.loss)}</span>
        </div>
        <div className="border-t border-border pt-1 flex justify-between gap-6">
          <span className="text-muted-foreground font-medium">{t('dashboard:fx_differences.net', 'Nettó')}:</span>
          <span className={`font-bold tabular-nums ${d.net >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
            {fmtCurrencySigned(d.net)}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {t('dashboard:fx_differences.items_count', { count: d.count, defaultValue: `${d.count} tétel` })}
        </div>
      </div>
    </div>
  );
};

function MonthDetail({
  month,
  rows,
  fxGlSettings,
  onEditGl,
  isHr,
}: {
  month: string;
  rows: FxDifferenceRow[];
  fxGlSettings?: FxGlSettings | null;
  onEditGl?: () => void;
  isHr: boolean;
}) {
  const { t } = useTranslation(['dashboard', 'common']);
  const [open, setOpen] = useState(false);

  const gainGl = fxGlSettings?.fx_gain_gl_number || '976';
  const lossGl = fxGlSettings?.fx_loss_gl_number || '876';

  const monthGain = rows.reduce((s, r) => s + (r.fx_difference > 0 ? r.fx_difference : 0), 0);
  const monthLoss = rows.reduce((s, r) => s + (r.fx_difference < 0 ? r.fx_difference : 0), 0);
  const monthNet = rows.reduce((s, r) => s + r.fx_difference, 0);

  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-1.5">
            {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            {fmtMonth(month, isHr)}
          </div>
        </TableCell>
        <TableCell className="text-right text-emerald-500 tabular-nums font-medium">
          {fmtCurrencySigned(monthGain)}
        </TableCell>
        <TableCell className="text-right text-destructive tabular-nums font-medium">
          {fmtCurrencySigned(monthLoss)}
        </TableCell>
        <TableCell className={`text-right font-bold tabular-nums ${monthNet >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
          {fmtCurrencySigned(monthNet)}
        </TableCell>
        <TableCell />
        <TableCell className="text-right text-muted-foreground tabular-nums">{rows.length}</TableCell>
      </TableRow>
      
      {open && rows.map(row => {
        const isGain = row.fx_difference >= 0;
        const glNum = isGain ? gainGl : lossGl;
        return (
        <TableRow key={`${row.invoice_source}-${row.invoice_id}`} className="bg-muted/20 text-xs animate-in fade-in duration-200">
          <TableCell className="pl-8">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] font-mono">{row.currency}</Badge>
              <span className="font-medium">{row.invoice_number}</span>
            </div>
            <div className="text-muted-foreground text-[10px] mt-0.5">{row.partner_name || '—'}</div>
          </TableCell>
          <TableCell className="text-right">
            <div className="tabular-nums">{Math.abs(row.foreign_amount).toLocaleString(isHr ? 'hr-HR' : 'hu-HU')} {row.currency}</div>
            <div className="text-muted-foreground text-[10px]">{row.delivery_date} · {fmtRate(row.delivery_rate)}</div>
          </TableCell>
          <TableCell className="text-right">
            <div className="tabular-nums">{formatCurrency(row.delivery_huf)}</div>
            <div className="text-muted-foreground text-[10px]">{row.settlement_date} · {fmtRate(row.settlement_rate)}</div>
          </TableCell>
          <TableCell className={`text-right font-medium tabular-nums ${isGain ? 'text-emerald-500' : 'text-destructive'}`}>
            {fmtCurrencySigned(row.fx_difference)}
          </TableCell>
          <TableCell className="text-center">
            <button
              onClick={(e) => { e.stopPropagation(); onEditGl?.(); }}
              className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[9px] font-mono tabular-nums hover:bg-muted/80 transition-colors cursor-pointer group"
              title={t('dashboard:fx_differences.table.edit_gl_tooltip', { glNum, defaultValue: `Főkönyvi szám szerkesztése (${glNum})` })}
            >
              <BookOpen className="w-2.5 h-2.5 text-muted-foreground group-hover:text-foreground" />
              {glNum}
              <Pencil className="w-2 h-2 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </TableCell>
          <TableCell className="text-right">
            <Badge variant={isGain ? 'default' : 'destructive'} className="text-[9px]">
              {isGain ? t('dashboard:fx_differences.gain', 'Nyereség') : t('dashboard:fx_differences.loss', 'Veszteség')}
            </Badge>
          </TableCell>
        </TableRow>
        );
      })}
    </>
  );
}


function FxGlMappingBlock({
  fxGlSettings,
  glAccounts,
  onSaveFxGl,
}: {
  fxGlSettings?: FxGlSettings | null;
  glAccounts?: GlAccount[];
  onSaveFxGl?: (gainGl: string, lossGl: string) => void;
}) {
  const { t } = useTranslation(['dashboard', 'common']);
  const [editing, setEditing] = useState(false);
  const [gainGl, setGainGl] = useState('');
  const [lossGl, setLossGl] = useState('');

  const currentGain = fxGlSettings?.fx_gain_gl_number || '';
  const currentLoss = fxGlSettings?.fx_loss_gl_number || '';
  const defaultGain = '976';
  const defaultLoss = '876';

  const startEdit = useCallback(() => {
    setGainGl(currentGain || defaultGain);
    setLossGl(currentLoss || defaultLoss);
    setEditing(true);
  }, [currentGain, currentLoss]);

  const handleSave = useCallback(() => {
    onSaveFxGl?.(gainGl, lossGl);
    setEditing(false);
  }, [gainGl, lossGl, onSaveFxGl]);

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, []);

  // Find matching GL account for display
  const findGlLabel = (glNumber: string) => {
    if (!glAccounts?.length || !glNumber) return null;
    const match = glAccounts.find(g => {
      const cleanNum = g.gl_number.split('-')[0].replace(/\./g, '');
      return cleanNum.startsWith(glNumber) || glNumber.startsWith(cleanNum);
    });
    return match ? `${match.gl_number} — ${match.short_name}` : null;
  };

  // Sort GL accounts for the dropdown, prioritizing 8xx and 9xx
  const sortedAccounts = useMemo(() => {
    if (!glAccounts?.length) return [];
    return [...glAccounts].sort((a, b) => a.gl_number.localeCompare(b.gl_number));
  }, [glAccounts]);

  return (
    <div className="rounded-lg border border-border/50 bg-muted/10 p-4" data-fx-gl-mapping>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">{t('dashboard:fx_differences.gl_classification', 'Főkönyvi besorolás')}</h4>
        </div>
        {!editing && onSaveFxGl && (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={startEdit}>
            <Pencil className="w-3 h-3" />
            {t('common:buttons.edit', 'Szerkesztés')}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                {t('dashboard:fx_differences.gain_gl_label', 'Árfolyamnyereség GL szám')}
              </label>
              {sortedAccounts.length > 0 ? (
                <Select value={gainGl} onValueChange={setGainGl}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={t('dashboard:fx_differences.choose_gl', 'Válassz GL számot...')} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {sortedAccounts.map(g => (
                      <SelectItem key={g.id} value={g.gl_number.split('-')[0].replace(/\./g, '')} className="text-xs">
                        {g.gl_number} — {g.short_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  type="text"
                  value={gainGl}
                  onChange={e => setGainGl(e.target.value)}
                  placeholder="pl. 976"
                  className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                />
              )}
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">
                {t('dashboard:fx_differences.loss_gl_label', 'Árfolyamveszteség GL szám')}
              </label>
              {sortedAccounts.length > 0 ? (
                <Select value={lossGl} onValueChange={setLossGl}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={t('dashboard:fx_differences.choose_gl', 'Válassz GL számot...')} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {sortedAccounts.map(g => (
                      <SelectItem key={g.id} value={g.gl_number.split('-')[0].replace(/\./g, '')} className="text-xs">
                        {g.gl_number} — {g.short_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  type="text"
                  value={lossGl}
                  onChange={e => setLossGl(e.target.value)}
                  placeholder="pl. 876"
                  className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={handleCancel}>
              <X className="w-3 h-3" />
              {t('common:buttons.cancel', 'Mégse')}
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={handleSave}>
              <Check className="w-3 h-3" />
              {t('common:buttons.save', 'Mentés')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
              {t('dashboard:fx_differences.gain', 'Nyereség')}
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-sm font-medium tabular-nums">
                {currentGain || <span className="text-muted-foreground italic">{defaultGain} {t('dashboard:fx_differences.default_badge', '(alap)')}</span>}
              </span>
            </div>
            {findGlLabel(currentGain || defaultGain) && (
              <div className="text-[10px] text-muted-foreground mt-0.5">{findGlLabel(currentGain || defaultGain)}</div>
            )}
          </div>
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
              {t('dashboard:fx_differences.loss', 'Veszteség')}
            </div>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-3.5 h-3.5 text-destructive" />
              <span className="text-sm font-medium tabular-nums">
                {currentLoss || <span className="text-muted-foreground italic">{defaultLoss} {t('dashboard:fx_differences.default_badge', '(alap)')}</span>}
              </span>
            </div>
            {findGlLabel(currentLoss || defaultLoss) && (
              <div className="text-[10px] text-muted-foreground mt-0.5">{findGlLabel(currentLoss || defaultLoss)}</div>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
        <Info className="w-3 h-3 shrink-0" />
        {t('dashboard:fx_differences.gl_info', 'Az árfolyamkülönbözetek a főkönyvben ezen számlák alatt jelennek meg.')}
      </p>
    </div>
  );
}


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

  // Total annual summary
  const annualNet = useMemo(() => fxMonthlySummary.reduce((s, m) => s + m.net, 0), [fxMonthlySummary]);
  const annualGain = useMemo(() => fxMonthlySummary.reduce((s, m) => s + m.gain, 0), [fxMonthlySummary]);
  const annualLoss = useMemo(() => fxMonthlySummary.reduce((s, m) => s + m.loss, 0), [fxMonthlySummary]);
  const totalCount = useMemo(() => fxMonthlySummary.reduce((s, m) => s + m.count, 0), [fxMonthlySummary]);

  // Chart data
  const chartData = useMemo(() =>
    fxMonthlySummary.map(m => ({
      ...m,
      label: fmtMonth(m.month, isHr),
    })),
    [fxMonthlySummary, isHr]
  );

  // Group items by month
  const rowsByMonth = useMemo(() => {
    const m: Record<string, FxDifferenceRow[]> = {};
    fxDifferences.forEach(row => {
      const key = row.settlement_month || 'unknown';
      if (!m[key]) m[key] = [];
      m[key].push(row);
    });
    return m;
  }, [fxDifferences]);

  // Currency breakdown
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

  if (fxDifferences.length === 0 && fxMonthlySummary.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card className="border-border/50">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                  <CandlestickChart className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {t('dashboard:fx_differences.title', 'Árfolyam-különbözetek')}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('dashboard:fx_differences.subtitle', 'Devizás számlák teljesítés vs. befolyás közötti árfolyamváltozás')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Quick summary badges */}
                <div className="hidden md:flex items-center gap-2">
                  {totalCount > 0 && (
                    <Badge variant="outline" className="text-xs tabular-nums">
                      {t('dashboard:fx_differences.items_count', { count: totalCount, defaultValue: `${totalCount} tétel` })}
                    </Badge>
                  )}
                  {currencyBreakdown.map(c => (
                    <Badge key={c.currency} variant="secondary" className="text-[10px]">{c.currency}: {c.count}</Badge>
                  ))}
                </div>
                <div className={`text-xl font-bold tabular-nums ${annualNet >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                  {fmtCurrencySigned(annualNet)}
                </div>
                <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6 pt-0">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg bg-muted/30 p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  {t('dashboard:fx_differences.net_difference', 'Nettó különbözet')}
                </div>
                <div className={`text-lg font-bold tabular-nums ${annualNet >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                  {fmtCurrencySigned(annualNet)}
                </div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  {t('dashboard:fx_differences.total_gain', 'Össz. nyereség')}
                </div>
                <div className="text-lg font-bold tabular-nums text-emerald-500">{fmtCurrencySigned(annualGain)}</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  {t('dashboard:fx_differences.total_loss', 'Össz. veszteség')}
                </div>
                <div className="text-lg font-bold tabular-nums text-destructive">{fmtCurrencySigned(annualLoss)}</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  {t('dashboard:fx_differences.tax_impact', 'TAO hatás (9%)')}
                  <Info className="w-3 h-3" />
                </div>
                <div className={`text-lg font-bold tabular-nums ${annualNet >= 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                  {annualNet >= 0
                    ? `+${formatCurrency(Math.round(annualNet * 0.09))}`
                    : formatCurrency(Math.round(annualNet * 0.09))}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {t('dashboard:fx_differences.informative', 'Tájékoztató jellegű')}
                </div>
              </div>
            </div>

            {/* GL account mapping */}
            <FxGlMappingBlock
              fxGlSettings={fxGlSettings}
              glAccounts={glAccounts}
              onSaveFxGl={onSaveFxGl}
            />

            {/* Bar chart */}
            {chartData.length > 0 && (
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}e`}
                    />
                    <RechartsTooltip content={<CustomTooltip isHr={isHr} t={t} />} />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                    <Bar dataKey="net" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.net >= 0 ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'}
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Monthly detail table */}
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead>{t('dashboard:fx_differences.table.month', 'Hónap')}</TableHead>
                    <TableHead className="text-right">{t('dashboard:fx_differences.table.gain', 'Nyereség')}</TableHead>
                    <TableHead className="text-right">{t('dashboard:fx_differences.table.loss', 'Veszteség')}</TableHead>
                    <TableHead className="text-right">{t('dashboard:fx_differences.table.net', 'Nettó')}</TableHead>
                    <TableHead className="text-center w-16">{t('dashboard:fx_differences.table.gl_number', 'FK szám')}</TableHead>
                    <TableHead className="text-right w-20">{t('dashboard:fx_differences.table.items', 'Tételek')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fxMonthlySummary.map(m => (
                    <MonthDetail
                      key={m.month}
                      month={m.month}
                      rows={rowsByMonth[m.month] || []}
                      fxGlSettings={fxGlSettings}
                      isHr={isHr}
                      onEditGl={() => {
                        // Scroll to the GL mapping block and trigger edit
                        const glBlock = document.querySelector('[data-fx-gl-mapping]');
                        if (glBlock) {
                          glBlock.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          // Trigger the edit button click after scroll
                          setTimeout(() => {
                            const editBtn = glBlock.querySelector('button');
                            if (editBtn) editBtn.click();
                          }, 400);
                        }
                      }}
                    />
                  ))}
                  {/* Footer totals */}
                  <TableRow className="bg-muted/20 font-bold border-t-2">
                    <TableCell>{t('dashboard:fx_differences.table.total', 'Összesen')}</TableCell>
                    <TableCell className="text-right text-emerald-500 tabular-nums">{fmtCurrencySigned(annualGain)}</TableCell>
                    <TableCell className="text-right text-destructive tabular-nums">{fmtCurrencySigned(annualLoss)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${annualNet >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>{fmtCurrencySigned(annualNet)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right tabular-nums">{totalCount}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Currency breakdown if multiple */}
            {currencyBreakdown.length > 1 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {t('dashboard:fx_differences.currency_breakdown', 'Devizánkénti bontás')}
                </h4>
                <div className="flex flex-wrap gap-3">
                  {currencyBreakdown.map(c => (
                    <div key={c.currency} className="rounded-lg bg-muted/30 px-4 py-2.5 min-w-[120px]">
                      <div className="text-xs text-muted-foreground font-medium">{c.currency}</div>
                      <div className={`text-base font-bold tabular-nums ${c.net >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                        {fmtCurrencySigned(c.net)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {t('dashboard:fx_differences.items_count', { count: c.count, defaultValue: `${c.count} tétel` })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
});

export default FxDifferencesSection;
