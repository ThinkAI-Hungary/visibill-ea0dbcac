import React, { useState, useCallback, memo } from 'react';
import { ThumbsUp, ThumbsDown, Check, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CustomTooltip } from '@/components/ui/custom-tooltip';

export interface MessageFeedbackWidgetProps {
  messageId: string;
  isHelpful?: boolean | null;
  feedbackReason?: string | null;
  onFeedback: (isHelpful: boolean | null, reason?: string | null) => Promise<void> | void;
  disabled?: boolean;
}

const QUICK_NEGATIVE_REASONS = [
  'Pontatlan információ',
  'Nem válaszolt a kérdésre',
  'Elavult vagy hiányos adat',
  'Félrevezető instrukció',
];

export const MessageFeedbackWidget = memo(function MessageFeedbackWidget({
  messageId,
  isHelpful,
  feedbackReason,
  onFeedback,
  disabled = false,
}: MessageFeedbackWidgetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [customReason, setCustomReason] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Rate as Helpful (Thumbs Up)
  const handleVoteHelpful = useCallback(async () => {
    if (disabled || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // If already helpful, clicking again toggles/clears it
      const nextVal = isHelpful === true ? null : true;
      setShowReasonPicker(false);
      await onFeedback(nextVal, null);
    } finally {
      setIsSubmitting(false);
    }
  }, [disabled, isSubmitting, isHelpful, onFeedback]);

  // Rate as Unhelpful (Thumbs Down)
  const handleVoteUnhelpful = useCallback(async () => {
    if (disabled || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (isHelpful === false) {
        // Toggle off / clear
        setShowReasonPicker(false);
        await onFeedback(null, null);
      } else {
        // Vote unhelpful and open quick reason selector
        setShowReasonPicker(true);
        await onFeedback(false, null);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [disabled, isSubmitting, isHelpful, onFeedback]);

  // Select a reason tag
  const handleSelectReason = useCallback(async (reason: string) => {
    if (disabled || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const nextReason = feedbackReason === reason ? null : reason;
      await onFeedback(false, nextReason);
    } finally {
      setIsSubmitting(false);
    }
  }, [disabled, isSubmitting, feedbackReason, onFeedback]);

  // Submit custom text reason
  const handleSubmitCustomReason = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || isSubmitting || !customReason.trim()) return;
    setIsSubmitting(true);
    try {
      await onFeedback(false, customReason.trim());
      setShowCustomInput(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [disabled, isSubmitting, customReason, onFeedback]);

  // If rated positively
  if (isHelpful === true) {
    return (
      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between gap-2 text-xs">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium">
          <Check className="w-3.5 h-3.5" />
          <span>Hasznosnak jelölve</span>
        </div>
        <button
          type="button"
          onClick={handleVoteHelpful}
          disabled={disabled || isSubmitting}
          className="text-[11px] text-muted-foreground hover:text-foreground underline transition-colors cursor-pointer"
        >
          Visszavonás
        </button>
      </div>
    );
  }

  // If rated negatively
  if (isHelpful === false) {
    return (
      <div className="mt-2.5 pt-2 border-t border-border/40 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 font-medium">
            <X className="w-3.5 h-3.5" />
            <span>Nem volt hasznos</span>
            {feedbackReason && (
              <span className="text-[10px] font-normal text-rose-600/80 dark:text-rose-400/80">
                ({feedbackReason})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onFeedback(null, null)}
            disabled={disabled || isSubmitting}
            className="text-[11px] text-muted-foreground hover:text-foreground underline transition-colors cursor-pointer"
          >
            Visszavonás
          </button>
        </div>

        {/* Quick reason tag selector */}
        <div className="bg-background/80 dark:bg-slate-900/60 p-2.5 rounded-lg border border-border/60 space-y-2">
          <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-amber-500" />
            Segíts javítani a válaszokat: mi volt a probléma?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_NEGATIVE_REASONS.map(reason => {
              const isSelected = feedbackReason === reason;
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => handleSelectReason(reason)}
                  disabled={disabled || isSubmitting}
                  className={cn(
                    'px-2 py-1 rounded-md text-[11px] transition-all cursor-pointer border',
                    isSelected
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-300 font-semibold shadow-xs'
                      : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border-transparent'
                  )}
                >
                  {isSelected && <Check className="w-2.5 h-2.5 inline mr-1" />}
                  {reason}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowCustomInput(v => !v)}
              className="px-2 py-1 rounded-md text-[11px] text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-primary/50 transition-colors"
            >
              + Egyéb ok
            </button>
          </div>

          {showCustomInput && (
            <form onSubmit={handleSubmitCustomReason} className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Rövid megjegyzés..."
                maxLength={500}
                className="flex-1 px-2.5 py-1 text-xs rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={disabled || isSubmitting}
              />
              <button
                type="submit"
                disabled={disabled || isSubmitting || !customReason.trim()}
                className="px-2.5 py-1 text-xs rounded-md bg-primary text-primary-foreground font-medium disabled:opacity-50 cursor-pointer"
              >
                Mentés
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Default / unrated state: Discrete Question + Thumbs Up / Down buttons
  return (
    <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between gap-2 text-xs select-none">
      <span className="text-[11px] text-muted-foreground font-medium">
        Hasznos volt ez a válasz?
      </span>
      <div className="flex items-center gap-1">
        <CustomTooltip content="Hasznos válasz" side="top">
          <button
            type="button"
            onClick={handleVoteHelpful}
            disabled={disabled || isSubmitting}
            aria-label="Hasznos válasz"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 border border-border/50 hover:border-emerald-500/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>Igen</span>
          </button>
        </CustomTooltip>

        <CustomTooltip content="Nem volt hasznos" side="top">
          <button
            type="button"
            onClick={handleVoteUnhelpful}
            disabled={disabled || isSubmitting}
            aria-label="Nem volt hasznos"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 border border-border/50 hover:border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>Nem</span>
          </button>
        </CustomTooltip>
      </div>
    </div>
  );
});
