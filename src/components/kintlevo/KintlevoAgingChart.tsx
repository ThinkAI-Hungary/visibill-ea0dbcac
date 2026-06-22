import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CAT, fmt } from '@/lib/kintlevo-helpers';
import type { AgingCategory, UnifiedInvoice } from '@/lib/kintlevo-helpers';

// Bucket configuration — single source of truth (shared with getCategory in kintlevo-helpers)
const BUCKETS: { key: AgingCategory; label: string; color: string }[] = [
  { key: 'green',  label: 'Nem lejárt',   color: '#34D399' },
  { key: 'yellow', label: '1–30 napos',   color: '#F5B544' },
  { key: 'red',    label: '31–180 napos', color: '#F26D6D' },
  { key: 'purple', label: '180+ napos',   color: '#A78BFA' },
];

interface Props {
  allInvoices: UnifiedInvoice[];
  showBrutto: boolean;
  onBucketClick?: (category: AgingCategory | null) => void;
  activeBucket?: AgingCategory | null;
}

function formatMillions(value: number): string {
  if (value === 0) return '0 Ft';
  if (Math.abs(value) >= 1_000_000) {
    return (value / 1_000_000).toLocaleString('hu-HU', { maximumFractionDigits: 1 }) + ' M Ft';
  }
  return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(value) + ' Ft';
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold" style={{ color: data.color }}>{data.label}</p>
      <p className="text-foreground">{fmt(data.amount)}</p>
      <p className="text-muted-foreground text-xs">{data.invoiceCount} számla</p>
    </div>
  );
};

export function KintlevoAgingChart({ allInvoices, showBrutto, onBucketClick, activeBucket }: Props) {
  const chartData = useMemo(() => {
    return BUCKETS.map(bucket => {
      const matching = allInvoices.filter(inv => inv.category === bucket.key);
      const amount = matching.reduce((s, inv) => s + (showBrutto ? inv.amount : inv.netAmount), 0);
      return {
        key: bucket.key,
        label: bucket.label,
        amount,
        invoiceCount: matching.length,
        color: bucket.color,
      };
    });
  }, [allInvoices, showBrutto]);

  const maxAmount = Math.max(...chartData.map(d => d.amount), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tartozásállomány kor szerint</CardTitle>
        <CardDescription>
          A nyitott kintlévőség megoszlása korosított sávonként — korfa ({showBrutto ? 'bruttó' : 'nettó'})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 10, left: 10, bottom: 5 }}
          >
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => formatMillions(v)}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
            <Bar
              dataKey="amount"
              radius={[6, 6, 0, 0]}
              maxBarSize={80}
              onClick={(_data: any, index: number) => {
                const clicked = chartData[index].key;
                onBucketClick?.(activeBucket === clicked ? null : clicked);
              }}
              style={{ cursor: onBucketClick ? 'pointer' : undefined }}
              label={({ x, y, width, value }: any) => (
                <text
                  x={x + width / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="currentColor"
                  className="fill-foreground"
                >
                  {formatMillions(value)}
                </text>
              )}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.key}
                  fill={entry.color}
                  opacity={activeBucket && activeBucket !== entry.key ? 0.3 : 1}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
