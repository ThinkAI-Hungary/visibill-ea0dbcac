import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { Clock, ShieldCheck, TrendingDown } from 'lucide-react';
import type { FixedAsset } from '@/types/fixed-assets';

export type AgingBucketKey = '0_1_year' | '1_3_years' | '3_5_years' | '5_plus';

export interface AgingBucketData {
  key: AgingBucketKey;
  label: string;
  count: number;
  grossValue: number;
  netValue: number;
  depreciationRateAvg: number;
  color: string;
}

interface AssetAgingPyramidChartProps {
  assets: FixedAsset[];
  onSelectBucket?: (bucket: AgingBucketKey | null) => void;
  selectedBucket?: AgingBucketKey | null;
}

const BUCKET_CONFIG: Record<AgingBucketKey, { label: string; color: string }> = {
  '0_1_year': { label: '0 – 1 év (Új)', color: '#10B981' }, // emerald
  '1_3_years': { label: '1 – 3 év (Fiatal)', color: '#3B82F6' }, // blue
  '3_5_years': { label: '3 – 5 év (Középkorú)', color: '#F59E0B' }, // amber
  '5_plus': { label: '5+ év (Leírt / Koros)', color: '#8B5CF6' }, // purple/violet
};

export function AssetAgingPyramidChart({
  assets,
  onSelectBucket,
  selectedBucket,
}: AssetAgingPyramidChartProps) {
  const [metric, setMetric] = useState<'net' | 'gross' | 'count'>('net');
  const [nowTimestamp] = useState(() => Date.now());

  const agingData = useMemo(() => {
    const buckets: Record<AgingBucketKey, { count: number; gross: number; net: number }> = {
      '0_1_year': { count: 0, gross: 0, net: 0 },
      '1_3_years': { count: 0, gross: 0, net: 0 },
      '3_5_years': { count: 0, gross: 0, net: 0 },
      '5_plus': { count: 0, gross: 0, net: 0 },
    };

    assets.forEach((asset) => {
      // Csak az aktív vagy már leírt eszközöket vesszük figyelembe
      if (asset.status === 'disposed') return;

      const dateStr = asset.activation_date || asset.purchase_date || asset.acquisition_date;
      let ageYears = 0;
      if (dateStr) {
        const itemDate = new Date(dateStr);
        if (!isNaN(itemDate.getTime())) {
          const diffMs = nowTimestamp - itemDate.getTime();
          ageYears = Math.max(0, diffMs / (1000 * 60 * 60 * 24 * 365.25));
        }
      }

      let bucketKey: AgingBucketKey = '0_1_year';
      if (ageYears < 1) bucketKey = '0_1_year';
      else if (ageYears < 3) bucketKey = '1_3_years';
      else if (ageYears < 5) bucketKey = '3_5_years';
      else bucketKey = '5_plus';

      const gross = Number(asset.acquisition_value || 0);
      const net = Number(asset.net_book_value ?? Math.max(0, gross - Number(asset.accumulated_depreciation || 0)));

      buckets[bucketKey].count += 1;
      buckets[bucketKey].gross += gross;
      buckets[bucketKey].net += net;
    });

    const totalGross = Object.values(buckets).reduce((s, b) => s + b.gross, 0);

    return (Object.keys(BUCKET_CONFIG) as AgingBucketKey[]).map((key) => {
      const b = buckets[key];
      const deprPercent = b.gross > 0 ? Math.round(((b.gross - b.net) / b.gross) * 100) : 0;
      return {
        key,
        label: BUCKET_CONFIG[key].label,
        count: b.count,
        grossValue: b.gross,
        netValue: b.net,
        depreciationRateAvg: deprPercent,
        color: BUCKET_CONFIG[key].color,
      };
    });
  }, [assets, nowTimestamp]);

  const totalAssetsCount = assets.filter((a) => a.status !== 'disposed').length;
  const totalNet = agingData.reduce((s, d) => s + d.netValue, 0);
  const totalGross = agingData.reduce((s, d) => s + d.grossValue, 0);

  return (
    <Card className="h-full flex flex-col shadow-sm border-border">
      <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Eszközpark Életkor és Öregedési Piramis
            </CardTitle>
            <CardDescription className="text-xs">
              Vagyonérték és fizikai korfa megoszlása az aktiválás óta eltelt idő alapján.
            </CardDescription>
          </div>

          <Tabs
            value={metric}
            onValueChange={(v) => setMetric(v as any)}
            className="w-full sm:w-auto"
          >
            <TabsList className="grid grid-cols-3 h-7 text-xs">
              <TabsTrigger value="net" className="text-xs px-2">Nettó érték</TabsTrigger>
              <TabsTrigger value="gross" className="text-xs px-2">Bruttó érték</TabsTrigger>
              <TabsTrigger value="count" className="text-xs px-2">Darabszám</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between p-4 sm:p-6 pt-2">
        {/* Recharts Vízszintes Piramis Diagram */}
        <div className="h-[210px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={agingData}
              layout="vertical"
              margin={{ top: 8, right: 24, left: 10, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
              <XAxis
                type="number"
                tickFormatter={(val) =>
                  metric === 'count'
                    ? `${val} db`
                    : `${(val / 1000000).toFixed(1)} M`
                }
                fontSize={10}
                tickLine={false}
              />
              <YAxis
                dataKey="label"
                type="category"
                width={110}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const item = payload[0].payload as AgingBucketData;
                  return (
                    <div className="bg-popover border border-border shadow-lg rounded-lg p-3 text-xs space-y-1.5 z-50">
                      <div className="font-bold flex items-center gap-1.5" style={{ color: item.color }}>
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.label}
                      </div>
                      <div className="space-y-0.5 text-muted-foreground pt-1 border-t">
                        <div className="flex justify-between gap-4">
                          <span>Könyv szerinti nettó:</span>
                          <span className="font-mono font-bold text-foreground">
                            {formatCurrency(item.netValue, 'HUF')}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Bruttó beszerzés:</span>
                          <span className="font-mono text-foreground">
                            {formatCurrency(item.grossValue, 'HUF')}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Darabszám:</span>
                          <span className="font-bold text-foreground">{item.count} db</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span>Elhasználódás foka:</span>
                          <span className="font-mono text-foreground">{item.depreciationRateAvg}%</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey={metric === 'net' ? 'netValue' : metric === 'gross' ? 'grossValue' : 'count'}
                radius={[0, 4, 4, 0]}
                onClick={(entry: any) => {
                  if (onSelectBucket) {
                    onSelectBucket(selectedBucket === entry.key ? null : entry.key);
                  }
                }}
                className="cursor-pointer"
              >
                {agingData.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={entry.color}
                    opacity={selectedBucket && selectedBucket !== entry.key ? 0.4 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Kosarak összesítő kártyái alul */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t mt-2">
          {agingData.map((bucket) => {
            const isSelected = selectedBucket === bucket.key;
            return (
              <div
                key={bucket.key}
                onClick={() => onSelectBucket && onSelectBucket(isSelected ? null : bucket.key)}
                className={`p-2 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'bg-muted/20 hover:bg-muted/40 border-border/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold truncate" style={{ color: bucket.color }}>
                    {bucket.label.split(' ')[0]} {bucket.label.split(' ')[1]}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-muted px-1 rounded text-muted-foreground">
                    {bucket.count} db
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-foreground mt-1 truncate">
                  {formatCurrency(bucket.netValue, 'HUF')}
                </div>
                <div className="text-[10px] text-muted-foreground flex items-center justify-between mt-0.5">
                  <span>Leírás:</span>
                  <span className="font-mono font-semibold">{bucket.depreciationRateAvg}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
