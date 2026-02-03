import { Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CopyableCellProps {
  value: string;
  displayValue?: string;
  className?: string;
  truncate?: boolean;
  maxWidth?: string;
  ariaLabel?: string;
}

export function CopyableCell({
  value,
  displayValue,
  className,
  truncate = false,
  maxWidth = '150px',
  ariaLabel,
}: CopyableCellProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!navigator?.clipboard) {
      toast({
        title: "Hiba",
        description: "Nem sikerült másolni.",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({
        title: "Másolva",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Hiba",
        description: "Nem sikerült másolni.",
        variant: "destructive",
      });
    }
  }, [value]);

  const display = displayValue || value;

  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn("flex items-center gap-1 group", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              onClick={handleCopy}
              className={cn(
                "cursor-pointer hover:text-primary transition-none",
                truncate && "block truncate",
              )}
              style={truncate ? { maxWidth } : undefined}
              role="button"
              tabIndex={0}
              aria-label={ariaLabel || `${display} másolása`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleCopy(e as any);
                }
              }}
            >
              {display}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="break-all">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">Kattints a másoláshoz</p>
          </TooltipContent>
        </Tooltip>
        <button
          onClick={handleCopy}
          className={cn(
            "p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity",
            "hover:bg-muted focus:opacity-100",
            copied && "opacity-100"
          )}
          aria-label={ariaLabel || `${display} másolása`}
        >
          {copied ? (
            <Check className="h-3 w-3 text-success" />
          ) : (
            <Copy className="h-3 w-3 text-muted-foreground hover:text-primary" />
          )}
        </button>
      </div>
    </TooltipProvider>
  );
}
