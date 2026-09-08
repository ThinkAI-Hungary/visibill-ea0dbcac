import { useState, useCallback, useEffect } from "react";
import { MessageSquareText, Bot, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FeedbackDialog } from "./FeedbackDialog";
import { AiAssistantDrawer } from "@/components/ai/AiAssistantDrawer";
import { cn } from "@/lib/utils";

export interface FeedbackFabProps {
  onAiOpen?: () => void;
  aiDrawerOpen?: boolean;
  onAiClose?: () => void;
}

/**
 * FeedbackFab — Dual Floating Action Bubbles.
 *
 * Provides two independent, directly accessible floating bubbles:
 * 1. AI Chat Assistant (Sparkles, violet gradient) — toggles the slide-over AI assistant drawer.
 * 2. Feedback / Bug report (MessageSquareText, primary) — opens the FeedbackDialog.
 *
 * Rendered on both eaisybill and eaisybooks protected layouts.
 * When the AI drawer is opened:
 * - On desktop: bubbles smoothly shift left (md:right-[456px]) next to the 440px drawer.
 * - The AI bubble switches to a close toggle (X).
 * - On mobile: bubbles hide while drawer is open to give full screen to the chat.
 */
export function FeedbackFab({ onAiOpen, aiDrawerOpen: controlledAiOpen, onAiClose }: FeedbackFabProps = {}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [uncontrolledAiOpen, setUncontrolledAiOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isControlled = controlledAiOpen !== undefined;
  const isAiOpen = isControlled ? controlledAiOpen : uncontrolledAiOpen;

  const handleToggleAi = useCallback(() => {
    if (isAiOpen) {
      setSidebarOpen(false);
      if (onAiClose) {
        onAiClose();
      } else {
        setUncontrolledAiOpen(false);
      }
    } else {
      if (onAiOpen) {
        onAiOpen();
      } else {
        setUncontrolledAiOpen(true);
      }
    }
  }, [isAiOpen, onAiOpen, onAiClose]);

  const handleCloseAi = useCallback(() => {
    setSidebarOpen(false);
    if (onAiClose) {
      onAiClose();
    } else {
      setUncontrolledAiOpen(false);
    }
  }, [onAiClose]);

  // Reset sidebar state if drawer closes
  useEffect(() => {
    if (!isAiOpen) {
      setSidebarOpen(false);
    }
  }, [isAiOpen]);

  // Close AI drawer on Escape key
  useEffect(() => {
    if (!isAiOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseAi();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAiOpen, handleCloseAi]);

  return (
    <>
      {/* Floating Action Bubbles Container */}
      <div
        className={cn(
          "fixed bottom-6 z-50 flex flex-col items-end gap-3 print:hidden transition-all duration-300 ease-in-out",
          isAiOpen
            ? sidebarOpen
              ? "hidden md:flex md:right-[736px]"
              : "hidden md:flex md:right-[456px]"
            : "flex right-6"
        )}
      >
        {/* 1. AI Chat Asszisztens Bubble */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              id="ai-assistant-fab"
              onClick={handleToggleAi}
              className={cn(
                "flex items-center justify-center rounded-full shadow-lg transition-all duration-200 ease-out group",
                "h-13 w-13 min-h-[52px] min-w-[52px]",
                isAiOpen
                  ? "bg-card text-foreground border border-border/80 shadow-lg shadow-black/5 dark:shadow-black/30 hover:border-primary/50 hover:bg-primary/5 hover:text-primary hover:scale-105 active:scale-95"
                  : "bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 text-white shadow-teal-500/25 hover:shadow-teal-500/40 hover:scale-105 active:scale-95"
              )}
              aria-label={isAiOpen ? "AI Asszisztens bezárása" : "AI Asszisztens előhívása"}
            >
              {isAiOpen ? (
                <X className="h-5 w-5 text-muted-foreground transition-all duration-200 group-hover:rotate-90 group-hover:text-primary" />
              ) : (
                <div className="relative flex items-center justify-center">
                  <Bot className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                  <span className="absolute -inset-1 rounded-full bg-white/20 animate-pulse pointer-events-none" />
                </div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8}>
            {isAiOpen ? "AI bezárása" : "AI Asszisztens"}
          </TooltipContent>
        </Tooltip>

        {/* 2. Visszajelzés küldése Bubble */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              id="feedback-fab"
              onClick={() => setFeedbackOpen(true)}
              className={cn(
                "flex items-center justify-center",
                "h-12 w-12 min-h-[48px] min-w-[48px] rounded-full",
                "bg-primary text-primary-foreground",
                "shadow-lg shadow-primary/25",
                "hover:shadow-xl hover:shadow-primary/30",
                "hover:scale-105 active:scale-95",
                "transition-all duration-200 ease-out",
                "group",
                isAiOpen && "hidden"
              )}
              aria-label="Visszajelzés küldése"
            >
              <MessageSquareText className="h-5 w-5 transition-transform duration-200 group-hover:rotate-[-8deg]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={8}>
            Visszajelzés küldése
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Feedback Dialog */}
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />

      {/* Slide-over AI Assistant Drawer */}
      <AiAssistantDrawer
        open={isAiOpen}
        onClose={handleCloseAi}
        onSidebarChange={setSidebarOpen}
      />
    </>
  );
}
