import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { fmt, getAgingCategoryLabel } from '@/lib/kintlevo-helpers';
import { formatCurrency } from '@/lib/utils';
import type { AgingCategory, UnifiedInvoice } from '@/lib/kintlevo-helpers';

// Bucket configuration — colors and keys
const BUCKETS: { key: AgingCategory; color: string }[] = [
  { key: 'green',  color: '#34D399' },
  { key: 'yellow', color: '#F5B544' },
  { key: 'red',    color: '#F26D6D' },
  { key: 'purple', color: '#A78BFA' },
];

interface Props {
  allInvoices: UnifiedInvoice[];
  showBrutto: boolean;
  onBucketClick?: (category: AgingCategory | null) => void;
  activeBucket?: AgingCategory | null;
}

const CustomTooltip = ({ active, payload, t }: any) => {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-semibold" style={{ color: data.color }}>{data.label}</p>
      <p className="text-foreground">{fmt(data.amount)}</p>
      <p className="text-muted-foreground text-xs">
        {t('receivables:invoices_count', '{{count}} számla', { count: data.invoiceCount })}
      </p>
    </div>
  );
};

export function KintlevoAgingChart({ allInvoices, showBrutto, onBucketClick, activeBucket }: Props) {
  const { t } = useTranslation(['receivables', 'common']);

  const chartData = useMemo(() => {
    return BUCKETS.map(bucket => {
      const matching = allInvoices.filter(inv => inv.category === bucket.key);
      const amount = matching.reduce((s, inv) => s + (showBrutto ? inv.amount : inv.netAmount), 0);
      return {
        key: bucket.key,
        label: getAgingCategoryLabel(bucket.key, t),
        amount,
        invoiceCount: matching.length,
        color: bucket.color,
      };
    });
  }, [allInvoices, showBrutto, t]);

  const modeText = (showBrutto
    ? String(t('receivables:gross', { defaultValue: 'bruttó' }))
    : String(t('receivables:net', { defaultValue: 'nettó' }))).toLowerCase();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('receivables:chart.title', 'Tartozásállomány kor szerint')}</CardTitle>
        <CardDescription>
          {t('receivables:chart.description', 'A nyitott kintlévőség megoszlása korosított sávonként — korfa ({{mode}})', { mode: modeText })}
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
              tickFormatter={(v: number) => formatCurrency(v, undefined, true)}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <Tooltip content={<CustomTooltip t={t} />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
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
                  {formatCurrency(value, undefined, true)}
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
