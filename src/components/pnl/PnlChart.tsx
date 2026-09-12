import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { getActiveLocale } from '@/lib/locale/formatters';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  F9: P&L Waterfall / Bar Chart & Trend View
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PnlChartProps {
  processedData: any[];
  inThousands: boolean;
  trendData?: Array<{ label: string; revenue: number; cost: number; profit: number }>;
}

const CHART_COLORS = {
  revenue: '#10b981',   // emerald
  expense: '#ef4444',   // red
  result: '#6366f1',    // indigo
  tax: '#f59e0b',       // amber
  final: '#8b5cf6',     // violet
};

export default function PnlChart({ processedData, inThousands, trendData }: PnlChartProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const [chartType, setChartType] = useState<'structure' | 'trend'>('structure');
  const localeCode = getActiveLocale() === 'hr' ? 'hr-HR' : 'hu-HU';

  // Build waterfall data from the capital/roman rows
  const chartData = React.useMemo(() => {
    if (!processedData || processedData.length === 0) return [];

    const findRow = (code: string) => {
      return processedData.find(r => r.row_code === code);
    };
    const findVal = (code: string) => findRow(code)?.displayBalance || 0;
    const findName = (code: string, fallback: string) => {
      const row = findRow(code);
      return row?.name ? `${row.row_code} ${row.name}` : fallback;
    };

    const fmt = (v: number) => inThousands ? Math.round(v / 1000) : Math.round(v);

    // I–III: Revenues, IV–VII: Operating costs, A: Operating result,
    // VIII–IX: Financial income/expense, B: Financial result, C: Pre-tax, X: Tax, D: After-tax
    const items = [
      { name: findName('I.', 'I. Árbevétel'), value: fmt(findVal('I.')), type: 'revenue' },
      { name: findName('II.', 'II. Aktiv. saját'), value: fmt(findVal('II.')), type: 'revenue' },
      { name: findName('III.', 'III. Egyéb bev.'), value: fmt(findVal('III.')), type: 'revenue' },
      { name: findName('IV.', 'IV. Anyagjellegű'), value: fmt(findVal('IV.')), type: 'expense' },
      { name: findName('V.', 'V. Személyi'), value: fmt(findVal('V.')), type: 'expense' },
      { name: findName('VI.', 'VI. ÉCS'), value: fmt(findVal('VI.')), type: 'expense' },
      { name: findName('VII.', 'VII. Egyéb ráf.'), value: fmt(findVal('VII.')), type: 'expense' },
      { name: findName('A.', 'A. Üzemi'), value: fmt(findVal('A.')), type: 'result' },
      { name: findName('VIII.', 'VIII. Pü. bev.'), value: fmt(findVal('VIII.')), type: 'revenue' },
      { name: findName('IX.', 'IX. Pü. ráf.'), value: fmt(findVal('IX.')), type: 'expense' },
      { name: findName('C.', 'C. Adóz. előtti'), value: fmt(findVal('C.')), type: 'result' },
      { name: findName('X.', 'X. Adó'), value: fmt(findVal('X.')), type: 'tax' },
      { name: findName('D.', 'D. Adózott'), value: fmt(findVal('D.')), type: 'final' },
    ].filter(d => d.value !== 0); // Skip zero items

    return items;
  }, [processedData, inThousands]);

  if (chartData.length === 0 && (!trendData || trendData.length === 0)) return null;

  const unit = inThousands ? t('accounting:profit_and_loss.units.thousand_huf', 'E Ft') : t('accounting:profit_and_loss.units.huf', 'Ft');
  const fmt = (v: number) => inThousands ? Math.round(v / 1000) : Math.round(v);

  return (
    <div className="bg-card border border-border/60 rounded-xl p-4 print:hidden">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {t('accounting:profit_and_loss.charts.chart_title', 'Eredménykimutatás — Grafikon')}
        </h3>
        {trendData && trendData.length > 0 && (
          <div className="flex bg-muted p-0.5 rounded-lg border text-xs">
            <button
              onClick={() => setChartType('structure')}
              className={cn(
                "px-3 py-1 rounded-md font-medium transition-all",
                chartType === 'structure' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t('accounting:profit_and_loss.charts.structure', 'Struktúra')}
            </button>
            <button
              onClick={() => setChartType('trend')}
              className={cn(
                "px-3 py-1 rounded-md font-medium transition-all",
                chartType === 'trend' 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t('accounting:profit_and_loss.charts.trend', 'Trend')}
            </button>
          </div>
        )}
      </div>

      {chartType === 'trend' && trendData ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={trendData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="label" 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
            />
            <YAxis 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v: number) => new Intl.NumberFormat(localeCode).format(v)}
            />
            <Tooltip
              formatter={(value: number) => [`${new Intl.NumberFormat(localeCode).format(value)} ${unit}`, '']}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
            <Bar name={t('accounting:profit_and_loss.rows.I', 'I. Árbevétel')} dataKey={(d) => fmt(d.revenue)} fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
            <Bar name={t('accounting:profit_and_loss.charts.cost', 'Anyag + Személyi')} dataKey={(d) => fmt(d.cost)} fill={CHART_COLORS.expense} radius={[4, 4, 0, 0]} />
            <Bar name={t('accounting:profit_and_loss.charts.operating_profit', 'A. Üzemi eredmény')} dataKey={(d) => fmt(d.profit)} fill={CHART_COLORS.result} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                angle={-35}
                textAnchor="end"
                height={70}
                interval={0}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => new Intl.NumberFormat(localeCode).format(v)}
              />
              <Tooltip
                formatter={(value: number) => [`${new Intl.NumberFormat(localeCode).format(value)} ${unit}`, t('common:labels.amount', 'Összeg')]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.4} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={50}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      entry.type === 'revenue' ? CHART_COLORS.revenue
                        : entry.type === 'expense' ? CHART_COLORS.expense
                        : entry.type === 'result' ? CHART_COLORS.result
                        : entry.type === 'tax' ? CHART_COLORS.tax
                        : CHART_COLORS.final
                    }
                    opacity={entry.type === 'result' || entry.type === 'final' ? 1 : 0.75}
                  />
                ))}
                <LabelList 
                  dataKey="value" 
                  position="top" 
                  formatter={(v: number) => new Intl.NumberFormat(localeCode).format(v)}
                  style={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 justify-center mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.revenue }} /> {t('accounting:profit_and_loss.charts.revenue', 'Bevétel')}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.expense }} /> {t('accounting:profit_and_loss.charts.expense', 'Ráfordítás')}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.result }} /> {t('accounting:profit_and_loss.charts.result', 'Eredmény')}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.tax }} /> {t('accounting:profit_and_loss.charts.tax', 'Adó')}</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.final }} /> {t('accounting:profit_and_loss.charts.net_profit', 'Adózott')}</span>
          </div>
        </>
      )}
    </div>
  );
}

