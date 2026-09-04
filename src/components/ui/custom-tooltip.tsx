import * as React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface CustomTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  delayDuration?: number;
  className?: string;
  asChild?: boolean;
}

export const CustomTooltip: React.FC<CustomTooltipProps> = ({
  content,
  children,
  side = 'top',
  align = 'center',
  sideOffset = 6,
  delayDuration = 150,
  className,
  asChild = true,
}) => {
  if (!content) return <>{children}</>;

  const isSingleElement = React.isValidElement(children);
  const useAsChild = asChild && isSingleElement;

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild={useAsChild}>
          {useAsChild ? children : <span>{children}</span>}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          sideOffset={sideOffset}
          className={cn(
            'z-[100] max-w-xs text-xs font-normal bg-popover/95 text-popover-foreground shadow-lg border border-border/80 rounded-md px-2.5 py-1.5 backdrop-blur-sm pointer-events-none select-none',
            className
          )}
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CustomTooltip;
