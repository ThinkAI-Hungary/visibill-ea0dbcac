import { TooltipRenderProps } from 'react-joyride';
import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';

export function ProductTourTooltip({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  tooltipProps,
  isLastStep,
  size,
}: TooltipRenderProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const currentStep = index + 1;
  const totalSteps = size;

  return (
    <div
      {...tooltipProps}
      className={`
        w-[340px] rounded-xl border shadow-lg
        ${isDark 
          ? 'bg-[hsl(222,47%,8%)] border-border/30 text-foreground' 
          : 'bg-white border-border/50 text-foreground shadow-xl'
        }
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="h-4 w-4" />
          <span>{currentStep} / {totalSteps}</span>
        </div>
        <button
          {...closeProps}
          className={`
            p-1 rounded-md transition-colors
            ${isDark 
              ? 'text-muted-foreground hover:text-primary hover:bg-primary/10' 
              : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
            }
          `}
          aria-label="Túra bezárása"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="px-5 py-3">
        {step.title && (
          <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-primary' : 'text-foreground'}`}>
            {step.title}
          </h3>
        )}
        <div className={`text-sm leading-relaxed ${isDark ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
          {step.content}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 pb-4 pt-2">
        <div>
          {index > 0 && (
            <Button
              {...backProps}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              Előző
            </Button>
          )}
        </div>
        <div>
          {continuous && (
            <Button
              {...primaryProps}
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-6"
            >
              {isLastStep ? 'Befejezés' : 'Tovább'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
