import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { useQuestionableInvoices } from '@/features/invoices/hooks/useQuestionableInvoices';
import { DeferredVatPromptDialog } from './DeferredVatPromptDialog';
import { useCompany } from '@/contexts/CompanyContext';

interface DeferredVatPromptBannerProps {
  year: number;
  month: number;
  onRecalculate?: () => Promise<void> | void;
  className?: string;
}

export function DeferredVatPromptBanner({
  year,
  month,
  onRecalculate,
  className = '',
}: DeferredVatPromptBannerProps) {
  const { selectedCompany } = useCompany();
  const {
    totalCount,
    totalVat,
    criticalCount,
    isLoading,
  } = useQuestionableInvoices(selectedCompany?.id);

  const [dialogOpen, setDialogOpen] = useState(false);

  if (isLoading || totalCount === 0) {
    return null;
  }

  const periodStr = `${year}-${String(month).padStart(2, '0')}`;

  return (
    <>
      <Card className={`border-amber-400/60 bg-amber-500/10 dark:bg-amber-950/20 shadow-sm print:hidden ${className}`}>
        <CardContent className="p-3.5 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                  {totalCount} db kérdéses számla várakozik döntésre ({formatCurrency(totalVat, 'HUF')} ÁFA tartalom)
                </h4>
                <Badge variant="outline" className="text-[10px] bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border-amber-300">
                  Áfa tv. 153/A. §
                </Badge>
                {criticalCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {criticalCount} db &lt; 180 nap
                  </Badge>
                )}
              </div>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                A jogszabályi 2 éves elszámolási határidőn belül most beemelheted ezeket a(z) <span className="font-semibold">{periodStr}</span> havi bevallásba és a havi költségek közé.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-sm h-8"
            >
              <span>Számlák áttekintése és beemelése</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeferredVatPromptDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentYear={year}
        currentMonth={month}
        onIncluded={onRecalculate}
      />
    </>
  );
}
