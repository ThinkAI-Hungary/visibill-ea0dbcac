import { useState, useRef, useEffect } from "react";
import { MessageSquareText, Sparkles, Plus, Bug } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FeedbackDialog } from "./FeedbackDialog";
import { cn } from "@/lib/utils";

interface FeedbackFabProps {
  onAiOpen?: () => void;
  aiDrawerOpen?: boolean;
  onAiClose?: () => void;
}

/**
 * FeedbackFab — Floating Action Button.
 *
 * eaisybill: single feedback button (unchanged).
 * Accounty (drawer closed): normal round FAB → speed dial on click.
 * Accounty (drawer open): semicircle on right edge → speed dial on click.
 */
export function FeedbackFab({ onAiOpen, aiDrawerOpen, onAiClose }: FeedbackFabProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (onAiOpen) {
    return (
      <SpeedDialFab
        onFeedback={() => setFeedbackOpen(true)}
        onAiOpen={onAiOpen}
        aiDrawerOpen={aiDrawerOpen}
        onAiClose={onAiClose}
        feedbackOpen={feedbackOpen}
        setFeedbackOpen={setFeedbackOpen}
      />
    );
  }

  // === Classic (eaisybill) ===
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            id="feedback-fab"
            onClick={() => setFeedbackOpen(true)}
            className="
              fixed bottom-6 right-6 z-50
              flex items-center justify-center
              h-14 w-14 rounded-full
              bg-primary text-primary-foreground
              shadow-lg shadow-primary/25
              hover:shadow-xl hover:shadow-primary/30
              hover:scale-105 active:scale-95
              transition-all duration-200 ease-out
              print:hidden group
            "
            aria-label="Visszajelzés küldése"
          >
            <MessageSquareText className="h-6 w-6 transition-transform duration-200 group-hover:rotate-[-8deg]" />
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-pulse pointer-events-none" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          Visszajelzés küldése
        </TooltipContent>
      </Tooltip>
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}

// ─── Speed Dial (Accounty) ──────────────────────────────────────────

function SpeedDialFab({
  onFeedback,
  onAiOpen,
  aiDrawerOpen,
  onAiClose,
  feedbackOpen,
  setFeedbackOpen,
}: {
  onFeedback: () => void;
  onAiOpen: () => void;
  aiDrawerOpen?: boolean;
  onAiClose?: () => void;
  feedbackOpen: boolean;
  setFeedbackOpen: (v: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded]);

  const handleFeedback = () => {
    setExpanded(false);
    onFeedback();
  };

  const handleAi = () => {
    setExpanded(false);
    if (aiDrawerOpen) {
      onAiClose?.();
    } else {
      onAiOpen();
    }
  };

  return (
    <>
      {/* ── Expanded: speed dial menu ── */}
      {expanded && (
        <>
          <div className="fixed inset-0 z-40 animate-in fade-in duration-100" onClick={() => setExpanded(false)} />
          <div ref={containerRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 print:hidden">
            {/* AI Asszisztens */}
            <button
              onClick={handleAi}
              className="flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in duration-200"
              style={{ animationDelay: '50ms', animationFillMode: 'both' }}
            >
              <span className="px-3 py-1.5 rounded-lg bg-slate-900/90 dark:bg-slate-100/90 text-white dark:text-slate-900 text-xs font-medium shadow-lg whitespace-nowrap">
                {aiDrawerOpen ? 'AI bezárása' : 'AI Asszisztens'}
              </span>
              <div className={cn(
                "h-11 w-11 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110",
                aiDrawerOpen
                  ? "bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 ring-2 ring-violet-400/50"
                  : "bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-violet-500/30"
              )}>
                <Sparkles className="h-5 w-5" />
              </div>
            </button>

            {/* Hibabejelentés */}
            <button
              onClick={handleFeedback}
              className="flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in duration-200"
              style={{ animationDelay: '0ms', animationFillMode: 'both' }}
            >
              <span className="px-3 py-1.5 rounded-lg bg-slate-900/90 dark:bg-slate-100/90 text-white dark:text-slate-900 text-xs font-medium shadow-lg whitespace-nowrap">
                Hibabejelentés
              </span>
              <div className="h-11 w-11 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 transition-all hover:scale-110">
                <Bug className="h-5 w-5" />
              </div>
            </button>

            {/* Close */}
            <button
              onClick={() => setExpanded(false)}
              className="h-14 w-14 rounded-full flex items-center justify-center bg-slate-700 dark:bg-slate-300 text-white dark:text-slate-900 shadow-lg"
            >
              <Plus className="h-6 w-6 rotate-45" />
            </button>
          </div>
        </>
      )}

      {/* ── Collapsed: normal round FAB (hidden when drawer is open) ── */}
      {!expanded && !aiDrawerOpen && (
        <button
          id="feedback-fab"
          onClick={() => setExpanded(true)}
          className="
            fixed bottom-6 right-6 z-50 print:hidden
            h-14 w-14 rounded-full
            flex items-center justify-center
            bg-primary text-primary-foreground
            shadow-lg shadow-primary/25
            hover:shadow-xl hover:shadow-primary/30
            hover:scale-105 active:scale-95
            transition-all duration-200 ease-out
            group
          "
          aria-label="Gyorsmenü"
        >
          <Plus className="h-6 w-6 transition-transform duration-200 group-hover:rotate-90" />
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-pulse pointer-events-none" />
        </button>
      )}

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
