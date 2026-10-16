import { useTranslation } from 'react-i18next';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { formatDateLocale } from '@/lib/locale/formatters';
import { checkTaxCreditAlienationRestriction } from '@/lib/fixed-assets/taxCreditRestrictionService';
import type { FixedAsset } from '@/types/fixed-assets';

interface TaxCreditAlienationAlertProps {
  asset: Pick<FixedAsset, 'has_tax_credit' | 'tax_credit_type' | 'tax_credit_retention_until' | 'activation_date'>;
  disposalDate: string;
  acknowledged?: boolean;
  onAcknowledgeChange?: (acknowledged: boolean) => void;
}

/**
 * Beruházási adókedvezmény megtartási tilalom figyelmeztető komponens (Tao. tv. 22/B. §)
 * Megjelenik, ha a kivezetés a 4 éves / szerződéses megtartási időn belül történik.
 */
export function TaxCreditAlienationAlert({
  asset,
  disposalDate,
  acknowledged,
  onAcknowledgeChange,
}: TaxCreditAlienationAlertProps) {
  const { t } = useTranslation(['hr']);

  const check = checkTaxCreditAlienationRestriction({
    hasTaxCredit: asset.has_tax_credit,
    taxCreditType: asset.tax_credit_type,
    taxCreditRetentionUntil: asset.tax_credit_retention_until,
    activationDate: asset.activation_date,
    disposalDate,
  });

  if (!check.restricted) return null;

  return (
    <div className="space-y-2">
      <Alert variant="destructive" id="disposal-tax-credit-alienation-alert" className="border-destructive/50 bg-destructive/10 text-destructive dark:bg-destructive/20">
        <ShieldAlert className="h-5 w-5 text-destructive mt-0.5" />
        <AlertTitle className="font-semibold text-sm">
          {t('hr:fixed_assets.tax_credit_alert.title', { defaultValue: 'Beruházási Adókedvezmény: Elidegenítési Korlát!' })}
        </AlertTitle>
        <AlertDescription className="space-y-1.5 text-xs text-foreground/90 mt-1">
          <p>
            {t('hr:fixed_assets.tax_credit_alert.body', {
              defaultValue:
                'Az eszköz beruházási adókedvezménnyel érintett (Tao. tv. 22/B. §). A törvényi megtartási kötelezettség lejárati dátuma: {{until}} (még {{days}} nap).',
              until: check.retentionUntil ? formatDateLocale(check.retentionUntil) : '-',
              days: check.daysRemaining,
            })}
          </p>
          <div className="p-2 rounded bg-destructive/15 border border-destructive/30 text-[11px] font-medium text-destructive-foreground dark:text-red-300">
            ⚠️ <strong>Jogkövetkezmény:</strong> A védelmi időszakon belüli selejtezés, elidegenítés vagy átadás esetén az igénybevett társasági adókedvezményt késedelmi pótlékkal növelten vissza kell fizetni!
          </div>
        </AlertDescription>
      </Alert>

      {onAcknowledgeChange && (
        <div className="flex items-start space-x-2 p-2.5 rounded-lg border border-destructive/40 bg-background">
          <Checkbox
            id="acknowledge-tax-credit-risk"
            checked={!!acknowledged}
            onCheckedChange={(c) => onAcknowledgeChange(c === true)}
            className="mt-0.5 border-destructive data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground"
          />
          <Label
            htmlFor="acknowledge-tax-credit-risk"
            className="text-xs leading-snug cursor-pointer font-medium text-foreground select-none"
          >
            {t(
              'hr:fixed_assets.tax_credit_alert.acknowledge_label',
              'Kifejezetten tudomásul veszem az adókedvezmény megtartási idő előtti kivezetésének kockázatát és jóváhagyom a kérelem benyújtását.'
            )}
          </Label>
        </div>
      )}
    </div>
  );
}
