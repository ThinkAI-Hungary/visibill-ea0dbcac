import { Bot } from 'lucide-react';
import { AiAssistantChat } from '@/components/ai/AiAssistantChat';

// Re-export for backward compatibility
export { AiAssistantChat } from '@/components/ai/AiAssistantChat';
export type { AiAssistantChatProps } from '@/components/ai/AiAssistantChat';

/**
 * AiAssistantPage — Dedicated full-page view of the eaisyBooks AI Assistant.
 *
 * Provides page header, layout scaffolding, and hosts the fullPage
 * AiAssistantChat component.
 */
export default function AiAssistantPage() {
  return (
    <div className="w-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-lg shadow-teal-500/25">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            e<span className="text-primary font-bold">AI</span>sy asszisztens
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">applikáció támogatás</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <AiAssistantChat fullPage />
      </div>
    </div>
  );
}
