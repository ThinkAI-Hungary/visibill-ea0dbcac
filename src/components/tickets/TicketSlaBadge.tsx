import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { TicketSlaInfo } from '@/utils/ticketSlaUtils';

interface TicketSlaBadgeProps {
  sla?: TicketSlaInfo | null;
  className?: string;
  compact?: boolean;
  canManage?: boolean;
  showText?: boolean;
}

export const TicketSlaBadge: React.FC<TicketSlaBadgeProps> = ({
  sla,
  className = '',
  compact = false,
  canManage = true,
  showText = false,
}) => {
  if (canManage === false || !sla || sla.severity === 'normal') {
    return null;
  }

  const isBreached = sla.severity === 'breached_48h';
  const isAssignee = sla.targetParty === 'assignee';

  const colorClasses = isBreached
    ? isAssignee
      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/25'
      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
    : 'bg-amber-500/10 text-amber-600/90 dark:text-amber-400/90 border-amber-500/20 hover:bg-amber-500/20';

  const sizeClasses = showText
    ? compact
      ? 'px-2 py-0.5 text-[10px] gap-1 rounded-full'
      : 'px-2.5 py-0.5 text-xs gap-1.5 rounded-full'
    : compact
      ? 'h-5 w-5 p-0.5 rounded-md'
      : 'h-6 w-6 p-1 rounded-md';

  const iconSizeClasses = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const tooltipHeadline = isBreached
    ? `48 órán túli SLA túllépés (${sla.formattedWaitTime})`
    : `Közelgő SLA határidő (24h+, ${sla.formattedWaitTime})`;

  const tooltipText = isBreached
    ? isAssignee
      ? `A jegy felelőse több mint 48 órája (${sla.formattedWaitTime}, ${sla.hoursWaiting} órája) nem válaszolt az ügyfél üzenetére!`
      : `A hibajegynek nincs felelőse, és ${sla.formattedWaitTime} (${sla.hoursWaiting} órája) vár válaszra!`
    : `Közelgő határidő: az ügyfél ${sla.formattedWaitTime} (${sla.hoursWaiting} órája) vár válaszra.`;

  const badgeContent = (
    <div
      data-testid="ticket-sla-badge"
      aria-label={`${tooltipHeadline}: ${sla.formattedWaitTime}`}
      className={`inline-flex items-center justify-center font-medium leading-none shrink-0 border transition-all select-none cursor-help ${colorClasses} ${sizeClasses} ${className}`}
    >
      <AlertTriangle className={`${iconSizeClasses} shrink-0`} />
      {showText && (
        <span className="whitespace-nowrap ml-1">
          {compact
            ? isBreached
              ? `48h+ (${sla.formattedWaitTime})`
              : `24h+ (${sla.formattedWaitTime})`
            : isBreached
              ? isAssignee
                ? `48h+ válaszra vár (${sla.formattedWaitTime})`
                : `Gazdátlan (48h+)`
              : `24h+ válaszra vár (${sla.formattedWaitTime})`}
        </span>
      )}
      <span className="sr-only">{tooltipHeadline}</span>
    </div>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs font-normal p-2.5 shadow-md border border-border/80 bg-popover/95 backdrop-blur-sm z-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className={`h-4 w-4 shrink-0 mt-0.5 ${isBreached ? 'text-rose-500' : 'text-amber-500'}`} />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-foreground text-xs leading-tight">
                  {isBreached ? '48 órán túli SLA túllépés' : 'Közelgő SLA határidő'}
                </span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${isBreached ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25'}`}>
                  Lejárt: {sla.formattedWaitTime}
                </span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {tooltipText}
              </p>
              {sla.lastCustomerMessageAt && (
                <p className="text-[10px] text-muted-foreground/80 pt-1 border-t border-border/40">
                  Utolsó ügyfél aktivitás: {new Date(sla.lastCustomerMessageAt).toLocaleString('hu-HU')}
                </p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
