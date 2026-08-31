import React, { useState } from 'react';
import { ChevronDown, ArrowRightLeft } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import type { MatchedTransaction } from './types';

interface InlineTransactionListProps {
  transactions: MatchedTransaction[];
  invoiceId: string;
}

export function InlineTransactionList({ transactions }: InlineTransactionListProps) {
  const [open, setOpen] = useState(false);

  if (!transactions || transactions.length === 0) return null;

  return (
    <div className="mt-2 pt-2 border-t border-border/30">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", open && "rotate-180")} />
        <ArrowRightLeft className="h-2.5 w-2.5" />
        <span className="font-medium">Párosított tranzakciók ({transactions.length})</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1">
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center gap-2 text-[10px] pl-4">
              <span className="text-muted-foreground whitespace-nowrap">
                {format(new Date(tx.transaction_date), 'MM.dd', { locale: hu })}
              </span>
              <span className={cn(
                "font-mono font-medium whitespace-nowrap",
                tx.amount < 0 ? "text-destructive" : "text-success"
              )}>
                {formatCurrency(tx.amount, tx.currency || 'HUF')}
              </span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground truncate cursor-default">
                      {tx.description ? tx.description.substring(0, 60) + (tx.description.length > 60 ? '…' : '') : '-'}
                    </span>
                  </TooltipTrigger>
                  {tx.description && tx.description.length > 60 && (
                    <TooltipContent side="top" className="max-w-md text-xs">
                      {tx.description}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
