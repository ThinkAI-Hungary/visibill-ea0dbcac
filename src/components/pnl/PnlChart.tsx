import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LabelList } from 'recharts';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  F9: P&L Waterfall / Bar Chart
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface PnlChartProps {
  processedData: any[];
  inThousands: boolean;
}

const CHART_COLORS = {
  revenue: '#10b981',   // emerald
  expense: '#ef4444',   // red
  result: '#6366f1',    // indigo
  tax: '#f59e0b',       // amber
  final: '#8b5cf6',     // violet
};

export default function PnlChart({ processedData, inThousands }: PnlChartProps) {
  // Build waterfall data from the capital/roman rows
  const chartData = React.useMemo(() => {
    if (!processedData || processedData.length === 0) return [];

    const findByCode = (code: string) => {
      const row = processedData.find(r => r.row_code === code);
      return row?.displayBalance || 0;
    };

    const fmt = (v: number) => inThousands ? Math.round(v / 1000) : Math.round(v);

    // I–III: Revenues, IV–VII: Operating costs, A: Operating result,
    // VIII–IX: Financial income/expense, B: Financial result, C: Pre-tax, X: Tax, D: After-tax
    const items = [
      { name: 'I. Árbevétel', value: fmt(findByCode('I.')), type: 'revenue' },
      { name: 'II. Aktiv. saját', value: fmt(findByCode('II.')), type: 'revenue' },
      { name: 'III. Egyéb bev.', value: fmt(findByCode('III.')), type: 'revenue' },
      { name: 'IV. Anyagjellegű', value: fmt(findByCode('IV.')), type: 'expense' },
      { name: 'V. Személyi', value: fmt(findByCode('V.')), type: 'expense' },
      { name: 'VI. ÉCS', value: fmt(findByCode('VI.')), type: 'expense' },
      { name: 'VII. Egyéb ráf.', value: fmt(findByCode('VII.')), type: 'expense' },
      { name: 'A. Üzemi', value: fmt(findByCode('A.')), type: 'result' },
      { name: 'VIII. Pü. bev.', value: fmt(findByCode('VIII.')), type: 'revenue' },
      { name: 'IX. Pü. ráf.', value: fmt(findByCode('IX.')), type: 'expense' },
      { name: 'C. Adóz. előtti', value: fmt(findByCode('C.')), type: 'result' },
      { name: 'X. Adó', value: fmt(findByCode('X.')), type: 'tax' },
      { name: 'D. Adózott', value: fmt(findByCode('D.')), type: 'final' },
    ].filter(d => d.value !== 0); // Skip zero items

    return items;
  }, [processedData, inThousands]);

  if (chartData.length === 0) return null;

  const unit = inThousands ? 'E Ft' : 'Ft';

  return (
    <div className="bg-card border border-border/60 rounded-xl p-4 print:hidden">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wider">
        Eredménykimutatás — Grafikon
      </h3>
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
            tickFormatter={(v: number) => new Intl.NumberFormat('hu-HU').format(v)}
          />
          <Tooltip
            formatter={(value: number) => [`${new Intl.NumberFormat('hu-HU').format(value)} ${unit}`, 'Összeg']}
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
              formatter={(v: number) => new Intl.NumberFormat('hu-HU').format(v)}
              style={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 justify-center mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.revenue }} /> Bevétel</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.expense }} /> Ráfordítás</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.result }} /> Eredmény</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.tax }} /> Adó</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.final }} /> Adózott</span>
      </div>
    </div>
  );
}
