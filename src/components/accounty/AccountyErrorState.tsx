/**
 * AccountyErrorState — Reusable inline error display for Accounty pages.
 * Shows a friendly message with optional retry action. Does NOT replace the global
 * ErrorBoundary — this is for query-level errors that should be rendered inline
 * rather than crashing the whole page.
 */
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AccountyErrorStateProps {
  /** Error message to display */
  message?: string;
  /** Optional retry callback */
  onRetry?: () => void;
  /** Compact mode for use inside cards/sections */
  compact?: boolean;
  /** Custom className */
  className?: string;
}

export function AccountyErrorState({
  message = 'Nem sikerült betölteni az adatokat.',
  onRetry,
  compact = false,
  className,
}: AccountyErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4 gap-3' : 'py-16 px-6 gap-4',
        className
      )}
    >
      <div
        className={cn(
          'rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/30',
          compact ? 'w-10 h-10' : 'w-14 h-14'
        )}
      >
        <AlertTriangle
          className={cn(
            'text-red-500 dark:text-red-400',
            compact ? 'w-5 h-5' : 'w-7 h-7'
          )}
        />
      </div>
      <div className="space-y-1">
        <p
          className={cn(
            'font-semibold text-slate-700 dark:text-slate-300',
            compact ? 'text-sm' : 'text-base'
          )}
        >
          Hiba történt
        </p>
        <p
          className={cn(
            'text-slate-500 dark:text-slate-400 max-w-sm',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {message}
        </p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size={compact ? 'sm' : 'default'}
          onClick={onRetry}
          className="gap-2 mt-1"
        >
          <RefreshCw className="w-4 h-4" />
          Újrapróbálás
        </Button>
      )}
    </div>
  );
}
