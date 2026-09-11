import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertCircle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import type { SubmittedInvoice } from '@/hooks/useInvoiceData';

interface InvoiceApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: SubmittedInvoice | null;
  onSuccess?: () => void;
}

export function InvoiceApprovalDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: InvoiceApprovalDialogProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedPreset, setSelectedPreset] = useState<string>('paper_invoice');
  const [customNote, setCustomNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const presetReasons = [
    {
      id: 'paper_invoice',
      label: t('invoices:dialogs.approval.reasons.paper_invoice'),
      description: t('invoices:dialogs.approval.reasons.paper_invoice_desc'),
    },
    {
      id: 'nav_delay',
      label: t('invoices:dialogs.approval.reasons.nav_delay'),
      description: t('invoices:dialogs.approval.reasons.nav_delay_desc'),
    },
    {
      id: 'foreign_or_exempt',
      label: t('invoices:dialogs.approval.reasons.foreign_or_exempt'),
      description: t('invoices:dialogs.approval.reasons.foreign_or_exempt_desc'),
    },
    {
      id: 'other',
      label: t('invoices:dialogs.approval.reasons.other'),
      description: t('invoices:dialogs.approval.reasons.other_desc'),
    },
  ];

  if (!invoice) return null;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const presetObj = presetReasons.find(p => p.id === selectedPreset);
      const noteParts: string[] = [];
      if (presetObj) {
        noteParts.push(presetObj.label);
      }
      if (customNote.trim()) {
        noteParts.push(customNote.trim());
      }
      const finalNote = noteParts.join(' - ') || 'Könyvelői jóváhagyás';

      const { data, error } = await supabase.rpc('approve_invoice_for_accounting', {
        p_invoice_id: invoice.id,
        p_approval_note: finalNote,
      });

      if (error) {
        throw error;
      }

      toast({
        title: t('invoices:dialogs.approval.toast_success'),
        description: `${invoice.bizonylatsorszam || '-'}`,
      });

      // Invalidate relevant queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices'] }),
        queryClient.invalidateQueries({ queryKey: ['submittedInvoices'] }),
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['company-invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['gl_categorized_items'] }),
        queryClient.invalidateQueries({ queryKey: ['petty_cash_entries'] }),
      ]);

      onSuccess?.();
      onOpenChange(false);
      setCustomNote('');
    } catch (err: any) {
      console.error('Error approving invoice:', err);
      toast({
        variant: 'destructive',
        title: t('common:status.error', 'Hiba történt'),
        description: err.message || t('common:errors.unexpected', 'Kérjük próbálja újra.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const partnerName = (invoice.invoice_direction === 'OUTBOUND' ? invoice.vevo_nev : invoice.elado_nev) || invoice.elado_nev || invoice.vevo_nev || '-';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <ShieldAlert className="h-5 w-5" />
            <DialogTitle className="text-foreground">{t('invoices:dialogs.approval.title')}</DialogTitle>
          </div>
          <DialogDescription>
            {t('invoices:dialogs.approval.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Invoice Summary Box */}
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5">
            <div className="flex justify-between items-center font-medium">
              <span className="text-muted-foreground">{t('invoices:dialogs.approval.invoice_number')}</span>
              <span className="font-mono">{invoice.bizonylatsorszam || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t('invoices:dialogs.approval.partner')}</span>
              <span className="font-medium truncate max-w-[240px]">{partnerName || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t('invoices:dialogs.approval.issue_date')}</span>
              <span>{invoice.kibocsatas_datuma || '-'}</span>
            </div>
            <div className="flex justify-between items-center font-semibold text-base pt-1 border-t">
              <span>{t('invoices:dialogs.approval.gross_total')}</span>
              <span className="font-mono">
                {formatCurrency(invoice.brutto_vegosszeg || 0, invoice.penznem || 'HUF')}
              </span>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3 flex gap-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold mb-0.5">{t('invoices:dialogs.approval.warning_title')}</p>
              <p>
                {t('invoices:dialogs.approval.warning_desc')}
              </p>
            </div>
          </div>

          {/* Preset Justifications */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('invoices:dialogs.approval.justification_title')}
            </Label>
            <RadioGroup
              value={selectedPreset}
              onValueChange={setSelectedPreset}
              className="space-y-2"
            >
              {presetReasons.map(reason => (
                <label
                  key={reason.id}
                  htmlFor={reason.id}
                  className={`flex items-start space-x-2.5 p-2 rounded-md border cursor-pointer transition-colors ${
                    selectedPreset === reason.id
                      ? 'border-primary/50 bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <RadioGroupItem value={reason.id} id={reason.id} className="mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium leading-none text-foreground">{reason.label}</p>
                    <p className="text-[11px] text-muted-foreground">{reason.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Custom Note */}
          <div className="space-y-1.5">
            <Label htmlFor="approval-note" className="text-xs">
              {t('invoices:dialogs.approval.custom_note')}
            </Label>
            <Textarea
              id="approval-note"
              placeholder={t('invoices:dialogs.approval.custom_note_placeholder')}
              value={customNote}
              onChange={e => setCustomNote(e.target.value)}
              className="h-16 text-xs resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
            onClick={handleApprove}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('invoices:dialogs.approval.approving')}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                {t('invoices:dialogs.approval.confirm_button')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
