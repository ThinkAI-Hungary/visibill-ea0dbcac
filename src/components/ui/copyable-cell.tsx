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
  align?: 'left' | 'right';
}

export function CopyableCell({
  value,
  displayValue,
  className,
  truncate = false,
  maxWidth = '150px',
  ariaLabel,
  align = 'left',
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
      <div className={cn("flex items-center group", className)}>
        <div className="relative inline-flex items-center">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleCopy}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity",
                  "hover:bg-muted focus:opacity-100",
                  copied && "opacity-100",
                  align === 'right' ? "right-full mr-1" : "left-full ml-1"
                )}
                aria-label={ariaLabel || `${display} másolása`}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground hover:text-primary" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">Kattints a másoláshoz</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
