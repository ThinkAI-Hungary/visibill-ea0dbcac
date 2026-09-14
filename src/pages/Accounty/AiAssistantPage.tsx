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
    <div className="w-full page-animate">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg shadow-lg shadow-teal-500/25">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            e<span className="text-primary font-bold">AI</span>sy asszisztens
          </h1>
          <p className="text-sm text-muted-foreground">applikáció támogatás</p>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
        <AiAssistantChat fullPage />
      </div>
    </div>
  );
}
