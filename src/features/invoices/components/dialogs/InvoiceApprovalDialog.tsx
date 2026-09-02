import React, { useState } from 'react';
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

const PRESET_REASONS = [
  {
    id: 'paper_invoice',
    label: 'Papíralapú / kézi számlatömbös számla',
    description: 'Nem számítógépes számla, nincs rá kötelező online NAV adatszolgáltatás.',
  },
  {
    id: 'nav_delay',
    label: 'NAV adatszolgáltatási késés / technikai hiba',
    description: 'A kiállító még nem továbbította a NAV-hoz vagy a NAV még nem dolgozta fel.',
  },
  {
    id: 'foreign_or_exempt',
    label: 'Külföldi vagy mentesített ügylet',
    description: 'Belföldi adószámmal rendelkező, de nem NAV-köteles jogcím.',
  },
  {
    id: 'other',
    label: 'Egyéb indoklás (saját felelősségre)',
    description: 'Egyedi könyvelői mérlegelés és engedélyezés alapján.',
  },
];

export function InvoiceApprovalDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: InvoiceApprovalDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedPreset, setSelectedPreset] = useState<string>('paper_invoice');
  const [customNote, setCustomNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!invoice) return null;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const presetObj = PRESET_REASONS.find(p => p.id === selectedPreset);
      const noteParts: string[] = [];
      if (presetObj) {
        noteParts.push(presetObj.label);
      }
      if (customNote.trim()) {
        noteParts.push(customNote.trim());
      }
      const finalNote = noteParts.join(' - ') || 'Könyvelői jóváhagyás (NAV adatszolgáltatás nélkül)';

      const { data, error } = await supabase.rpc('approve_invoice_for_accounting', {
        p_invoice_id: invoice.id,
        p_approval_note: finalNote,
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Számla sikeresen jóváhagyva a könyveléshez!',
        description: `Bizonylat: ${invoice.bizonylatsorszam || '-'} engedélyezve lett az automatikus könyvelési modulokban.`,
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
        title: 'Hiba történt a jóváhagyás során',
        description: err.message || 'Kérjük próbálja újra.',
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
            <DialogTitle className="text-foreground">NAV Jóváhagyási Kapu</DialogTitle>
          </div>
          <DialogDescription>
            Könyvelői ellenőrzés és jóváhagyás hiányzó NAV online számla adatszolgáltatás esetén.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Invoice Summary Box */}
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1.5">
            <div className="flex justify-between items-center font-medium">
              <span className="text-muted-foreground">Bizonylatszám:</span>
              <span className="font-mono">{invoice.bizonylatsorszam || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Partner:</span>
              <span className="font-medium truncate max-w-[240px]">{partnerName || '-'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Kibocsátás dátuma:</span>
              <span>{invoice.kibocsatas_datuma || '-'}</span>
            </div>
            <div className="flex justify-between items-center font-semibold text-base pt-1 border-t">
              <span>Bruttó végösszeg:</span>
              <span className="font-mono">
                {formatCurrency(invoice.brutto_vegosszeg || 0, invoice.penznem || 'HUF')}
              </span>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3 flex gap-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold mb-0.5">Nincs NAV Online Számla adatszolgáltatás!</p>
              <p>
                A rendszer a kettős ellenőrzés védelmében zárolta az automatikus könyvelést. A jóváhagyással igazolja a bizonylat hitelességét, és feloldja a főkönyvi és napló tételek generálását.
              </p>
            </div>
          </div>

          {/* Preset Justifications */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Jóváhagyás jogcíme
            </Label>
            <RadioGroup
              value={selectedPreset}
              onValueChange={setSelectedPreset}
              className="space-y-2"
            >
              {PRESET_REASONS.map(reason => (
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
              Kiegészítő könyvelői megjegyzés (opcionális)
            </Label>
            <Textarea
              id="approval-note"
              placeholder="pl. Ügyféllel egyeztetve, kézi számlatömb másolata csatolva..."
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
            Mégse
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
                Jóváhagyás folyamatban...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Jóváhagyás könyvelésre
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
