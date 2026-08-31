import React from 'react';
import { GitBranch, Link2, Eye, AlertTriangle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { INVOICE_TYPE_LABELS } from '@/types/invoices';
import type { LinkedInvoice, MatchedSubmittedInvoice } from './types';

interface LinkedInvoicesSectionProps {
  linkedInvoices: LinkedInvoice[];
  invoiceReferenceNumber?: string | null;
  linkedInvoicesLoading?: boolean;
  onViewInvoice?: (invoice: MatchedSubmittedInvoice) => void;
  hasOtherMatches?: boolean;
}

function getInvoiceTypeLabel(rawType: string): string {
  return INVOICE_TYPE_LABELS[rawType] || rawType.replace(/_/g, ' ');
}

export function LinkedInvoicesSection({
  linkedInvoices,
  invoiceReferenceNumber,
  linkedInvoicesLoading = false,
  onViewInvoice,
  hasOtherMatches = false,
}: LinkedInvoicesSectionProps) {
  // Detect broken chain: reference_number exists but no matching linked invoice found
  const hasBrokenChain =
    !linkedInvoicesLoading &&
    !!invoiceReferenceNumber &&
    !linkedInvoices.some(
      (inv) => inv.bizonylatsorszam?.toUpperCase() === invoiceReferenceNumber.toUpperCase()
    );

  return (
    <>
      {/* Broken chain warning */}
      {hasBrokenChain && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="bg-amber-500/8 border-amber-500/30 expand-stagger-1">
                <CardContent className="p-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="text-xs">
                    <span className="font-medium text-amber-500">Hiányzó bizonylat(ok)</span>
                    <span className="text-muted-foreground ml-1.5">
                      — A következő hivatkozott bizonylat(ok) hiányoznak vagy törölték őket:{' '}
                      <code className="font-mono text-[11px] bg-muted px-1 rounded">
                        {invoiceReferenceNumber}
                      </code>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-xs">
                A(z) <strong>{invoiceReferenceNumber}</strong> sorszámú bizonylat nem található a
                rendszerben. Lehetséges, hogy még nem töltötték fel, törölték, vagy hibás a hivatkozás.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Linked invoices (reference_number based) */}
      {linkedInvoices.length > 0 && (
        <>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider expand-stagger-1">
            <GitBranch className="h-3.5 w-3.5" />
            Kapcsolt bizonylatok
          </div>
          {linkedInvoices.map((inv) => (
            <Card
              key={inv.id}
              className={cn(
                "bg-muted/30 border-border/50 transition-colors expand-stagger-1",
                (inv.image_url || inv.melleklet_url) && onViewInvoice && "cursor-pointer hover:border-primary/50"
              )}
              onClick={() => {
                if ((inv.image_url || inv.melleklet_url) && onViewInvoice) {
                  onViewInvoice(inv as MatchedSubmittedInvoice);
                }
              }}
            >
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <GitBranch className="h-3 w-3 text-muted-foreground" />
                    Kapcsolt bizonylat
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1 text-[10px] h-5">
                      <Link2 className="h-2.5 w-2.5" />
                      {inv.relationDirection === 'parent'
                        ? 'Hivatkozott bizonylat'
                        : inv.relationDirection === 'child'
                        ? 'Hivatkozó bizonylat'
                        : 'Kapcsolt'}
                    </Badge>
                    {inv.invoice_type && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20"
                      >
                        {getInvoiceTypeLabel(inv.invoice_type)}
                      </Badge>
                    )}
                    {inv.reference_number && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        → {inv.reference_number}
                      </Badge>
                    )}
                    {(inv.image_url || inv.melleklet_url) && onViewInvoice && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Kattints a részletekért
                      </span>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Bizonylatsorszám:</span>
                    <span className="ml-1 font-mono font-medium">{inv.bizonylatsorszam || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Eladó:</span>
                    <span className="ml-1 font-medium">{inv.elado_nev}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vevő:</span>
                    <span className="ml-1 font-medium">{inv.vevo_nev}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Kiállítás:</span>
                    <span className="ml-1">
                      {format(new Date(inv.kibocsatas_datuma), 'yyyy.MM.dd', { locale: hu })}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bruttó:</span>
                    <span className="ml-1 font-mono font-medium">
                      {formatCurrency(inv.brutto_vegosszeg, inv.penznem || 'HUF')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {hasOtherMatches && <Separator className="my-1" />}
        </>
      )}
    </>
  );
}
