/**
 * Partner 360 Summary Card (Module 22)
 * Kompakt főkönyvi pozíció és likviditási összefoglaló a Partner adatlapján.
 */

import React from 'react';
import {
  Scale,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePartner360 } from '@/hooks/useTechnicalAccounting';
import { useDateRange } from '@/contexts/DateRangeContext';

interface Partner360SummaryCardProps {
  companyId?: string;
  partnerId: string;
  onOpenFullView: () => void;
}

export const Partner360SummaryCard: React.FC<Partner360SummaryCardProps> = ({
  companyId,
  partnerId,
  onOpenFullView,
}) => {
  const { dateFromFormatted, dateToFormatted } = useDateRange();

  const { data, isLoading } = usePartner360(
    companyId,
    partnerId,
    dateFromFormatted || undefined,
    dateToFormatted || undefined
  );

  if (isLoading) {
    return (
      <div className="border border-border/30 rounded-xl p-4 bg-muted/10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
        <span>Főkönyvi pozíció betöltése...</span>
      </div>
    );
  }

  const summary = data?.summary;
  const accountsCount = data?.accounts?.length || 0;

  if (!summary || accountsCount === 0) {
    return (
      <div className="border border-border/30 rounded-xl p-3 bg-muted/10 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Ehhez a partnerhez nincs könyvelt főkönyvi tétel a megadott időszakban.</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenFullView}
          className="h-6 text-[11px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10"
        >
          Karton megnyitása
        </Button>
      </div>
    );
  }

  const formatHUF = (val: number) =>
    new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <div className="border border-indigo-500/20 bg-indigo-500/5 rounded-xl p-3.5 space-y-3">
      {/* Pozíció státusz badge és gomb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {summary.position_type === 'NET_RECEIVABLE' && (
            <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] gap-1 font-semibold">
              <TrendingUp className="h-3 w-3" />
              Nettó Követelésünk van
            </Badge>
          )}
          {summary.position_type === 'NET_PAYABLE' && (
            <Badge variant="outline" className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] gap-1 font-semibold">
              <TrendingDown className="h-3 w-3" />
              Nettó Tartozásunk van
            </Badge>
          )}
          {summary.position_type === 'BALANCED' && (
            <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px] gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Kiegyenlített Pozíció
            </Badge>
          )}
          {summary.can_compensate && (
            <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] gap-1 font-semibold">
              <ArrowRightLeft className="h-3 w-3" />
              Kompenzálható
            </Badge>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenFullView}
          className="h-6 px-2 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 gap-1 font-medium"
        >
          <FileSpreadsheet className="h-3 w-3" />
          Karton & Jegyzőkönyv
        </Button>
      </div>

      {/* Számadatok grid */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-background/80 rounded-lg p-2 border border-border/50">
          <span className="text-[10px] text-muted-foreground block">Követelés (Vevő)</span>
          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            {formatHUF(summary.total_receivables)}
          </span>
        </div>

        <div className="bg-background/80 rounded-lg p-2 border border-border/50">
          <span className="text-[10px] text-muted-foreground block">Tartozás (Szállító)</span>
          <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
            {formatHUF(summary.total_payables)}
          </span>
        </div>

        <div className="bg-background/80 rounded-lg p-2 border border-border/50">
          <span className="text-[10px] text-muted-foreground block">Nettó Egyenleg</span>
          <span className="font-mono font-bold text-foreground">
            {formatHUF(summary.net_position)}
          </span>
        </div>
      </div>

      {/* Kompenzációs tipp */}
      {summary.can_compensate && (
        <div className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center justify-between pt-1 border-t border-indigo-500/15">
          <span>Ptk. 6:49. § szerinti beszámítási lehetőség:</span>
          <span className="font-mono font-bold">{formatHUF(summary.compensable_amount)}</span>
        </div>
      )}
    </div>
  );
};
