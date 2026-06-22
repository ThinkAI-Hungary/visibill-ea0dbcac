import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateRequestEmail,
  getApprovalQueue,
  saveApprovalQueue,
  addToApprovalQueue,
  updateMessageStatus,
  updateMessageBody,
  type GenerateEmailParams,
  type OutgoingMessage,
} from '@/pages/Accounty/generateRequestEmail';

// ═══════════════════════════════════════════════════════════════
// generateRequestEmail tests
// ═══════════════════════════════════════════════════════════════

describe('generateRequestEmail', () => {
  const baseParams: GenerateEmailParams = {
    companyName: 'Test Kft.',
    missingItems: [
      { title: 'Számla #001', category: 'bejovo', deadline: '2024-03-15' },
      { title: 'Bankkivonat', category: 'bank' },
    ],
    portalLink: 'https://example.com/portal/abc123',
  };

  it('generates correct subject line with company name', () => {
    const result = generateRequestEmail(baseParams);
    expect(result.subject).toBe('Hiányzó dokumentumok bekérése – Test Kft.');
  });

  it('uses contactName in greeting when provided', () => {
    const result = generateRequestEmail({ ...baseParams, contactName: 'Kiss János' });
    expect(result.body).toContain('Kedves Kiss János!');
  });

  it('uses companyName in greeting when no contactName', () => {
    const result = generateRequestEmail(baseParams);
    expect(result.body).toContain('Tisztelt Test Kft.!');
  });

  it('includes all missing items in body', () => {
    const result = generateRequestEmail(baseParams);
    expect(result.body).toContain('Számla #001');
    expect(result.body).toContain('Bankkivonat');
  });

  it('includes category labels', () => {
    const result = generateRequestEmail(baseParams);
    expect(result.body).toContain('Bejövő számla');
    expect(result.body).toContain('Banki dokumentum');
  });

  it('includes deadline when provided', () => {
    const result = generateRequestEmail(baseParams);
    expect(result.body).toContain('Határidő: 2024-03-15');
  });

  it('omits deadline text when not provided', () => {
    const result = generateRequestEmail({
      ...baseParams,
      missingItems: [{ title: 'Test', category: 'bank' }],
    });
    expect(result.body).not.toContain('Határidő');
  });

  it('includes portal link', () => {
    const result = generateRequestEmail(baseParams);
    expect(result.body).toContain('https://example.com/portal/abc123');
  });

  it('uses default sender name "ThinkAI"', () => {
    const result = generateRequestEmail(baseParams);
    expect(result.body).toContain('ThinkAI');
  });

  it('uses custom sender name when provided', () => {
    const result = generateRequestEmail({ ...baseParams, senderName: 'Kovács Éva' });
    expect(result.body).toContain('Kovács Éva');
    expect(result.body).not.toContain('ThinkAI');
  });

  it('generates HTML preview with eaisybooks branding', () => {
    const result = generateRequestEmail(baseParams);
    expect(result.htmlPreview).toContain('eaisybooks');
  });

  it('generates HTML preview with upload button link', () => {
    const result = generateRequestEmail(baseParams);
    expect(result.htmlPreview).toContain('href="https://example.com/portal/abc123"');
  });

  it('generates HTML preview table with items', () => {
    const result = generateRequestEmail(baseParams);
    expect(result.htmlPreview).toContain('Számla #001');
    expect(result.htmlPreview).toContain('Bankkivonat');
  });

  it('handles item count text correctly for single item', () => {
    const result = generateRequestEmail({
      ...baseParams,
      missingItems: [{ title: 'Egyetlen', category: 'kimeno' }],
    });
    expect(result.body).toContain('dokumentum');
    // Should NOT have "1 dokumentum" — just "dokumentum"
  });

  it('handles item count text correctly for multiple items', () => {
    const result = generateRequestEmail(baseParams);
    expect(result.body).toContain('2 dokumentum');
  });

  it('handles unknown category gracefully', () => {
    const result = generateRequestEmail({
      ...baseParams,
      missingItems: [{ title: 'Unknown', category: 'unknown_cat' }],
    });
    // Should fall back to the raw category value
    expect(result.body).toContain('unknown_cat');
  });

  it('handles empty missingItems array', () => {
    const result = generateRequestEmail({
      ...baseParams,
      missingItems: [],
    });
    expect(result.subject).toBe('Hiányzó dokumentumok bekérése – Test Kft.');
    expect(result.body).toBeDefined();
  });

  it('handles Hungarian special characters in company name', () => {
    const result = generateRequestEmail({
      ...baseParams,
      companyName: 'Öröm és Bánat Bt.',
    });
    expect(result.subject).toContain('Öröm és Bánat Bt.');
    expect(result.body).toContain('Öröm és Bánat Bt.');
  });
});

// ═══════════════════════════════════════════════════════════════
// Approval Queue localStorage tests
// ═══════════════════════════════════════════════════════════════

function createMockMessage(overrides: Partial<OutgoingMessage> = {}): OutgoingMessage {
  return {
    id: 'msg-1',
    companyId: 'company-1',
    companyName: 'Test Kft.',
    contactEmail: 'test@example.com',
    channel: 'email',
    category: 'normal',
    subject: 'Test Subject',
    originalContext: 'Test context',
    aiGeneratedBody: 'Test body content',
    htmlPreview: '<div>Preview</div>',
    portalLink: 'https://example.com/portal/test',
    status: 'pending',
    createdAt: '2024-01-01T00:00:00.000Z',
    missingItemIds: ['item-1', 'item-2'],
    ...overrides,
  };
}

describe('Approval Queue localStorage operations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getApprovalQueue', () => {
    it('returns empty array when localStorage is empty', () => {
      expect(getApprovalQueue()).toEqual([]);
    });

    it('returns empty array when localStorage has invalid JSON', () => {
      localStorage.setItem('accounty_approval_queue', 'invalid json');
      expect(getApprovalQueue()).toEqual([]);
    });

    it('returns parsed messages from localStorage', () => {
      const messages = [createMockMessage()];
      localStorage.setItem('accounty_approval_queue', JSON.stringify(messages));
      const result = getApprovalQueue();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg-1');
    });
  });

  describe('saveApprovalQueue', () => {
    it('saves messages to localStorage', () => {
      const messages = [createMockMessage(), createMockMessage({ id: 'msg-2' })];
      saveApprovalQueue(messages);
      const stored = JSON.parse(localStorage.getItem('accounty_approval_queue')!);
      expect(stored).toHaveLength(2);
    });

    it('overwrites existing data', () => {
      saveApprovalQueue([createMockMessage()]);
      saveApprovalQueue([createMockMessage({ id: 'msg-new' })]);
      const stored = JSON.parse(localStorage.getItem('accounty_approval_queue')!);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe('msg-new');
    });
  });

  describe('addToApprovalQueue', () => {
    it('adds message to the beginning of the queue', () => {
      const first = createMockMessage({ id: 'first' });
      const second = createMockMessage({ id: 'second' });
      addToApprovalQueue(first);
      addToApprovalQueue(second);
      const queue = getApprovalQueue();
      expect(queue).toHaveLength(2);
      expect(queue[0].id).toBe('second'); // most recent first
      expect(queue[1].id).toBe('first');
    });

    it('works when queue is initially empty', () => {
      addToApprovalQueue(createMockMessage());
      expect(getApprovalQueue()).toHaveLength(1);
    });
  });

  describe('updateMessageStatus', () => {
    beforeEach(() => {
      saveApprovalQueue([
        createMockMessage({ id: 'msg-1' }),
        createMockMessage({ id: 'msg-2' }),
      ]);
    });

    it('updates status of an existing message', () => {
      updateMessageStatus('msg-1', 'approved');
      const queue = getApprovalQueue();
      expect(queue[0].status).toBe('approved');
      expect(queue[0].approvedAt).toBeDefined();
    });

    it('sets approvedAt timestamp when status is approved', () => {
      const before = new Date().toISOString();
      updateMessageStatus('msg-1', 'approved');
      const msg = getApprovalQueue().find(m => m.id === 'msg-1')!;
      expect(msg.approvedAt).toBeDefined();
      expect(new Date(msg.approvedAt!).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
    });

    it('sets rejectedAt timestamp when status is rejected', () => {
      updateMessageStatus('msg-1', 'rejected');
      const msg = getApprovalQueue().find(m => m.id === 'msg-1')!;
      expect(msg.rejectedAt).toBeDefined();
    });

    it('sets sentAt timestamp when status is sent', () => {
      updateMessageStatus('msg-1', 'sent');
      const msg = getApprovalQueue().find(m => m.id === 'msg-1')!;
      expect(msg.sentAt).toBeDefined();
    });

    it('does nothing when message ID is not found', () => {
      updateMessageStatus('nonexistent', 'approved');
      const queue = getApprovalQueue();
      expect(queue.every(m => m.status === 'pending')).toBe(true);
    });

    it('preserves other messages when updating one', () => {
      updateMessageStatus('msg-1', 'approved');
      const queue = getApprovalQueue();
      expect(queue.find(m => m.id === 'msg-2')!.status).toBe('pending');
    });

    it('applies extra fields when provided', () => {
      updateMessageStatus('msg-1', 'approved', { subject: 'Updated Subject' });
      const msg = getApprovalQueue().find(m => m.id === 'msg-1')!;
      expect(msg.subject).toBe('Updated Subject');
      expect(msg.status).toBe('approved');
    });
  });

  describe('updateMessageBody', () => {
    beforeEach(() => {
      saveApprovalQueue([createMockMessage({ id: 'msg-1', aiGeneratedBody: 'Original body' })]);
    });

    it('updates the AI generated body text', () => {
      updateMessageBody('msg-1', 'Updated body content');
      const msg = getApprovalQueue().find(m => m.id === 'msg-1')!;
      expect(msg.aiGeneratedBody).toBe('Updated body content');
    });

    it('does nothing when message ID is not found', () => {
      updateMessageBody('nonexistent', 'New content');
      const msg = getApprovalQueue().find(m => m.id === 'msg-1')!;
      expect(msg.aiGeneratedBody).toBe('Original body');
    });
  });
});
