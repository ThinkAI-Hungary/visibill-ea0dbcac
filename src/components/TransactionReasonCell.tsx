import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface TransactionReasonCellProps {
  reason: string | null;
}

export const TransactionReasonCell = ({ reason }: TransactionReasonCellProps) => {
  if (!reason) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }

  const truncated = reason.length > 10 ? reason.slice(0, 10) + '...' : reason;
  const fullText = reason.length > 300 ? reason.slice(0, 300) + '...' : reason;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-xs text-muted-foreground cursor-help max-w-[100px] block truncate">
            {truncated}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px] text-sm">
          <p className="whitespace-pre-wrap">{fullText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
