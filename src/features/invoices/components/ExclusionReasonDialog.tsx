import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Ban, CheckCircle2, Loader2 } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, cn } from '@/lib/utils';
import { useCompany } from '@/contexts/CompanyContext';
import { useQueryClient } from '@tanstack/react-query';

export interface ExclusionDialogInvoice {
  id: string;
  invoice_number: string;
  supplier_name?: string | null;
  gross_amount?: number | null;
  net_amount?: number | null;
  vat_amount?: number | null;
  currency?: string | null;
  delivery_date?: string | null;
  is_submitted?: boolean;
  exclude_from_accounting?: boolean;
  accounting_exclusion_type?: 'PERMANENT' | 'DEFERRED_VAT' | string | null;
  deferred_vat_reason?: string | null;
}

interface ExclusionReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: ExclusionDialogInvoice | null;
  onSuccess?: () => void;
}

interface DialogContentInnerProps {
  invoice: ExclusionDialogInvoice;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function ExclusionReasonDialogContent({ invoice, onOpenChange, onSuccess }: DialogContentInnerProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState<'DEFERRED_VAT' | 'PERMANENT'>(() => {
    return invoice.accounting_exclusion_type === 'PERMANENT' ? 'PERMANENT' : 'DEFERRED_VAT';
  });
  const [reason, setReason] = useState(() => invoice.deferred_vat_reason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCurrentlyExcluded = !!invoice.exclude_from_accounting;
  const currentType = invoice.accounting_exclusion_type;

  const handleSave = async (exclusionType: 'DEFERRED_VAT' | 'PERMANENT' | null) => {
    if (!selectedCompany?.id) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.rpc('set_invoice_accounting_exclusion', {
        p_company_id: selectedCompany.id,
        p_invoice_id: invoice.id,
        p_is_submitted: !!invoice.is_submitted,
        p_exclusion_type: exclusionType,
        p_reason: exclusionType ? reason.trim() || null : null,
      });

      if (error) throw error;

      // Invalidate relevant caches
      queryClient.invalidateQueries({ queryKey: ['filteredNavInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['submittedInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['questionable_invoices'] });
      queryClient.invalidateQueries({ queryKey: ['vat_return'] });
      queryClient.invalidateQueries({ queryKey: ['vat_return_lines'] });
      queryClient.invalidateQueries({ queryKey: ['vat_return_m_lines'] });

      toast({
        title: exclusionType === null
          ? t('invoices:exclusion.restored_title', 'Visszaállítva a könyvelésbe')
          : exclusionType === 'DEFERRED_VAT'
            ? t('invoices:exclusion.deferred_success_title', 'ÁFA levonás elhalasztva')
            : t('invoices:exclusion.permanent_success_title', 'Kizárva a könyvelésből'),
        description: exclusionType === null
          ? t('invoices:exclusion.restored_desc', 'A számla újra szerepel a könyvelésben és az ÁFA levonásban.')
          : exclusionType === 'DEFERRED_VAT'
            ? t('invoices:exclusion.deferred_desc', 'A számla kérdésesként rögzítve (2 éves határidővel). Megtalálod a műszerfal Kérdéses számlák szekciójában.')
            : t('invoices:exclusion.permanent_desc', 'A számla véglegesen kizárva a könyvelésből és az ÁFA levonásból.'),
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error setting exclusion:', err);
      toast({
        title: t('common:error', 'Hiba történt'),
        description: err.message || t('invoices:exclusion.error_desc', 'Nem sikerült módosítani a számla könyvelési státuszát.'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
          {isCurrentlyExcluded
            ? t('invoices:exclusion.modal_edit_title', 'Könyvelési kizárás és halasztás módosítása')
            : t('invoices:exclusion.modal_new_title', 'Kivétel a könyvelésből / ÁFA halasztás')}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          {t('invoices:exclusion.modal_subtitle', 'Válaszd ki, hogy a számla elszámolását később kívánod elvégezni, vagy véglegesen kizárod a könyvelésből.')}
        </DialogDescription>
      </DialogHeader>

      {/* Invoice Summary Banner */}
      <div className="p-3 bg-muted/40 rounded-lg border border-border/50 text-xs space-y-1">
        <div className="flex justify-between items-center font-semibold text-foreground">
          <span className="truncate max-w-[220px]">{invoice.supplier_name || t('invoices:unknown_supplier', 'Partner')}</span>
          <span className="tabular-nums font-mono text-sm">
            {formatCurrency(invoice.gross_amount || 0, invoice.currency || 'HUF')}
          </span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>{t('invoices:invoice_number', 'Számlaszám')}: <span className="font-mono">{invoice.invoice_number}</span></span>
          {invoice.delivery_date && (
            <span>{t('invoices:delivery_date', 'Teljesítés')}: {invoice.delivery_date}</span>
          )}
        </div>
        {invoice.vat_amount !== undefined && invoice.vat_amount !== null && (
          <div className="flex justify-between text-muted-foreground pt-0.5 border-t border-border/30">
            <span>{t('invoices:vat_amount', 'ÁFA tartalom')}:</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
              {formatCurrency(invoice.vat_amount, invoice.currency || 'HUF')}
            </span>
          </div>
        )}
      </div>

      {/* Current State Info (if already excluded) */}
      {isCurrentlyExcluded && (
        <div className="flex items-center justify-between p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-xs">
          <div className="flex items-center gap-2">
            {currentType === 'DEFERRED_VAT' ? (
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            ) : (
              <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>
              {currentType === 'DEFERRED_VAT'
                ? t('invoices:exclusion.current_deferred', 'Jelenlegi állapot: Kérdéses számla (ÁFA levonás elhalasztva)')
                : t('invoices:exclusion.current_permanent', 'Jelenlegi állapot: Véglegesen kizárva a könyvelésből')}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSave(null)}
            disabled={isSubmitting}
            className="h-7 text-[11px] gap-1 border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {t('invoices:exclusion.restore_action', 'Visszaállítás könyvelésbe')}
          </Button>
        </div>
      )}

      {/* Options Selection */}
      <div className="space-y-3 pt-1">
        <Label className="text-xs font-semibold">{t('invoices:exclusion.choose_type_label', 'Kizárás / halasztás jellege')}</Label>

        {/* Option 1: DEFERRED_VAT */}
        <div
          onClick={() => setSelectedType('DEFERRED_VAT')}
          className={cn(
            "p-3.5 rounded-lg border-2 cursor-pointer transition-all duration-150 flex gap-3 items-start",
            selectedType === 'DEFERRED_VAT'
              ? "border-amber-500 bg-amber-500/10 shadow-sm"
              : "border-border/60 hover:border-amber-400/50 hover:bg-muted/30"
          )}
        >
          <div className="p-2 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
            <Clock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {t('invoices:exclusion.defer_option_title', 'Későbbre halasztom a számla elszámolását és az ÁFA levonását')}
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 uppercase">
                Áfa tv. 153/A. §
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('invoices:exclusion.defer_option_desc', 'A számla kérdésesként a műszerfalra kerül. A 2 éves törvényi jogvesztő határidőig bármelyik későbbi havi ÁFA bevallásba beemelhető, és a rendszer a havi zárásoknál automatikusan rákérdez.')}
            </p>
          </div>
        </div>

        {/* Option 2: PERMANENT */}
        <div
          onClick={() => setSelectedType('PERMANENT')}
          className={cn(
            "p-3.5 rounded-lg border-2 cursor-pointer transition-all duration-150 flex gap-3 items-start",
            selectedType === 'PERMANENT'
              ? "border-rose-500 bg-rose-500/10 shadow-sm"
              : "border-border/60 hover:border-rose-400/50 hover:bg-muted/30"
          )}
        >
          <div className="p-2 rounded-md bg-rose-500/20 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
            <Ban className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <span className="text-sm font-semibold text-foreground">
              {t('invoices:exclusion.permanent_option_title', 'Végleges kizárás a könyvelésből')}
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('invoices:exclusion.permanent_option_desc', 'Magáncélú, nem a cég nevére szóló, vagy nem elszámolható költség. Egyáltalán nem kerül be a könyvelésbe, és az ÁFA nem kerül levonásba.')}
            </p>
          </div>
        </div>

        {/* Optional reason textarea */}
        <div className="space-y-1.5 pt-1">
          <Label htmlFor="exclusion-reason" className="text-xs text-muted-foreground flex items-center justify-between">
            <span>{t('invoices:exclusion.reason_label', 'Megjegyzés / Indoklás (opcionális)')}</span>
            <span className="text-[10px] text-muted-foreground/70">pl. hiányzó teljesítésigazolás</span>
          </Label>
          <Textarea
            id="exclusion-reason"
            placeholder={selectedType === 'DEFERRED_VAT'
              ? t('invoices:exclusion.defer_reason_placeholder', 'pl. Szükséges még a vezetői jóváhagyás vagy teljesítésigazolás...')
              : t('invoices:exclusion.permanent_reason_placeholder', 'pl. Ügyvezetői magánkiadás, nem elszámolható...')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-16 text-xs resize-none"
          />
        </div>
      </div>

      <DialogFooter className="flex-row items-center justify-between pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
        >
          {t('common:cancel', 'Mégse')}
        </Button>

        <Button
          type="button"
          onClick={() => handleSave(selectedType)}
          disabled={isSubmitting}
          className={cn(
            "min-w-[140px] justify-center tabular-nums font-semibold",
            selectedType === 'DEFERRED_VAT'
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : "bg-rose-600 hover:bg-rose-700 text-white"
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              {t('common:saving', 'Mentés...')}
            </>
          ) : selectedType === 'DEFERRED_VAT' ? (
            t('invoices:exclusion.confirm_defer_btn', 'Halasztás mentése')
          ) : (
            t('invoices:exclusion.confirm_permanent_btn', 'Végleges kizárás')
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function ExclusionReasonDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: ExclusionReasonDialogProps) {
  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ExclusionReasonDialogContent
        key={invoice.id}
        invoice={invoice}
        onOpenChange={onOpenChange}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
}

export default ExclusionReasonDialog;
