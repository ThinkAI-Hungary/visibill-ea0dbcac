import React from 'react';
import { FileText, Eye, CheckCircle2, Unlink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InlineTransactionList } from './InlineTransactionList';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { INVOICE_TYPE_LABELS } from '@/types/invoices';
import type { MatchedSubmittedInvoice, MatchedTransaction } from './types';

interface MatchedSubmittedInvoicesSectionProps {
  invoices: MatchedSubmittedInvoice[];
  onViewInvoice?: (invoice: MatchedSubmittedInvoice) => void;
  categories?: Array<{ id: string; name: string; color?: string | null }>;
  projects?: Array<{ id: string; name: string; color?: string | null }>;
  transactionId?: string;
  unmatching?: boolean;
  onUnmatch?: (invoiceId: string) => void;
  hideStandaloneTransactions?: boolean;
  effectiveMatchedTransactions?: MatchedTransaction[];
}

function getInvoiceTypeLabel(rawType: string): string {
  return INVOICE_TYPE_LABELS[rawType] || rawType.replace(/_/g, ' ');
}

export function MatchedSubmittedInvoicesSection({
  invoices,
  onViewInvoice,
  categories,
  projects,
  transactionId,
  unmatching = false,
  onUnmatch,
  hideStandaloneTransactions = false,
  effectiveMatchedTransactions = [],
}: MatchedSubmittedInvoicesSectionProps) {
  if (!invoices || invoices.length === 0) return null;

  return (
    <>
      {invoices.map((inv) => (
        <Card
          key={inv.id}
          className={cn(
            "bg-muted/30 border-border/50 transition-colors expand-stagger-2",
            (inv.image_url || inv.melleklet_url) && onViewInvoice && "cursor-pointer hover:border-primary/50"
          )}
          onClick={() => {
            if ((inv.image_url || inv.melleklet_url) && onViewInvoice) {
              onViewInvoice(inv);
            }
          }}
        >
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5 flex-wrap">
                <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                Párosított beküldött számla
                {inv.invoice_type && (
                  <Badge
                    variant="outline"
                    className="text-[9px] h-4 px-1.5 bg-primary/10 text-primary border-primary/20"
                  >
                    {getInvoiceTypeLabel(inv.invoice_type)}
                  </Badge>
                )}
                {inv.category_id &&
                  categories &&
                  (() => {
                    const cat = categories.find((c) => c.id === inv.category_id);
                    return cat ? (
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4 px-1.5 gap-0.5"
                        style={{
                          backgroundColor: (cat.color || '#6366f1') + '20',
                          color: cat.color || '#6366f1',
                          borderColor: (cat.color || '#6366f1') + '40',
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color || '#6366f1' }}
                        />
                        {cat.name}
                      </Badge>
                    ) : null;
                  })()}
                {inv.project_id &&
                  projects &&
                  (() => {
                    const proj = projects.find((p) => p.id === inv.project_id);
                    const projColor = proj?.color || '#7c3aed';
                    return proj ? (
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4 px-1.5 gap-0.5"
                        style={{
                          backgroundColor: projColor + '20',
                          color: projColor,
                          borderColor: projColor + '40',
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: projColor }}
                        />
                        {proj.name}
                      </Badge>
                    ) : null;
                  })()}
              </span>
              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                {transactionId && onUnmatch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={unmatching}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnmatch(inv.id);
                    }}
                    className="h-6 text-[10px] text-muted-foreground hover:text-destructive px-2 border border-border/40 hover:bg-destructive/10 rounded-md transition-colors gap-1"
                  >
                    <Unlink className="h-2.5 w-2.5" />
                    Párosítás megszüntetése
                  </Button>
                )}
                <Badge variant="success" className="gap-1 text-[10px] h-5">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Párosított
                </Badge>
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
            {/* Inline collapsible transaction list (Transactions page only, 2+ tx) */}
            {hideStandaloneTransactions && effectiveMatchedTransactions.length >= 2 && (
              <InlineTransactionList
                transactions={effectiveMatchedTransactions}
                invoiceId={inv.id}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </>
  );
}
