import { useMemo } from 'react';
import { calculateDepreciation } from '@/hooks/useDepreciation';
import type { FixedAsset } from '@/types/fixed-assets';
import { formatCurrency } from '@/lib/utils';

interface DepreciationCardsProps {
  asset: FixedAsset;
  performanceLogs?: Array<{ date: string | Date; amount: number }> | null;
}

const METHOD_LABELS: Record<string, string> = {
  linear: 'Lineáris',
  degressive_syd: 'Degresszív (Évek száma)',
  sum_of_years_digits: 'Degresszív (Évek száma)',
  degressive_declining: 'Degresszív (Nettó érték)',
  declining_balance: 'Degresszív (Nettó érték)',
  progressive: 'Progresszív',
  performance: 'Teljesítményarányos',
  absolute: 'Abszolút összegű',
  multiplier: 'Szorzószámos',
  immediate: 'Azonnali',
};

function parseLocalDate(ymdStr: string): Date {
  const parts = ymdStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1; // 0-indexed
  const d = parseInt(parts[2], 10);
  return new Date(y, m, d);
}

export function DepreciationCards({ asset, performanceLogs }: DepreciationCardsProps) {
  const taoRate = asset.tao_rate_override ?? asset.tao_template?.tao_rate_percent ?? 14.5;

  const result = useMemo(() => calculateDepreciation({
    acquisitionValue: asset.acquisition_value,
    residualValue: asset.residual_value,
    activationDate: parseLocalDate(asset.activation_date),
    usefulLifeMonths: asset.useful_life_months,
    taoRatePercent: taoRate,
    disposalDate: asset.disposal_date ? parseLocalDate(asset.disposal_date) : undefined,
    depreciationMethod: asset.depreciation_method,
    performanceUnit: asset.performance_unit,
    totalPlannedPerformance: asset.total_planned_performance,
    depreciationSchedule: asset.depreciation_schedule,
    performanceLogs,
  }), [asset, taoRate, performanceLogs]);

  const usefulLifeYears = Math.floor(asset.useful_life_months / 12);
  const usefulLifeRemMonths = asset.useful_life_months % 12;
  const usefulLifeLabel = usefulLifeRemMonths > 0
    ? `${usefulLifeYears} év ${usefulLifeRemMonths} hó`
    : `${usefulLifeYears} év`;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Kettős Értékcsökkenés (Amortizáció)
      </h4>
      <div className="grid grid-cols-2 gap-3">
        {/* Számviteli ÉCS */}
        <div className="rounded-lg border border-border/50 p-4 bg-muted/20">
          <h5 className="text-sm font-bold mb-3 text-foreground">Számviteli ÉCS</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Élettartam:</span>
              <span className="font-medium">{usefulLifeLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Módszer:</span>
              <span className="font-medium">{METHOD_LABELS[asset.depreciation_method] || asset.depreciation_method || 'Lineáris'}</span>
            </div>
            {asset.depreciation_method === 'performance' && asset.performance_unit && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mértékegység:</span>
                <span className="font-medium">{asset.performance_unit}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Maradványérték:</span>
              <span className="font-medium">{formatCurrency(asset.residual_value, asset.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ÉCS Kulcs:</span>
              <span className="font-medium">{result.accounting.ratePercent}%</span>
            </div>
            <div className="h-px bg-border/50 my-2" />
            <div className="flex justify-between">
              <span className="text-foreground font-medium">Könyvsz. Érték:</span>
              <span className="font-bold text-primary">{formatCurrency(result.accounting.bookValue, asset.currency)}</span>
            </div>
          </div>
        </div>

        {/* Tao ÉCS */}
        <div className="rounded-lg border border-border/50 p-4 bg-muted/20">
          <h5 className="text-sm font-bold mb-3 text-foreground">Tao ÉCS</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tao Sablon:</span>
              <span className="font-medium text-right text-xs leading-tight max-w-[140px]">
                {asset.tao_template?.name || 'Egyedi kulcs'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">ÉCS Kulcs:</span>
              <span className="font-medium">{result.tax.ratePercent}%</span>
            </div>
            <div className="h-px bg-border/50 my-2" />
            <div className="flex justify-between">
              <span className="text-foreground font-medium">Tao Érték:</span>
              <span className="font-bold text-primary">{formatCurrency(result.tax.bookValue, asset.currency)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

