import React from 'react';
import { Scale } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, cn } from '@/lib/utils';
import type { NettingGroup } from '@/hooks/useNettingDetection';

interface NettingCardSectionProps {
  nettingGroup: NettingGroup | null | undefined;
}

export function NettingCardSection({ nettingGroup }: NettingCardSectionProps) {
  if (!nettingGroup) return null;

  return (
    <Card className="bg-orange-500/[0.06] border-orange-400/40 expand-animate">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-xs font-medium flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5 text-orange-500" />
            Kompenzálási javaslat
          </span>
          <Badge className="text-[10px] h-5 bg-orange-500/15 text-orange-600 border-orange-400/40 hover:bg-orange-500/20">
            <Scale className="h-2.5 w-2.5 mr-0.5" />
            {nettingGroup.deliveryMonth}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        <div className="text-xs">
          <span className="text-muted-foreground">Partner:</span>
          <span className="ml-1 font-medium">{nettingGroup.partnerName}</span>
          <span className="ml-1.5 text-[10px] text-muted-foreground font-mono">
            ({nettingGroup.partnerTaxNumber})
          </span>
        </div>

        {/* Opposing invoices */}
        <div className="space-y-1.5">
          {nettingGroup.inboundInvoices.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Bejövő számlák ({nettingGroup.inboundInvoices.length})
              </div>
              {nettingGroup.inboundInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between text-xs py-0.5 pl-2 border-l-2 border-l-destructive/30"
                >
                  <span className="font-mono text-[11px]">{inv.invoice_number}</span>
                  <span className="font-mono text-destructive">
                    {formatCurrency(Math.abs(inv.invoice_gross_amount || 0), inv.currency || 'HUF')}
                  </span>
                </div>
              ))}
            </div>
          )}
          {nettingGroup.outboundInvoices.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Kimenő számlák ({nettingGroup.outboundInvoices.length})
              </div>
              {nettingGroup.outboundInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between text-xs py-0.5 pl-2 border-l-2 border-l-success/30"
                >
                  <span className="font-mono text-[11px]">{inv.invoice_number}</span>
                  <span className="font-mono text-success">
                    {formatCurrency(Math.abs(inv.invoice_gross_amount || 0), inv.currency || 'HUF')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="border-t border-orange-400/20 pt-2 grid grid-cols-3 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Bejövő összesen:</span>
            <div className="font-mono font-medium text-destructive">
              {formatCurrency(nettingGroup.inboundTotal, nettingGroup.currency)}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Kimenő összesen:</span>
            <div className="font-mono font-medium text-success">
              {formatCurrency(nettingGroup.outboundTotal, nettingGroup.currency)}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Nettó különbözet:</span>
            <div
              className={cn(
                "font-mono font-bold",
                nettingGroup.netDifference >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {formatCurrency(Math.abs(nettingGroup.netDifference), nettingGroup.currency)}
              <span className="text-[10px] font-normal text-muted-foreground ml-1">
                ({nettingGroup.netDifference >= 0 ? 'követelés' : 'tartozás'})
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
