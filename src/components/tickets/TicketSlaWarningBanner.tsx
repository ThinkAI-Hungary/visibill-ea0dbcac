import React from 'react';
import { AlertCircle, CheckCircle2, MessageSquare, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TicketSlaInfo } from '@/utils/ticketSlaUtils';

interface TicketSlaWarningBannerProps {
  sla?: TicketSlaInfo | null;
  canManage?: boolean;
  onFocusReply?: () => void;
  onMarkNoResponseNeeded?: () => void;
  isMarking?: boolean;
  className?: string;
}

export const TicketSlaWarningBanner: React.FC<TicketSlaWarningBannerProps> = ({
  sla,
  canManage = true,
  onFocusReply,
  onMarkNoResponseNeeded,
  isMarking = false,
  className = '',
}) => {
  if (canManage === false || !sla || !sla.isOverdue48h) {
    return null;
  }

  const isAssignee = sla.targetParty === 'assignee';

  return (
    <div
      className={`rounded-xl border p-4 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 shadow-sm transition-all ${
        isAssignee
          ? 'bg-destructive/10 border-destructive/30 text-destructive dark:bg-destructive/15'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
      } ${className}`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div
          className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
            isAssignee ? 'bg-destructive/20 text-destructive' : 'bg-amber-500/20 text-amber-600'
          }`}
        >
          {isAssignee ? (
            <AlertCircle className="h-5 w-5" />
          ) : (
            <AlertTriangle className="h-5 w-5" />
          )}
        </div>
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold tracking-tight">
              SLA Figyelmeztetés: 48 órája megválaszolatlan megkeresés!
            </span>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 leading-none ${
                isAssignee
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
              }`}
            >
              <Clock className="h-3 w-3 shrink-0 opacity-85" />
              <span>{sla.hoursWaiting} órája várakozik</span>
            </span>
          </div>
          <p className="text-xs text-foreground/85 leading-relaxed">
            {isAssignee
              ? 'A hibajegy felelőseként az ügyfél utolsó üzenete óta több mint 48 óra telt el hivatalos válasz nélkül. Kérjük, sürgősen válaszolj az ügyfélnek a feladat elvégzéséhez!'
              : 'A hibajegy még gazdátlan (nincs hozzárendelt felelőse), miközben az ügyfél több mint 48 órája vár segítségre. Kérjük, rendeld hozzá egy munkatárshoz vagy küldj választ!'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
        {onMarkNoResponseNeeded && (
          <Button
            size="sm"
            variant="outline"
            onClick={onMarkNoResponseNeeded}
            disabled={isMarking}
            className="gap-1.5 h-8 text-xs font-semibold bg-background/80 hover:bg-background border-border/80 text-foreground"
            title="Kattints, ha az ügyfél üzenete nem igényel választ (pl. megerősítés, 'köszi működik')"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>Nem igényel választ</span>
          </Button>
        )}

        {onFocusReply && (
          <Button
            size="sm"
            variant={isAssignee ? 'destructive' : 'default'}
            onClick={onFocusReply}
            className="gap-1.5 h-8 text-xs font-semibold shrink-0"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Válasz írása</span>
          </Button>
        )}
      </div>
    </div>
  );
};
