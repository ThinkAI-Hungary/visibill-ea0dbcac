import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XCircle, RotateCcw, Loader2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface StornoSettleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'settle' = lezárás, 'unsettle' = visszavonás */
  mode: 'settle' | 'unsettle';
  stornoNavId: string;
  stornoNumber: string;
  /** Hívódik a sikeres RPC + cache invalidálás UTÁN — ez zárja be a modalt */
  onSuccess: () => void;
}

export function StornoSettleDialog({
  open,
  onOpenChange,
  mode,
  stornoNavId,
  stornoNumber,
  onSuccess,
}: StornoSettleDialogProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const isSettle = mode === 'settle';

  const handleConfirm = async () => {
    try {
      setLoading(true);

      const rpcName = isSettle
        ? 'mark_storno_group_settled'
        : 'unmark_storno_group_settled';

      const { error } = await supabase.rpc(rpcName, {
        p_storno_nav_id: stornoNavId,
      });

      if (error) throw error;

      // Async Modal UX: await cache invalidálás → modal zár → toast
      await onSuccess();
      onOpenChange(false);

      toast({
        title: isSettle ? t('invoices:dialogs.storno_settle.toast_settled') : t('invoices:dialogs.storno_settle.toast_unsettled'),
        description: isSettle
          ? t('invoices:dialogs.storno_settle.toast_settled_desc', { stornoNumber })
          : t('invoices:dialogs.storno_settle.toast_unsettled_desc', { stornoNumber }),
        variant: 'success',
      });
    } catch (err: any) {
      console.error('[StornoSettleDialog] RPC error:', err);
      toast({
        title: t('common:status.error', 'Hiba történt'),
        description: err.message || t('common:errors.unexpected', 'A művelet nem sikerült. Kérjük próbálja újra.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isSettle ? (
              <>
                <XCircle className="h-5 w-5 text-orange-500" />
                {t('invoices:dialogs.storno_settle.settle_title')}
              </>
            ) : (
              <>
                <RotateCcw className="h-5 w-5 text-muted-foreground" />
                {t('invoices:dialogs.storno_settle.unsettle_title')}
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              {isSettle ? (
                <>
                  <p>
                    {t('invoices:dialogs.storno_settle.settle_desc', { stornoNumber })}
                  </p>
                  <div className="rounded-md bg-muted/50 border border-border/50 p-3 space-y-1 text-xs">
                    <p className="font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                      {t('invoices:dialogs.storno_settle.settled_items_title')}
                    </p>
                    <p>{t('invoices:dialogs.storno_settle.item_nav', { stornoNumber })}</p>
                    <p>{t('invoices:dialogs.storno_settle.item_image')}</p>
                    <p>{t('invoices:dialogs.storno_settle.item_original')}</p>
                  </div>
                  <p className="text-xs">
                    {t('invoices:dialogs.storno_settle.settle_can_undo')}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    {t('invoices:dialogs.storno_settle.unsettle_desc', { stornoNumber })}
                  </p>
                  <p className="text-xs">
                    {t('invoices:dialogs.storno_settle.unsettle_result')}
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t('common:actions.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={isSettle
              ? 'bg-orange-500 hover:bg-orange-600 text-white'
              : ''
            }
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSettle ? (
              <>
                <XCircle className="h-4 w-4 mr-1.5" />
                {t('invoices:dialogs.storno_settle.confirm_settle')}
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-1.5" />
                {t('invoices:dialogs.storno_settle.confirm_unsettle')}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
