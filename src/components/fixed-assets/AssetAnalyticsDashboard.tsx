import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AssetAgingPyramidChart, type AgingBucketKey } from './AssetAgingPyramidChart';
import { MultiYearMovementTable } from './MultiYearMovementTable';
import { formatCurrency } from '@/lib/utils';
import { ASSET_GROUP_LABELS } from '@/types/fixed-assets';
import { Package2, TrendingUp, TrendingDown, Layers, PieChart as PieIcon, Building2 } from 'lucide-react';
import type { FixedAsset } from '@/types/fixed-assets';

interface AssetAnalyticsDashboardProps {
  assets: FixedAsset[];
  writable?: boolean;
}

const GROUP_COLORS: Record<string, string> = {
  machines: '#3B82F6',     // blue
  equipment: '#10B981',    // emerald
  vehicles: '#F59E0B',     // amber
  real_estate: '#8B5CF6',  // purple
  rights: '#EC4899',       // pink
  investments: '#06B6D4',  // cyan
};

export function AssetAnalyticsDashboard({ assets }: AssetAnalyticsDashboardProps) {
  const [selectedAgingBucket, setSelectedAgingBucket] = useState<AgingBucketKey | null>(null);

  // Aktív eszközök
  const activeAssets = useMemo(() => assets.filter((a) => a.status !== 'disposed'), [assets]);

  // KPI Mutatók
  const kpis = useMemo(() => {
    let grossTotal = 0;
    let deprTotal = 0;
    let netTotal = 0;

    activeAssets.forEach((a) => {
      const g = Number(a.acquisition_value || 0);
      const d = Number(a.accumulated_depreciation || 0);
      const n = Number(a.net_book_value ?? Math.max(0, g - d));
      grossTotal += g;
      deprTotal += d;
      netTotal += n;
    });

    const avgDeprPercent = grossTotal > 0 ? Math.round((deprTotal / grossTotal) * 100) : 0;

    return {
      activeCount: activeAssets.length,
      disposedCount: assets.filter((a) => a.status === 'disposed').length,
      grossTotal,
      deprTotal,
      netTotal,
      avgDeprPercent,
    };
  }, [activeAssets, assets]);

  // Eszközcsoport megoszlás adatok (Pie Chart)
  const groupDistribution = useMemo(() => {
    const map = new Map<string, { count: number; netValue: number; grossValue: number }>();

    activeAssets.forEach((a) => {
      const grp = a.asset_group || 'equipment';
      const existing = map.get(grp) || { count: 0, netValue: 0, grossValue: 0 };
      const g = Number(a.acquisition_value || 0);
      const d = Number(a.accumulated_depreciation || 0);
      const n = Number(a.net_book_value ?? Math.max(0, g - d));

      map.set(grp, {
        count: existing.count + 1,
        netValue: existing.netValue + n,
        grossValue: existing.grossValue + g,
      });
    });

    return Array.from(map.entries()).map(([key, val]) => ({
      key,
      name: (ASSET_GROUP_LABELS as any)[key] || key,
      count: val.count,
      netValue: val.netValue,
      grossValue: val.grossValue,
      color: GROUP_COLORS[key] || '#64748B',
    }));
  }, [activeAssets]);

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-7xl mx-auto overflow-y-auto">
      {/* ── KPI Kártyák ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="shadow-xs border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Bruttó Eszközállomány</span>
              <Package2 className="h-4 w-4 text-primary" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-2">
              {formatCurrency(kpis.grossTotal, 'HUF')}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {kpis.activeCount} aktív nyilvántartott eszköz
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-primary text-xs font-semibold">
              <span>Könyv Szerinti Nettó</span>
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-primary mt-2">
              {formatCurrency(kpis.netTotal, 'HUF')}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Tényleges mérlegérték
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Halmozott ÉCS</span>
              <TrendingDown className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-amber-600 mt-2">
              {formatCurrency(kpis.deprTotal, 'HUF')}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Átlagos elhasználódás: <span className="font-bold">{kpis.avgDeprPercent}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Kivezetett / Selejtezett</span>
              <Layers className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-2">
              {kpis.disposedCount} db
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Értékesített vagy selejtezett tételek
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Grafikus Elemzés: Öregedési Piramis + Kategória Megoszlás ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Bal oldal: Öregedési Piramis (7 oszlop) */}
        <div className="lg:col-span-7">
          <AssetAgingPyramidChart
            assets={activeAssets}
            selectedBucket={selectedAgingBucket}
            onSelectBucket={setSelectedAgingBucket}
          />
        </div>

        {/* Jobb oldal: Eszközcsoportok Megoszlása Donut Chart (5 oszlop) */}
        <div className="lg:col-span-5">
          <Card className="h-full flex flex-col shadow-sm border-border">
            <CardHeader className="pb-2 pt-4 px-4 sm:px-6">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <PieIcon className="h-4 w-4 text-primary" />
                Vagyonmegoszlás Eszközcsoportonként
              </CardTitle>
              <CardDescription className="text-xs">
                Könyv szerinti nettó érték aránya mérlegcsoportok szerint.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between p-4 sm:p-6 pt-2">
              <div className="h-[190px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupDistribution}
                      dataKey="netValue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {groupDistribution.map((entry) => (
                        <Cell key={entry.key} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border shadow-lg rounded-lg p-2.5 text-xs space-y-1">
                            <div className="font-bold" style={{ color: data.color }}>
                              {data.name}
                            </div>
                            <div className="text-muted-foreground">
                              Nettó: <span className="font-mono font-bold text-foreground">{formatCurrency(data.netValue, 'HUF')}</span>
                            </div>
                            <div className="text-muted-foreground">
                              Darabszám: <span className="font-bold text-foreground">{data.count} db</span>
                            </div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Jelmagyarázat */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t mt-2">
                {groupDistribution.map((item) => (
                  <div key={item.key} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="font-mono font-semibold ml-2">{item.count} db</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Alsó Szekció: Vállalati Többéves Mozgástábla ── */}
      <div>
        <MultiYearMovementTable assets={activeAssets} />
      </div>
    </div>
  );
}
