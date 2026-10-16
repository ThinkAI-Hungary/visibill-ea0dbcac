import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['hr', 'common']);
  const taoRate = asset.tao_rate_override ?? asset.tao_template?.tao_rate_percent ?? 14.5;

  const result = useMemo(() => calculateDepreciation({
    acquisitionValue: asset.acquisition_value,
    residualValue: asset.residual_value,
    activationDate: parseLocalDate(asset.activation_date),
    usefulLifeMonths: asset.useful_life_months,
    taoRatePercent: taoRate,
    developmentReserveAmount: asset.development_reserve_amount,
    disposalDate: asset.disposal_date ? parseLocalDate(asset.disposal_date) : undefined,
    depreciationMethod: asset.depreciation_method,
    performanceUnit: asset.performance_unit,
    totalPlannedPerformance: asset.total_planned_performance,
    depreciationSchedule: asset.depreciation_schedule,
    performanceLogs,
    taxDepreciationBase: asset.tax_depreciation_base,
    grantDepreciationBase: asset.grant_depreciation_base,
    grantDepreciationRate: asset.grant_depreciation_rate,
    grantDepreciationMethod: asset.grant_depreciation_method,
    openingAccumulatedDepreciation: asset.opening_accumulated_depreciation,
    openingTaxDepreciation: asset.opening_tax_depreciation,
    lastDepreciationDate: asset.last_depreciation_date,
    depreciationRatePercent: asset.depreciation_rate_percent,
  }), [asset, taoRate, performanceLogs]);

  const usefulLifeYears = Math.floor(asset.useful_life_months / 12);
  const usefulLifeRemMonths = asset.useful_life_months % 12;
  const usefulLifeLabel = usefulLifeRemMonths > 0
    ? t('hr:fixed_assets.cards.years_months', { defaultValue: `${usefulLifeYears} év ${usefulLifeRemMonths} hó`, years: usefulLifeYears, months: usefulLifeRemMonths })
    : t('hr:fixed_assets.cards.years_only', { defaultValue: `${usefulLifeYears} év`, years: usefulLifeYears });

  const hasDevReserve = Number(asset.development_reserve_amount) > 0;
  const hasOpening = Boolean(asset.last_depreciation_date || (asset.opening_accumulated_depreciation && asset.opening_accumulated_depreciation > 0));
  const hasGrant = Boolean(result.grant);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          {hasGrant
            ? t('hr:fixed_assets.cards.title_triple', 'Hármas Értékcsökkenés (Számviteli, TAO és Pályázati)')
            : t('hr:fixed_assets.cards.title', 'Kettős Értékcsökkenés (Amortizáció)')}
        </h4>
        {hasOpening && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            {t('hr:fixed_assets.cards.opening_badge', {
              defaultValue: `Átvett nyitó karton (${asset.last_depreciation_date || 'lezárt'})`,
              date: asset.last_depreciation_date
            })}
          </span>
        )}
      </div>

      <div className={`grid grid-cols-1 ${hasGrant ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3`}>
        {/* Számviteli ÉCS */}
        <div className="rounded-lg border border-border/50 p-4 bg-muted/20">
          <h5 className="text-sm font-bold mb-3 text-foreground">{t('hr:fixed_assets.cards.accounting_depr', 'Számviteli ÉCS')}</h5>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('hr:fixed_assets.cards.lifetime', 'Élettartam:')}</span>
              <span className="font-medium">{usefulLifeLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('hr:fixed_assets.cards.method', 'Módszer:')}</span>
              <span className="font-medium">
                {t(`hr:fixed_assets.activation_dialog.depreciation_methods.${asset.depreciation_method}`, METHOD_LABELS[asset.depreciation_method] || asset.depreciation_method || 'Lineáris')}
              </span>
            </div>
            {asset.depreciation_method === 'performance' && asset.performance_unit && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('hr:fixed_assets.cards.unit', 'Mértékegység:')}</span>
                <span className="font-medium">{asset.performance_unit}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('hr:fixed_assets.cards.residual_value', 'Maradványérték:')}</span>
              <span className="font-medium">{formatCurrency(asset.residual_value, asset.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('hr:fixed_assets.cards.rate', 'ÉCS Kulcs:')}</span>
              <span className="font-medium">{result.accounting.ratePercent}%</span>
            </div>
            {hasOpening && Number(asset.opening_accumulated_depreciation) > 0 && (
              <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
                <span>{t('hr:fixed_assets.cards.opening_acc_short', 'Átvett nyitó ÉCS:')}</span>
                <span className="font-medium">{formatCurrency(asset.opening_accumulated_depreciation, asset.currency)}</span>
              </div>
            )}
            <div className="h-px bg-border/50 my-2" />
            <div className="flex justify-between">
              <span className="text-foreground font-medium">{t('hr:fixed_assets.cards.book_value', 'Könyvsz. Érték:')}</span>
              <span className="font-bold text-primary">{formatCurrency(result.accounting.bookValue, asset.currency)}</span>
            </div>
          </div>
        </div>

        {/* Tao ÉCS */}
        <div className="rounded-lg border border-border/50 p-4 bg-muted/20">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-bold text-foreground">{t('hr:fixed_assets.cards.tax_depr', 'Tao ÉCS')}</h5>
            {hasDevReserve && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                {t('hr:fixed_assets.cards.dev_reserve_badge', 'Fejlesztési tart.')}
              </span>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('hr:fixed_assets.cards.tao_template', 'Tao Sablon:')}</span>
              <span className="font-medium text-right text-xs leading-tight max-w-[140px]">
                {asset.tao_template?.name || t('hr:fixed_assets.cards.custom_rate', 'Egyedi kulcs')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('hr:fixed_assets.cards.rate', 'ÉCS Kulcs:')}</span>
              <span className="font-medium">{result.tax.ratePercent}%</span>
            </div>
            {asset.tax_depreciation_base && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('hr:fixed_assets.cards.custom_tax_base', 'Egyedi TAO alap:')}</span>
                <span className="font-medium text-foreground">{formatCurrency(asset.tax_depreciation_base, asset.currency)}</span>
              </div>
            )}
            {hasDevReserve && (
              <>
                <div className="flex justify-between text-xs text-amber-600">
                  <span>{t('hr:fixed_assets.cards.used_reserve', 'Felhasznált tartalék:')}</span>
                  <span className="font-medium">-{formatCurrency(asset.development_reserve_amount, asset.currency)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{t('hr:fixed_assets.cards.tax_base', 'Tao ÉCS alap:')}</span>
                  <span className="font-medium">{formatCurrency(result.tax.taxBase || 0, asset.currency)}</span>
                </div>
              </>
            )}
            {hasOpening && Number(asset.opening_tax_depreciation) > 0 && (
              <div className="flex justify-between text-xs text-blue-600 dark:text-blue-400">
                <span>{t('hr:fixed_assets.cards.opening_tax_short', 'Átvett nyitó TAO:')}</span>
                <span className="font-medium">{formatCurrency(asset.opening_tax_depreciation, asset.currency)}</span>
              </div>
            )}
            <div className="h-px bg-border/50 my-2" />
            <div className="flex justify-between">
              <span className="text-foreground font-medium">{t('hr:fixed_assets.cards.tax_value', 'Tao Érték:')}</span>
              <span className="font-bold text-primary">{formatCurrency(result.tax.bookValue, asset.currency)}</span>
            </div>
            {hasDevReserve && (result.tax.taxBase === 0) && (
              <p className="text-[11px] text-muted-foreground italic mt-1 leading-tight">
                {t('hr:fixed_assets.cards.dev_reserve_note', 'A Tao. tv. 7. § (15) szerint az eszközre Tao ÉCS nem számolható el.')}
              </p>
            )}
          </div>
        </div>

        {/* Pályázatos ÉCS (3. ág) */}
        {result.grant && (
          <div className="rounded-lg border border-purple-500/30 p-4 bg-purple-500/5">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-bold text-foreground">
                {t('hr:fixed_assets.cards.grant_depr', 'Pályázatos ÉCS')}
              </h5>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20">
                {t('hr:fixed_assets.cards.grant_badge', 'Támogatási pálya')}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('hr:fixed_assets.cards.grant_base', 'Támogatott alap:')}</span>
                <span className="font-medium">{formatCurrency(result.grant.grantBase, asset.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('hr:fixed_assets.cards.rate', 'ÉCS Kulcs:')}</span>
                <span className="font-medium">{result.grant.ratePercent}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('hr:fixed_assets.cards.monthly_grant', 'Havi elszámolt:')}</span>
                <span className="font-medium">{formatCurrency(result.grant.monthly, asset.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('hr:fixed_assets.cards.accumulated_grant', 'Halmozott elszámolt:')}</span>
                <span className="font-medium">{formatCurrency(result.grant.accumulated, asset.currency)}</span>
              </div>
              <div className="h-px bg-border/50 my-2" />
              <div className="flex justify-between">
                <span className="text-foreground font-medium">{t('hr:fixed_assets.cards.remaining_grant', 'Maradék támogatás:')}</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">{formatCurrency(result.grant.bookValue, asset.currency)}</span>
              </div>
              <p className="text-[11px] text-muted-foreground italic mt-1 leading-tight">
                {t('hr:fixed_assets.cards.grant_pie_note', 'Halasztott bevételek (4591 → 964) időbeli elhatárolásának feloldásához.')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

