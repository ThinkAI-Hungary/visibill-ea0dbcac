import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ExtraMatchItem } from '@/lib/matching/types';

export interface TransactionMultiMatchesListProps {
  extraMatches: ExtraMatchItem[];
  isSaving: boolean;
  onRemoveExtraMatch: (matchId: string) => void;
  onOpenInvoiceDetails: (invoiceId: string) => void;
}

export const TransactionMultiMatchesList: React.FC<TransactionMultiMatchesListProps> = ({
  extraMatches,
  isSaving,
  onRemoveExtraMatch,
  onOpenInvoiceDetails,
}) => {
  if (!extraMatches || extraMatches.length === 0) return null;

  return (
    <div className="space-y-1.5 mt-2">
      <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        További párosított számlák
      </h4>
      {extraMatches.map(em => (
        <Card key={em.id} className="bg-muted/20 border-border/40">
          <CardContent className="p-2 flex items-center justify-between">
            <div
              className="text-xs space-y-0.5 cursor-pointer"
              onClick={() => {
                if (em.invoice) {
                  onOpenInvoiceDetails(em.invoice.id);
                }
              }}
            >
              {em.invoice ? (
                <>
                  <span className="font-mono font-medium">
                    {em.invoice.bizonylatsorszam || '-'}
                  </span>
                  <span className="text-muted-foreground mx-1">·</span>
                  <span>{em.invoice.elado_nev}</span>
                  <span className="text-muted-foreground mx-1">·</span>
                  <span className="font-mono">
                    {formatCurrency(
                      em.invoice.brutto_vegosszeg,
                      em.invoice.penznem || 'HUF'
                    )}
                  </span>
                  <Badge className="ml-1.5 text-[8px] h-3.5 px-1 bg-teal-500/15 text-teal-600 border-teal-500/30">
                    Beküldött
                  </Badge>
                </>
              ) : em.navInvoice ? (
                <>
                  <span className="font-mono font-medium">
                    {em.navInvoice.invoice_number || '-'}
                  </span>
                  <span className="text-muted-foreground mx-1">·</span>
                  <span>
                    {em.navInvoice.supplier_name || em.navInvoice.customer_name || '-'}
                  </span>
                  <span className="text-muted-foreground mx-1">·</span>
                  <span className="font-mono">
                    {formatCurrency(
                      em.navInvoice.invoice_gross_amount || 0,
                      em.navInvoice.currency || 'HUF'
                    )}
                  </span>
                  <Badge className="ml-1.5 text-[8px] h-3.5 px-1 bg-indigo-500/15 text-indigo-600 border-indigo-500/30">
                    NAV
                  </Badge>
                </>
              ) : (
                <span className="text-muted-foreground">Törölt bizonylat</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={isSaving}
              onClick={() => onRemoveExtraMatch(em.id)}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
