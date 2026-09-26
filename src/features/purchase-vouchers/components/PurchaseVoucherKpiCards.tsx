import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { Coins, Sparkles, Clock, Users, ArrowUpRight } from 'lucide-react';
import { PurchaseVouchersSummary } from '../types';

interface PurchaseVoucherKpiCardsProps {
  summary: PurchaseVouchersSummary;
}

export const PurchaseVoucherKpiCards: React.FC<PurchaseVoucherKpiCardsProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* 1. Összes Felvásárlás */}
      <Card className="border border-border/60 bg-card/80 shadow-2xs hover:shadow-xs transition-shadow">
        <CardContent className="p-3.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Felvásárlások bruttó</span>
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Coins className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-foreground font-mono">
            {formatCurrency(summary.total_gross)}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span>Nettó alap:</span>
            <span className="font-semibold text-foreground font-mono">{formatCurrency(summary.total_net)}</span>
          </div>
        </CardContent>
      </Card>

      {/* 2. Kompenzációs Felár (Levonható ÁFA) */}
      <Card className="border border-emerald-500/20 bg-emerald-500/5 shadow-2xs hover:shadow-xs transition-shadow">
        <CardContent className="p-3.5 space-y-1">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
            <span className="text-xs font-medium">Kompenzációs felár</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
            {formatCurrency(summary.total_compensation)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            ÁFA-ban levonható (12% / 7%)
          </div>
        </CardContent>
      </Card>

      {/* 3. Kifizetésre Váró Összeg */}
      <Card className="border border-amber-500/20 bg-amber-500/5 shadow-2xs hover:shadow-xs transition-shadow">
        <CardContent className="p-3.5 space-y-1">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-400">
            <span className="text-xs font-medium">Kifizetésre vár</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400 font-mono">
            {formatCurrency(summary.unpaid_gross)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Utalásra vagy pénztárra vár
          </div>
        </CardContent>
      </Card>

      {/* 4. Őstermelők Száma */}
      <Card className="border border-border/60 bg-card/80 shadow-2xs hover:shadow-xs transition-shadow">
        <CardContent className="p-3.5 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Őstermelők / Bizonylatok</span>
            <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl font-bold tracking-tight text-foreground font-mono">
            {summary.unique_producers} <span className="text-xs font-normal text-muted-foreground">fő</span>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span>Összes bizonylat:</span>
            <span className="font-semibold text-foreground font-mono">{summary.total_count} db</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
