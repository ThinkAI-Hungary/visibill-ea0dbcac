import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Ban, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface BulkExclusionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  exclusionType: 'DEFERRED_VAT' | 'PERMANENT';
  onConfirm: (reason?: string | null) => Promise<void>;
  isSubmitting?: boolean;
}

export function BulkExclusionDialog({
  open,
  onOpenChange,
  count,
  exclusionType,
  onConfirm,
  isSubmitting = false,
}: BulkExclusionDialogProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const [reason, setReason] = useState('');

  const isDeferred = exclusionType === 'DEFERRED_VAT';

  const handleConfirm = async () => {
    await onConfirm(reason.trim() || null);
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg z-[10002]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div
              className={`p-2 rounded-lg ${
                isDeferred
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400'
              }`}
            >
              {isDeferred ? <Clock className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
            </div>
            <DialogTitle>
              {isDeferred
                ? t('invoices:exclusion.bulk_deferred_title', 'Számlák megjelölése kérdésesként (Halasztott ÁFA)')
                : t('invoices:exclusion.bulk_permanent_title', 'Számlák végleges kizárása a könyvelésből')}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isDeferred
              ? t('invoices:exclusion.bulk_deferred_desc', {
                  count,
                  defaultValue: `A kiválasztott ${count} db számla kérdésesként kerül rögzítésre. A számlák nem kerülnek levonásba a jelenlegi ÁFA időszakban, de a törvényi 2 éves jogvesztő határidőn belül bármikor beemelhetők egy későbbi bevallásba.`,
                })
              : t('invoices:exclusion.bulk_permanent_desc', {
                  count,
                  defaultValue: `A kiválasztott ${count} db számla véglegesen kizárásra kerül a könyvelési feladásokból és az ÁFA analitikából (pl. magánjellegű költség vagy nem elszámolható kiadás).`,
                })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isDeferred && (
            <Alert className="bg-amber-500/5 border-amber-500/20 text-xs">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
              <AlertDescription className="text-amber-800 dark:text-amber-300">
                {t(
                  'invoices:exclusion.deferred_vat_tip',
                  'A kérdéses számlák megmaradnak az ÁFA előkészítő Kérdéses számlák listájában, ahonnan a könyvelő egy kattintással átvezetheti őket a kívánt havi vagy negyedéves bevallásba.'
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="bulk-exclusion-reason" className="text-xs font-semibold">
              {isDeferred
                ? t('invoices:exclusion.reason_label_deferred', 'Kérdésesség vagy halasztás indoka (opcionális)')
                : t('invoices:exclusion.reason_label_permanent', 'Kizárás indoka (opcionális)')}
            </Label>
            <Textarea
              id="bulk-exclusion-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isDeferred
                  ? t('invoices:exclusion.reason_placeholder_deferred', 'pl. Vitatott teljesítés, bizonytalan minőség, későbbi időszakra halasztva...')
                  : t('invoices:exclusion.reason_placeholder_permanent', 'pl. Magánjellegű vásárlás, nem a társaság költsége...')
              }
              className="text-xs resize-none min-h-[80px]"
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('common:actions.cancel', 'Mégse')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={
              isDeferred
                ? 'bg-amber-600 hover:bg-amber-700 text-white font-semibold'
                : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold'
            }
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {isDeferred
              ? t('invoices:exclusion.confirm_deferred', 'Kérdésesként rögzítés')
              : t('invoices:exclusion.confirm_permanent', 'Kizárás megerősítése')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
