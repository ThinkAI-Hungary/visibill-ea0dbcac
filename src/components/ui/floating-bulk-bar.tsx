import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { FloatingBulkSelect, type FloatingBulkSelectOption, type FloatingBulkSelectProps } from './floating-bulk-select';

export interface FloatingBulkBarProps {
  /**
   * Whether the bulk bar is visible.
   * If not provided, defaults to `count > 0`.
   */
  open?: boolean;
  /**
   * Number of currently selected items.
   */
  count: number;
  /**
   * Label for the count indicator. Default: 'Kijelölt elemek:'
   */
  label?: string;
  /**
   * Unit suffix for count. Default: 'db'
   */
  itemUnit?: string;
  /**
   * Optional summary node (e.g. Total amount, Inflow/Outflow).
   */
  details?: React.ReactNode;

  /**
   * Save / Commit callback for staged changes.
   */
  onSave?: () => void | Promise<void>;
  /**
   * Label for the Save button. Default: 'Mentés'
   */
  saveLabel?: string;
  /**
   * Indicates if any field was modified and has pending changes to save.
   */
  isDirty?: boolean;
  /**
   * Indicates if the save action is currently in progress.
   */
  isSaving?: boolean;
  /**
   * Explicit override for whether the save button can be clicked.
   * If not specified, defaults to `isDirty && !isSaving`.
   */
  canSave?: boolean;
  /**
   * Whether to hide the Save button entirely (e.g. if all actions are immediate).
   */
  hideSaveButton?: boolean;
  /**
   * Controls when the Save button is displayed:
   * - 'dirty-only': Only visible when isDirty or isSaving is true (cleanest UI)
   * - 'always': Always visible (disabled when not dirty)
   * Default: 'dirty-only'
   */
  showSaveButton?: 'dirty-only' | 'always';

  /**
   * Cancel / Clear callback to dismiss selection.
   */
  onCancel: () => void;
  /**
   * Label for the Cancel button. Default: 'Mégse'
   */
  cancelLabel?: string;

  /**
   * Custom domain-specific action buttons, selects, or dropdowns.
   */
  children?: React.ReactNode;
  /**
   * Additional container CSS classes.
   */
  className?: string;
  /**
   * Whether to portal to document.body (default: true).
   */
  portal?: boolean;
}

export function FloatingBulkBar({
  open,
  count,
  label,
  itemUnit,
  details,
  onSave,
  saveLabel,
  isDirty = false,
  isSaving = false,
  canSave,
  hideSaveButton = false,
  showSaveButton = 'dirty-only',
  onCancel,
  cancelLabel,
  children,
  className,
  portal = true,
}: FloatingBulkBarProps) {
  const { t } = useTranslation(['common']);
  const effectiveLabel = label ?? t('common:floating_bulk_bar.selected_items', 'Kijelölt elemek:');
  const effectiveItemUnit = itemUnit ?? t('common:floating_bulk_bar.unit_db', 'db');
  const effectiveSaveLabel = saveLabel ?? (isSaving ? t('common:floating_bulk_bar.saving', 'Mentés...') : t('common:floating_bulk_bar.save', 'Mentés'));
  const effectiveCancelLabel = cancelLabel ?? t('common:floating_bulk_bar.cancel', 'Mégse');

  const isVisible = open !== undefined ? open : count > 0;
  if (!isVisible) return null;

  const saveAllowed = canSave !== undefined ? canSave : (isDirty && !isSaving);
  const shouldRenderSave =
    !hideSaveButton &&
    !!onSave &&
    (showSaveButton === 'always' || isDirty || isSaving);

  const content = (
    <div
      data-testid="floating-bulk-bar"
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 w-max max-w-[calc(100vw-2rem)] sm:max-w-6xl xl:max-w-7xl',
        'bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-xl',
        'px-4 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-4 z-[9999]',
        'animate-in fade-in slide-in-from-bottom-4 duration-300',
        className
      )}
    >
      {/* Left: Indicator + Count + Optional Details */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse shrink-0" />
        <p className="text-sm font-semibold text-foreground whitespace-nowrap">
          {effectiveLabel} <span className="font-extrabold text-primary tabular-nums">{count} {effectiveItemUnit}</span>
        </p>

        {details && (
          <>
            <span className="text-muted-foreground/30 text-xs hidden sm:inline">|</span>
            <div className="text-xs text-muted-foreground font-medium hidden sm:flex items-center gap-2 whitespace-nowrap">
              {details}
            </div>
          </>
        )}
      </div>

      {/* Right: Specific actions + Universal Save + Cancel strictly on one line */}
      <div className="flex items-center justify-end gap-2 shrink-0">
        {children}

        {/* Universal Save button */}
        {shouldRenderSave && (
          <Button
            type="button"
            size="sm"
            disabled={!saveAllowed}
            onClick={onSave}
            className={cn(
              'h-9 text-xs gap-1.5 rounded-lg font-semibold shadow-sm transition-all shrink-0 px-3',
              isDirty
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20 animate-in fade-in zoom-in-95'
                : 'opacity-50 cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {effectiveSaveLabel}
          </Button>
        )}

        {/* Separator before Cancel */}
        <div className="w-px h-5 bg-border/80 mx-1 hidden sm:block shrink-0" />

        {/* Universal Cancel button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 text-xs px-3 text-muted-foreground hover:text-foreground bg-background/80 hover:bg-accent/60 border-border/80 rounded-lg transition-colors font-medium gap-1 shrink-0"
          onClick={onCancel}
        >
          <X className="w-3.5 h-3.5" />
          {effectiveCancelLabel}
        </Button>
      </div>
    </div>
  );

  if (portal && typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }

  return content;
}


export function FloatingBulkBarSeparator({ className }: { className?: string }) {
  return <div className={cn('w-px h-5 bg-border/80 mx-1 hidden sm:block shrink-0', className)} />;
}

FloatingBulkBar.Separator = FloatingBulkBarSeparator;
FloatingBulkBar.Select = FloatingBulkSelect;

export { FloatingBulkSelect, type FloatingBulkSelectOption, type FloatingBulkSelectProps };
