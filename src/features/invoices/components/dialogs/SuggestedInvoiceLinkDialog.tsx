import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InvoiceImagePreview } from '@/components/InvoiceImagePreview';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import { Sparkles, CheckCircle2, ArrowRight, FileText, ExternalLink, Loader2 } from 'lucide-react';
import type { NavInvoice } from '../../types';
import type { SuggestedSubmittedInvoiceWithScore } from '../../utils/invoiceRelations';

interface SuggestedInvoiceLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navInvoice: NavInvoice | null;
  suggestedInvoice: SuggestedSubmittedInvoiceWithScore | null;
}

export function SuggestedInvoiceLinkDialog({
  open,
  onOpenChange,
  navInvoice,
  suggestedInvoice,
}: SuggestedInvoiceLinkDialogProps) {
  const { toast } = useToast();
  const { invalidateInvoiceData } = useInvoiceContext();
  const [isLinking, setIsLinking] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');

  if (!navInvoice || !suggestedInvoice) return null;

  const isOutbound = navInvoice.invoice_direction === 'OUTBOUND';
  const navPartnerName = isOutbound ? navInvoice.customer_name : navInvoice.supplier_name;
  const navPartnerTax = isOutbound ? navInvoice.customer_tax_number : navInvoice.supplier_tax_number;

  const subPartnerName = isOutbound ? suggestedInvoice.vevo_nev : suggestedInvoice.elado_nev;
  const subPartnerTax = isOutbound ? suggestedInvoice.vevo_vat_id : suggestedInvoice.elado_vat_id;

  const handleLinkAndVerify = async () => {
    setIsLinking(true);
    try {
      const noteToSave = approvalNote.trim() || undefined;

      const { data, error } = await supabase.rpc('link_and_verify_submitted_invoice' as any, {
        p_submitted_invoice_id: suggestedInvoice.id,
        p_nav_invoice_id: navInvoice.id,
        p_approval_note: noteToSave,
      });

      if (error) throw error;

      toast({
        title: 'Számla sikeresen összerendelve!',
        description: `${navInvoice.invoice_number} bizonylatszám rögzítve és könyvelésre jóváhagyva.`,
      });

      // Central TanStack Query cache invalidation
      invalidateInvoiceData();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error linking invoice:', err);
      toast({
        title: 'Összerendelési hiba',
        description: err.message || 'Nem sikerült az összerendelés végrehajtása.',
        variant: 'destructive',
      });
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2.5 flex-wrap pr-8">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
              <span>Javasolt Számla Csatolmány Összerendelése</span>
            </DialogTitle>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs font-medium">
                {suggestedInvoice.suggestedScore}% egyezés
              </Badge>
              {suggestedInvoice.isSuffixMatch && (
                <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs font-normal">
                  Sorszám prefix eltérés
                </Badge>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            A rendszer az adószám, bruttó összeg és dátum alapján javaslatot tett a NAV számla és a feltöltött bizonylat összekapcsolására.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Side-by-side comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* NAV Invoice Card */}
            <Card className="border-border/60 bg-muted/20">
              <CardHeader className="py-2.5 px-3.5 pb-1">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  NAV Online Számla
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-1 space-y-1.5 text-xs">
                <div>
                  <span className="text-muted-foreground">Sorszám: </span>
                  <span className="font-mono font-bold text-foreground">{navInvoice.invoice_number}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Partner: </span>
                  <span className="font-medium text-foreground">{navPartnerName || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Adószám: </span>
                  <span className="font-mono text-muted-foreground">{navPartnerTax || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Kibocsátás: </span>
                  <span>
                    {navInvoice.invoice_issue_date
                      ? format(new Date(navInvoice.invoice_issue_date), 'yyyy.MM.dd', { locale: hu })
                      : '-'}
                  </span>
                </div>
                <div className="pt-1 border-t border-border/20">
                  <span className="text-muted-foreground">Bruttó összeg: </span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatCurrency(navInvoice.invoice_gross_amount || 0, navInvoice.currency || 'HUF')}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Submitted Invoice Card */}
            <Card className="border-border/60 bg-muted/20">
              <CardHeader className="py-2.5 px-3.5 pb-1">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Feltöltött Bizonylat
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3.5 pt-1 space-y-1.5 text-xs">
                <div>
                  <span className="text-muted-foreground">Kinyert sorszám: </span>
                  <span className="font-mono font-bold text-foreground">{suggestedInvoice.bizonylatsorszam || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Partner: </span>
                  <span className="font-medium text-foreground">{subPartnerName || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Adószám: </span>
                  <span className="font-mono text-muted-foreground">{subPartnerTax || '-'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Kibocsátás: </span>
                  <span>
                    {suggestedInvoice.kibocsatas_datuma
                      ? format(new Date(suggestedInvoice.kibocsatas_datuma), 'yyyy.MM.dd', { locale: hu })
                      : '-'}
                  </span>
                </div>
                <div className="pt-1 border-t border-border/20">
                  <span className="text-muted-foreground">Bruttó összeg: </span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatCurrency(suggestedInvoice.brutto_vegosszeg, suggestedInvoice.penznem || 'HUF')}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Suffix / Reason explanation banner */}
          <div className="rounded-lg p-2.5 bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
            <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Egyezési indoklás: {suggestedInvoice.suggestedReason}</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                Az „Összerendelés és jóváhagyás” gombra kattintva a beküldött számla sorszáma frissül a hivatalos NAV sorszámra (<span className="font-mono font-bold">{navInvoice.invoice_number}</span>), státusza ellenőrzötté válik, a csatolmány pedig azonnal összekapcsolódik a NAV sorral.
              </p>
            </div>
          </div>

          {/* Document Preview */}
          {(suggestedInvoice.image_url || suggestedInvoice.melleklet_url) && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  Számlakép előnézet
                </Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" asChild>
                  <a href={suggestedInvoice.image_url || suggestedInvoice.melleklet_url || '#'} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    Megnyitás új lapon
                  </a>
                </Button>
              </div>
              <div className="border border-border/60 rounded-lg overflow-hidden h-[340px] bg-background">
                <InvoiceImagePreview
                  invoiceId={suggestedInvoice.id}
                  imageUrl={suggestedInvoice.image_url}
                  mellekletUrl={suggestedInvoice.melleklet_url}
                  isOpen={open}
                  interactive={true}
                  className="h-full"
                />
              </div>
            </div>
          )}

          {/* Optional Note */}
          <div className="space-y-1">
            <Label htmlFor="link-approval-note" className="text-xs text-muted-foreground">
              Könyvelői megjegyzés (opcionális audit naplóhoz)
            </Label>
            <Input
              id="link-approval-note"
              placeholder={`Kézi összerendelés: ${navInvoice.invoice_number}`}
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between pt-2 border-t border-border/20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isLinking}
          >
            Mégse
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleLinkAndVerify}
            disabled={isLinking}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[200px] gap-1.5 tabular-nums"
          >
            {isLinking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Összerendelés folyamatban...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Összerendelés és jóváhagyás
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
