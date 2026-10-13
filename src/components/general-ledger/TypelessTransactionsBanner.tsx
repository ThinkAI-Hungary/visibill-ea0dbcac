import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, ArrowRight, AlertTriangle } from 'lucide-react';

interface TypelessTransactionsBannerProps {
  count: number;
  onOpenApproval: () => void;
  className?: string;
}

export function TypelessTransactionsBanner({
  count,
  onOpenApproval,
  className = '',
}: TypelessTransactionsBannerProps) {
  if (count <= 0) return null;

  return (
    <Card className={`border-amber-500/50 bg-amber-50/70 dark:bg-amber-950/25 shadow-xs print:hidden animate-in fade-in slide-in-from-top-2 duration-300 ${className}`}>
      <CardContent className="p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5 relative">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-600"></span>
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-amber-950 dark:text-amber-100 flex items-center gap-1.5">
                <span>{count} db típus nélküli banki tranzakció jóváhagyásra vár</span>
              </h4>
              <Badge variant="outline" className="text-[11px] font-medium bg-amber-100/80 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border-amber-300/80">
                <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
                Hard Guard aktív
              </Badge>
            </div>
            <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed max-w-3xl">
              A hamis kontírozás elkerülése érdekében a besorolatlan és típus nélküli tételek szigorúan a{' '}
              <strong className="underline underline-offset-2 font-semibold">Nem kategorizált tételek (UNCLASSIFIED)</strong>{' '}
              sorban szerepelnek. Rendelj hozzájuk típust és főkönyvi számot a véglegesítéshez!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <Button
            size="sm"
            onClick={onOpenApproval}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-medium text-xs shadow-xs h-8.5 px-3.5 cursor-pointer transition-colors"
          >
            <span>Tételek felülvizsgálata és jóváhagyása ({count})</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
