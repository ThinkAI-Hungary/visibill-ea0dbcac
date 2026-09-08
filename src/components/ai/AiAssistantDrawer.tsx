import { Suspense, lazy } from 'react';
import { Sparkles, X, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy-load chat component so it does not affect initial page load
const AiAssistantChat = lazy(() =>
  import('@/pages/Accounty/AiAssistantPage').then(module => ({
    default: module.AiAssistantChat,
  }))
);

export interface AiAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * AiAssistantDrawer — Slide-over AI Assistant Chat Drawer.
 *
 * Used across both eaisybill and eaisybooks.
 * Slides in from the right edge without a dark blocking backdrop,
 * allowing the user to view invoices, data tables, and forms while chatting.
 */
export function AiAssistantDrawer({ open, onClose }: AiAssistantDrawerProps) {
  if (!open) return null;

  return (
    <aside
      id="ai-assistant-drawer"
      role="dialog"
      aria-label="AI Asszisztens csevegés"
      aria-modal="false"
      className={cn(
        "fixed top-0 right-0 bottom-0 z-50",
        "w-full sm:w-[420px] md:w-[440px]",
        "bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl",
        "flex flex-col h-full",
        "animate-in slide-in-from-right duration-200"
      )}
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 via-indigo-600 to-fuchsia-600 text-white flex items-center justify-center shadow-md shadow-violet-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-sm leading-none text-foreground">AI Asszisztens</h2>
            <p className="text-[10px] text-muted-foreground mt-0.5">eaisyBill & eaisyBooks szakértő</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Link
            to="/eaisybooks/ai-assistant"
            onClick={onClose}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 px-2.5 py-1 rounded-md hover:bg-primary/10 transition-colors font-medium"
            title="Megnyitás teljes oldalas nézetben"
          >
            <span>Teljes nézet</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="AI fiók bezárása"
            title="Bezárás"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              <LoadingSpinner message="AI Asszisztens betöltése..." />
            </div>
          }
        >
          <AiAssistantChat fullPage={false} />
        </Suspense>
      </div>
    </aside>
  );
}
