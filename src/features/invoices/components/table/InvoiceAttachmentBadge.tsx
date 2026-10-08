import React from 'react';
import { Paperclip } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface InvoiceAttachmentBadgeProps {
  count: number;
  hasTig?: boolean;
  className?: string;
  reserveSpace?: boolean;
}

export function InvoiceAttachmentBadge({
  count,
  hasTig = false,
  className,
  reserveSpace = true,
}: InvoiceAttachmentBadgeProps) {
  if (!count || count <= 0) {
    if (!reserveSpace) {
      return null;
    }
    return <span className={cn('inline-block w-[30px] h-5 shrink-0', className)} aria-hidden="true" />;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center justify-center gap-0.5 min-w-[30px] h-5 px-1 py-0.5 rounded text-[10px] font-medium tabular-nums cursor-default transition-colors shrink-0',
            hasTig
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
              : 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30',
            className
          )}
        >
          <Paperclip className="h-2.5 w-2.5 shrink-0" />
          <span>{count}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {hasTig ? 'Csatolt TIG / igazolás' : 'Csatolt melléklet'} ({count} db állomány)
      </TooltipContent>
    </Tooltip>
  );
}
