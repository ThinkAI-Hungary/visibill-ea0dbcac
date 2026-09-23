import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
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
}

export const TicketSlaBadge: React.FC<TicketSlaBadgeProps> = ({
  sla,
  className = '',
  compact = false,
  canManage = true,
}) => {
  if (canManage === false || !sla || sla.severity === 'normal') {
    return null;
  }

  const isBreached = sla.severity === 'breached_48h';
  const isAssignee = sla.targetParty === 'assignee';

  const colorClasses = isBreached
    ? isAssignee
      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25 hover:bg-rose-500/15'
      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 hover:bg-amber-500/15'
    : 'bg-amber-500/10 text-amber-600/90 dark:text-amber-400/90 border-amber-500/20 hover:bg-amber-500/15';

  const sizeClasses = compact
    ? 'px-2 py-0.5 text-[10px] gap-1'
    : 'px-2.5 py-0.5 text-xs gap-1.5';

  const badgeContent = (
    <div
      className={`inline-flex items-center rounded-full font-medium leading-none whitespace-nowrap shrink-0 border transition-colors select-none ${colorClasses} ${sizeClasses} ${className}`}
    >
      {isBreached && !isAssignee ? (
        <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />
      ) : (
        <Clock className="h-3 w-3 shrink-0 opacity-85" />
      )}

      <span className="whitespace-nowrap">
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
    </div>
  );

  const tooltipHeadline = isBreached
    ? '48 órán túli SLA túllépés'
    : 'Közelgő SLA határidő (24h+)';

  const tooltipText = isBreached
    ? isAssignee
      ? `A jegy felelőse több mint 48 órája (${sla.hoursWaiting} órája) nem válaszolt az ügyfél üzenetére!`
      : `A hibajegynek nincs felelőse, és ${sla.hoursWaiting} órája vár válaszra!`
    : `Közelgő határidő: az ügyfél ${sla.hoursWaiting} órája vár válaszra.`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs font-normal p-2.5 shadow-md border border-border/80 bg-popover/95 backdrop-blur-sm">
          <div className="flex items-start gap-2">
            <Clock className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground text-xs leading-tight">
                {tooltipHeadline}
              </p>
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
