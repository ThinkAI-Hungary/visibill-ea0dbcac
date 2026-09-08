import { Suspense, lazy } from 'react';
import { Bot, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CustomTooltip } from '@/components/ui/custom-tooltip';

// Lazy-load chat component directly without pulling in page-level modules
const AiAssistantChat = lazy(() => import('@/components/ai/AiAssistantChat'));

export interface AiAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  onSidebarChange?: (open: boolean) => void;
}

/**
 * AiAssistantDrawer — Slide-over AI Assistant Chat Drawer.
 *
 * Used across both eaisybill and eaisybooks.
 * Slides in from the right edge without a dark blocking backdrop,
 * allowing the user to view invoices, data tables, and forms while chatting.
 */
export function AiAssistantDrawer({ open, onClose, onSidebarChange }: AiAssistantDrawerProps) {
  if (!open) return null;

  return (
    <aside
      id="ai-assistant-drawer"
      role="dialog"
      aria-label="eAIsy asszisztens csevegés"
      aria-modal="false"
      className={cn(
        "fixed top-0 right-0 bottom-0 z-50",
        "w-full sm:w-[420px] md:w-[440px]",
        "bg-card border-l border-border",
        "shadow-[-8px_0_24px_-4px_rgba(0,0,0,0.12)] dark:shadow-[-8px_0_24px_-4px_rgba(0,0,0,0.4)]",
        "flex flex-col h-full",
        "animate-in slide-in-from-right duration-200"
      )}
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20">
            <Bot className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="font-semibold text-sm leading-none text-foreground">
              e<span className="text-primary font-bold">AI</span>sy asszisztens
            </h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">applikáció támogatás</p>
          </div>
        </div>

        <CustomTooltip content="Bezárás" side="left">
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="AI fiók bezárása"
          >
            <X className="w-4 h-4" />
          </button>
        </CustomTooltip>
      </div>

      {/* Drawer Body (min-h-0 without overflow-hidden so flyout panel can project outwards) */}
      <div className="flex-1 min-h-0">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              <LoadingSpinner message="AI Asszisztens betöltése..." />
            </div>
          }
        >
          <AiAssistantChat fullPage={false} onSidebarChange={onSidebarChange} />
        </Suspense>
      </div>
    </aside>
  );
}
