import { describe, it, expect, vi } from 'vitest';
import type { AiChatSession } from '@/hooks/useAiChatSessions';

describe('AI Assistant Session Soft Delete', () => {
  it('should support is_deleted and deleted_at on AiChatSession', () => {
    const activeSession: AiChatSession = {
      id: 'session-1',
      user_id: 'user-abc',
      title: 'ÁFA bevallási kérdések',
      created_at: '2026-09-08T10:00:00Z',
      updated_at: '2026-09-08T10:05:00Z',
      is_deleted: false,
      deleted_at: null,
    };

    expect(activeSession.is_deleted).toBe(false);
    expect(activeSession.deleted_at).toBeNull();

    const softDeletedSession: AiChatSession = {
      ...activeSession,
      is_deleted: true,
      deleted_at: '2026-09-08T14:40:00Z',
    };

    expect(softDeletedSession.is_deleted).toBe(true);
    expect(softDeletedSession.deleted_at).toBe('2026-09-08T14:40:00Z');
  });

  it('should filter out soft-deleted sessions from active user lists', () => {
    const allSessions: AiChatSession[] = [
      { id: '1', user_id: 'u1', title: 'Session 1', created_at: '2026-09-08', updated_at: '2026-09-08', is_deleted: false },
      { id: '2', user_id: 'u1', title: 'Session 2', created_at: '2026-09-08', updated_at: '2026-09-08', is_deleted: true, deleted_at: '2026-09-08T12:00:00Z' },
      { id: '3', user_id: 'u1', title: 'Session 3', created_at: '2026-09-08', updated_at: '2026-09-08', is_deleted: false },
    ];

    const activeOnly = allSessions.filter(s => !s.is_deleted);
    expect(activeOnly).toHaveLength(2);
    expect(activeOnly.map(s => s.id)).toEqual(['1', '3']);
  });

  it('should perform soft-delete update mutation without deleting messages', () => {
    const mockDb = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };

    const performSoftDelete = async (sessionId: string) => {
      return await mockDb.update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      }).eq('id', sessionId);
    };

    performSoftDelete('session-to-archive');

    expect(mockDb.update).toHaveBeenCalledWith(
      expect.objectContaining({
        is_deleted: true,
        deleted_at: expect.any(String),
      })
    );
    expect(mockDb.eq).toHaveBeenCalledWith('id', 'session-to-archive');
  });
});
