import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FeedbackDialog } from "./FeedbackDialog";

/**
 * FeedbackFab — Floating Action Button.
 *
 * Renders a fixed-position button at the bottom-right corner of the viewport.
 * Always visible regardless of scroll position or page navigation.
 * Clicking opens the FeedbackDialog modal.
 */
export function FeedbackFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            id="feedback-fab"
            onClick={() => setOpen(true)}
            className="
              fixed bottom-6 right-6 z-50
              flex items-center justify-center
              h-14 w-14 rounded-full
              bg-primary text-primary-foreground
              shadow-lg shadow-primary/25
              hover:shadow-xl hover:shadow-primary/30
              hover:scale-105
              active:scale-95
              transition-all duration-200 ease-out
              print:hidden
              group
            "
            aria-label="Visszajelzés küldése"
          >
            <MessageSquareText className="h-6 w-6 transition-transform duration-200 group-hover:rotate-[-8deg]" />

            {/* Subtle glow ring */}
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-pulse pointer-events-none" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          Visszajelzés küldése
        </TooltipContent>
      </Tooltip>

      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
