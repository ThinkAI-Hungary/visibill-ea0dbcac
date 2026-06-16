import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { TrendingUp, TrendingDown, ArrowUpDown, ChevronDown, ChevronRight, CandlestickChart, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';

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

interface FxDifferencesSectionProps {
  fxDifferences: FxDifferenceRow[];
  fxMonthlySummary: FxMonthlySummary[];
  isOpen: boolean;
  onOpenChange: (v: boolean) => void;
}

const monthLabels: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Már', '04': 'Ápr', '05': 'Máj', '06': 'Jún',
  '07': 'Júl', '08': 'Aug', '09': 'Szep', '10': 'Okt', '11': 'Nov', '12': 'Dec',
};

const fmtMonth = (m: string) => {
  const [year, month] = m.split('-');
  return `${year}. ${monthLabels[month] || month}`;
};

const fmtHuf = (v: number) => {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${Math.round(v).toLocaleString('hu-HU')} Ft`;
};

const fmtRate = (v: number) => v.toFixed(2);

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-xl text-sm">
      <div className="font-semibold mb-1.5">{fmtMonth(d.month)}</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Nyereség:</span>
          <span className="text-emerald-500 font-medium tabular-nums">{fmtHuf(d.gain)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Veszteség:</span>
          <span className="text-destructive font-medium tabular-nums">{fmtHuf(d.loss)}</span>
        </div>
        <div className="border-t border-border pt-1 flex justify-between gap-6">
          <span className="text-muted-foreground font-medium">Nettó:</span>
          <span className={`font-bold tabular-nums ${d.net >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
            {fmtHuf(d.net)}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground">{d.count} tétel</div>
      </div>
    </div>
  );
};

function MonthDetail({ month, rows }: { month: string; rows: FxDifferenceRow[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <TableRow className="cursor-pointer hover:bg-muted/50 transition-colors">
          <TableCell className="font-medium">
            <div className="flex items-center gap-1.5">
              {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              {fmtMonth(month)}
            </div>
          </TableCell>
          <TableCell className="text-right text-emerald-500 tabular-nums font-medium">
            {fmtHuf(rows.reduce((s, r) => s + (r.fx_difference > 0 ? r.fx_difference : 0), 0))}
          </TableCell>
          <TableCell className="text-right text-destructive tabular-nums font-medium">
            {fmtHuf(rows.reduce((s, r) => s + (r.fx_difference < 0 ? r.fx_difference : 0), 0))}
          </TableCell>
          <TableCell className={`text-right font-bold tabular-nums ${rows.reduce((s, r) => s + r.fx_difference, 0) >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
            {fmtHuf(rows.reduce((s, r) => s + r.fx_difference, 0))}
          </TableCell>
          <TableCell className="text-right text-muted-foreground tabular-nums">{rows.length}</TableCell>
        </TableRow>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {rows.map(row => (
          <TableRow key={`${row.invoice_source}-${row.invoice_id}`} className="bg-muted/20 text-xs">
            <TableCell className="pl-8">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] font-mono">{row.currency}</Badge>
                <span className="font-medium">{row.invoice_number}</span>
              </div>
              <div className="text-muted-foreground text-[10px] mt-0.5">{row.partner_name || '—'}</div>
            </TableCell>
            <TableCell className="text-right">
              <div className="tabular-nums">{Math.abs(row.foreign_amount).toLocaleString('hu-HU')} {row.currency}</div>
              <div className="text-muted-foreground text-[10px]">{row.delivery_date} · {fmtRate(row.delivery_rate)}</div>
            </TableCell>
            <TableCell className="text-right">
              <div className="tabular-nums">{Math.round(row.delivery_huf).toLocaleString('hu-HU')} Ft</div>
              <div className="text-muted-foreground text-[10px]">{row.settlement_date} · {fmtRate(row.settlement_rate)}</div>
            </TableCell>
            <TableCell className={`text-right font-medium tabular-nums ${row.fx_difference >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
              {fmtHuf(row.fx_difference)}
            </TableCell>
            <TableCell className="text-right">
              <Badge variant={row.fx_difference >= 0 ? 'default' : 'destructive'} className="text-[9px]">
                {row.fx_difference >= 0 ? 'Nyereség' : 'Veszteség'}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}


const FxDifferencesSection = React.memo(function FxDifferencesSection({
  fxDifferences,
  fxMonthlySummary,
  isOpen,
  onOpenChange,
}: FxDifferencesSectionProps) {
  // Total annual summary
  const annualNet = useMemo(() => fxMonthlySummary.reduce((s, m) => s + m.net, 0), [fxMonthlySummary]);
  const annualGain = useMemo(() => fxMonthlySummary.reduce((s, m) => s + m.gain, 0), [fxMonthlySummary]);
  const annualLoss = useMemo(() => fxMonthlySummary.reduce((s, m) => s + m.loss, 0), [fxMonthlySummary]);
  const totalCount = useMemo(() => fxMonthlySummary.reduce((s, m) => s + m.count, 0), [fxMonthlySummary]);

  // Chart data
  const chartData = useMemo(() =>
    fxMonthlySummary.map(m => ({
      ...m,
      label: fmtMonth(m.month),
    })),
    [fxMonthlySummary]
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
                  <CardTitle className="text-lg">Árfolyam-különbözetek</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Devizás számlák teljesítés vs. befolyás közötti árfolyamváltozás</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {/* Quick summary badges */}
                <div className="hidden md:flex items-center gap-2">
                  {totalCount > 0 && (
                    <Badge variant="outline" className="text-xs tabular-nums">{totalCount} tétel</Badge>
                  )}
                  {currencyBreakdown.map(c => (
                    <Badge key={c.currency} variant="secondary" className="text-[10px]">{c.currency}: {c.count}</Badge>
                  ))}
                </div>
                <div className={`text-xl font-bold tabular-nums ${annualNet >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                  {fmtHuf(annualNet)}
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
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Nettó különbözet</div>
                <div className={`text-lg font-bold tabular-nums ${annualNet >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                  {fmtHuf(annualNet)}
                </div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Össz. nyereség</div>
                <div className="text-lg font-bold tabular-nums text-emerald-500">{fmtHuf(annualGain)}</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Össz. veszteség</div>
                <div className="text-lg font-bold tabular-nums text-destructive">{fmtHuf(annualLoss)}</div>
              </div>
              <div className="rounded-lg bg-muted/30 p-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  TAO hatás (9%)
                  <Info className="w-3 h-3" />
                </div>
                <div className={`text-lg font-bold tabular-nums ${annualNet >= 0 ? 'text-destructive' : 'text-emerald-500'}`}>
                  {annualNet >= 0
                    ? `+${Math.round(annualNet * 0.09).toLocaleString('hu-HU')} Ft`
                    : `${Math.round(annualNet * 0.09).toLocaleString('hu-HU')} Ft`}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Tájékoztató jellegű</div>
              </div>
            </div>

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
                    <RechartsTooltip content={<CustomTooltip />} />
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
                    <TableHead>Hónap</TableHead>
                    <TableHead className="text-right">Nyereség</TableHead>
                    <TableHead className="text-right">Veszteség</TableHead>
                    <TableHead className="text-right">Nettó</TableHead>
                    <TableHead className="text-right w-20">Tételek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fxMonthlySummary.map(m => (
                    <MonthDetail
                      key={m.month}
                      month={m.month}
                      rows={rowsByMonth[m.month] || []}
                    />
                  ))}
                  {/* Footer totals */}
                  <TableRow className="bg-muted/20 font-bold border-t-2">
                    <TableCell>Összesen</TableCell>
                    <TableCell className="text-right text-emerald-500 tabular-nums">{fmtHuf(annualGain)}</TableCell>
                    <TableCell className="text-right text-destructive tabular-nums">{fmtHuf(annualLoss)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${annualNet >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>{fmtHuf(annualNet)}</TableCell>
                    <TableCell className="text-right tabular-nums">{totalCount}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Currency breakdown if multiple */}
            {currencyBreakdown.length > 1 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Devizánkénti bontás</h4>
                <div className="flex flex-wrap gap-3">
                  {currencyBreakdown.map(c => (
                    <div key={c.currency} className="rounded-lg bg-muted/30 px-4 py-2.5 min-w-[120px]">
                      <div className="text-xs text-muted-foreground font-medium">{c.currency}</div>
                      <div className={`text-base font-bold tabular-nums ${c.net >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                        {fmtHuf(c.net)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{c.count} tétel</div>
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
