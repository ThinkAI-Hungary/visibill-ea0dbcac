import React, { useState } from 'react';
import { 
  Receipt, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  ShieldCheck, 
  Info 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { InvoiceSummaryDetails, InvoiceVatSummaryItem } from '../../../supabase/functions/_shared/nav/types';

interface NavInvoiceVatSummaryCardProps {
  vatSummary?: InvoiceSummaryDetails | null;
  currency?: string;
  isReverseCharge?: boolean;
  className?: string;
  defaultExpanded?: boolean;
}

/**
 * Szám formázása deviza jellel és ezres tagolással
 */
function formatAmount(amount?: number, curr = 'HUF'): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '—';
  return new Intl.NumberFormat('hu-HU', {
    style: 'decimal',
    minimumFractionDigits: curr === 'HUF' ? 0 : 2,
    maximumFractionDigits: curr === 'HUF' ? 0 : 2,
  }).format(amount) + ` ${curr}`;
}

/**
 * Badge stílus kiválasztása ÁFA kulcs kategória szerint
 */
function getVatBadgeVariant(item: InvoiceVatSummaryItem) {
  if (item.category === 'reverse_charge' || item.isReverseCharge) {
    return {
      className: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
      label: 'Fordított adózás (FAD)'
    };
  }
  if (item.category === 'exemption') {
    return {
      className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      label: item.exemptionCase || 'Adómentes'
    };
  }
  if (item.category === 'out_of_scope') {
    return {
      className: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
      label: item.outOfScopeCase || 'Hatályon kívüli'
    };
  }
  if (item.category === 'margin_scheme') {
    return {
      className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
      label: `Különbözeti (${item.marginSchemeIndicator || 'Árrés'})`
    };
  }
  if (item.category === 'content') {
    return {
      className: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
      label: item.vatRateLiteral || 'Adótartalom'
    };
  }

  // Normál százalékos
  return {
    className: 'bg-primary/15 text-primary border-primary/30',
    label: item.vatRateLiteral || `${item.vatPercentage ? Math.round(item.vatPercentage * 100) : 0}%`
  };
}

export function NavInvoiceVatSummaryCard({
  vatSummary,
  currency = 'HUF',
  isReverseCharge = false,
  className,
  defaultExpanded = false,
}: NavInvoiceVatSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!vatSummary || !vatSummary.vatSummaries || vatSummary.vatSummaries.length === 0) {
    return null;
  }

  const isMultiCurrency = currency !== 'HUF';
  const hasFad = isReverseCharge || vatSummary.hasReverseCharge;

  return (
    <div className={cn(
      "rounded-lg border border-primary/20 bg-card/60 backdrop-blur-sm overflow-hidden mb-4 transition-all shadow-sm",
      className
    )}>
      {/* Header bar */}
      <div 
        className={cn(
          "flex items-center justify-between px-4 py-2 bg-primary/5 cursor-pointer select-none hover:bg-primary/10 transition-colors",
          isExpanded && "border-b border-primary/10"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded-md bg-primary/10 text-primary">
            <Receipt className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground tracking-tight">
                Hivatalos NAV ÁFA Összesítő
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                <span>NAV v3.0</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {vatSummary.vatSummaries.map((item, idx) => {
            const badge = getVatBadgeVariant(item);
            return (
              <Badge key={idx} variant="outline" className={cn("text-[10px] px-1.5 py-0 font-medium", badge.className)}>
                {badge.label}
              </Badge>
            );
          })}

          {hasFad && !vatSummary.vatSummaries.some(i => i.isReverseCharge || i.category === 'reverse_charge') && (
            <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30 px-1.5 py-0 font-medium">
              FAD
            </Badge>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="h-6 w-6 p-0 ml-1 text-muted-foreground hover:text-foreground"
            title={isExpanded ? "Összecsukás" : "Kibontás"}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Body content */}
      {isExpanded && (
        <div className="p-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-muted-foreground border-b border-border/40 pb-1">
                  <th className="font-medium pb-2 pr-4">Áfakulcs / Jogcím</th>
                  <th className="font-medium pb-2 pr-4 text-right">Adóalap (Nettó)</th>
                  <th className="font-medium pb-2 pr-4 text-right">ÁFA összege</th>
                  <th className="font-medium pb-2 text-right">Bruttó érték</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {vatSummary.vatSummaries.map((item, idx) => {
                  const badge = getVatBadgeVariant(item);
                  const reason = item.exemptionReason || item.outOfScopeReason;

                  return (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-[11px] px-1.5 py-0 font-medium", badge.className)}>
                            {badge.label}
                          </Badge>
                          {reason && (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help inline-flex items-center text-muted-foreground/70 hover:text-foreground">
                                    <Info className="h-3 w-3" />
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[280px] text-xs">
                                  <p>{reason}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-foreground font-medium">
                        <div>{formatAmount(item.netAmount, currency)}</div>
                        {isMultiCurrency && item.netAmountHUF !== undefined && (
                          <div className="text-[10px] text-muted-foreground">{formatAmount(item.netAmountHUF, 'HUF')}</div>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-foreground font-medium">
                        <div>{formatAmount(item.vatAmount, currency)}</div>
                        {isMultiCurrency && item.vatAmountHUF !== undefined && (
                          <div className="text-[10px] text-muted-foreground">{formatAmount(item.vatAmountHUF, 'HUF')}</div>
                        )}
                      </td>
                      <td className="py-2 text-right font-mono text-foreground font-semibold">
                        <div>{formatAmount(item.grossAmount, currency)}</div>
                        {isMultiCurrency && item.grossAmountHUF !== undefined && (
                          <div className="text-[10px] text-muted-foreground">{formatAmount(item.grossAmountHUF, 'HUF')}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Aggregált számla végösszegek ha több tétel vagy eltér */}
              {vatSummary.vatSummaries.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-border/60 font-semibold text-foreground bg-muted/20">
                    <td className="pt-2 pb-1 pr-4">Összesen:</td>
                    <td className="pt-2 pb-1 pr-4 text-right font-mono">
                      <div>{formatAmount(vatSummary.invoiceNetAmount, currency)}</div>
                      {isMultiCurrency && vatSummary.invoiceNetAmountHUF !== undefined && (
                        <div className="text-[10px] font-normal text-muted-foreground">{formatAmount(vatSummary.invoiceNetAmountHUF, 'HUF')}</div>
                      )}
                    </td>
                    <td className="pt-2 pb-1 pr-4 text-right font-mono">
                      <div>{formatAmount(vatSummary.invoiceVatAmount, currency)}</div>
                      {isMultiCurrency && vatSummary.invoiceVatAmountHUF !== undefined && (
                        <div className="text-[10px] font-normal text-muted-foreground">{formatAmount(vatSummary.invoiceVatAmountHUF, 'HUF')}</div>
                      )}
                    </td>
                    <td className="pt-2 pb-1 text-right font-mono text-primary">
                      <div>{formatAmount(vatSummary.invoiceGrossAmount, currency)}</div>
                      {isMultiCurrency && vatSummary.invoiceGrossAmountHUF !== undefined && (
                        <div className="text-[10px] font-normal text-muted-foreground">{formatAmount(vatSummary.invoiceGrossAmountHUF, 'HUF')}</div>
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default NavInvoiceVatSummaryCard;
