import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/utils';
import { formatDateLocale } from '@/lib/locale/formatters';
import { checkAlienationRestriction } from '@/lib/fixed-assets/developmentReservePenaltyCalculator';
import type { FixedAsset } from '@/types/fixed-assets';

interface DevelopmentReserveAlienationAlertProps {
  asset: Pick<FixedAsset, 'activation_date' | 'development_reserve_amount'>;
  /** A (tervezett) kivezetés dátuma, ISO. */
  disposalDate: string;
}

/**
 * Elidegenítési / üzemeltetésből kivonási tilalom riasztás (TENY M1.5): ha az eszköz fejlesztési
 * tartalékból (is) létesült és a kivezetés a védett időszakon belül történik, jelzi a becsült
 * visszafizetési kötelezettséget (adóalap-növelés + késedelmi pótlék).
 */
export function DevelopmentReserveAlienationAlert({ asset, disposalDate }: DevelopmentReserveAlienationAlertProps) {
  const { t } = useTranslation(['hr']);
  if (!disposalDate) return null;

  const check = checkAlienationRestriction({
    activationDate: asset.activation_date,
    disposalDate,
    developmentReserveAmount: asset.development_reserve_amount,
  });
  if (!check.restricted) return null;

  return (
    <Alert variant="destructive" id="disposal-reserve-alienation-alert">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {t('hr:fixed_assets.disposal_reserve_alert.title', { defaultValue: 'Fejlesztési tartalék: elidegenítési tilalom' })}
      </AlertTitle>
      <AlertDescription className="space-y-1">
        <p>
          {t('hr:fixed_assets.disposal_reserve_alert.body', {
            defaultValue:
              'Az eszköz {{amount}} értékben fejlesztési tartalékból létesült, a védett időszak vége: {{until}}. A kivezetés visszafizetési kötelezettséget (adóalap-növelés) vonhat maga után.',
            amount: formatCurrency(check.reserveAmount, 'HUF'),
            until: check.protectedUntil ? formatDateLocale(check.protectedUntil) : '-',
          })}
        </p>
        <p>
          {t('hr:fixed_assets.disposal_reserve_alert.estimate', {
            defaultValue: 'Becsült társasági adó: {{tax}}, késedelmi pótlék: {{penalty}} (tájékoztató jellegű).',
            tax: formatCurrency(check.estimatedTax, 'HUF'),
            penalty: formatCurrency(check.estimatedPenalty, 'HUF'),
          })}
        </p>
      </AlertDescription>
    </Alert>
  );
}
