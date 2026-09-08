import { describe, it, expect } from 'vitest';
import type { AiChatMessage, SubmitMessageFeedbackParams } from '@/hooks/useAiChatSessions';

describe('AI Assistant Message Feedback', () => {
  it('should conform to the AiChatMessage feedback data model', () => {
    const msg: AiChatMessage = {
      id: 'msg-123',
      session_id: 'session-456',
      role: 'assistant',
      content: 'A NAV számlaszinkronizáció automatikusan óránként fut.',
      created_at: new Date().toISOString(),
      is_helpful: true,
      feedback_reason: null,
      feedback_at: new Date().toISOString(),
    };

    expect(msg.is_helpful).toBe(true);
    expect(msg.feedback_reason).toBeNull();
    expect(msg.feedback_at).toBeDefined();
  });

  it('should accept negative feedback with specific reason category', () => {
    const negativeFeedback: SubmitMessageFeedbackParams = {
      messageId: 'msg-123',
      sessionId: 'session-456',
      isHelpful: false,
      reason: 'Pontatlan információ',
    };

    expect(negativeFeedback.isHelpful).toBe(false);
    expect(negativeFeedback.reason).toBe('Pontatlan információ');
  });

  it('should handle clearing or revoking feedback', () => {
    const revokeFeedback: SubmitMessageFeedbackParams = {
      messageId: 'msg-123',
      sessionId: 'session-456',
      isHelpful: null,
      reason: null,
    };

    expect(revokeFeedback.isHelpful).toBeNull();
    expect(revokeFeedback.reason).toBeNull();
  });

  it('should sanitize negative reason when switching back to helpful', () => {
    const updatePayload = (isHelpful: boolean | null, reason?: string | null) => ({
      is_helpful: isHelpful,
      feedback_reason: isHelpful === false ? (reason ?? null) : null,
      feedback_at: isHelpful !== null ? '2026-09-08T10:00:00Z' : null,
    });

    const positiveResult = updatePayload(true, 'Nem volt releváns');
    expect(positiveResult.is_helpful).toBe(true);
    expect(positiveResult.feedback_reason).toBeNull();
    expect(positiveResult.feedback_at).toBe('2026-09-08T10:00:00Z');

    const negativeResult = updatePayload(false, 'Nem válaszolt a kérdésre');
    expect(negativeResult.is_helpful).toBe(false);
    expect(negativeResult.feedback_reason).toBe('Nem válaszolt a kérdésre');

    const clearResult = updatePayload(null, null);
    expect(clearResult.is_helpful).toBeNull();
    expect(clearResult.feedback_reason).toBeNull();
    expect(clearResult.feedback_at).toBeNull();
  });
});
