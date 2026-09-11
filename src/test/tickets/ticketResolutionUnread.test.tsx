import { describe, it, expect } from 'vitest';

describe('Ticket Resolution Request Unread Calculation', () => {
  function computeHasUnread({
    userId,
    ticket,
    lastRead,
    latestOtherCommentAt,
  }: {
    userId: string;
    ticket: {
      created_by?: string | null;
      created_at: string;
      waiting_for_user_confirmation?: boolean;
      resolution_requested_by?: string | null;
      resolution_requested_at?: string | null;
    };
    lastRead: string | null;
    latestOtherCommentAt: string | null;
  }) {
    const isCreatedByOther = Boolean(ticket.created_by && ticket.created_by !== userId);
    const isConfirmationRequestedByOther = Boolean(
      ticket.waiting_for_user_confirmation &&
      ticket.resolution_requested_by &&
      ticket.resolution_requested_by !== userId
    );
    const confirmationRequestedAt = ticket.resolution_requested_at || null;

    let hasUnread = false;
    if (latestOtherCommentAt && (!lastRead || latestOtherCommentAt > lastRead)) {
      hasUnread = true;
    } else if (isCreatedByOther && (!lastRead || ticket.created_at > lastRead)) {
      hasUnread = true;
    } else if (
      isConfirmationRequestedByOther &&
      confirmationRequestedAt &&
      (!lastRead || confirmationRequestedAt > lastRead)
    ) {
      hasUnread = true;
    }

    return hasUnread;
  }

  it('marks ticket as unread when staff requests resolution confirmation and user has not read it yet', () => {
    const userId = 'user-reporter-1';
    const staffId = 'admin-staff-1';
    const reqTime = new Date('2026-09-11T05:30:00.000Z').toISOString();

    const hasUnread = computeHasUnread({
      userId,
      ticket: {
        created_by: userId,
        created_at: new Date('2026-09-10T10:00:00.000Z').toISOString(),
        waiting_for_user_confirmation: true,
        resolution_requested_by: staffId,
        resolution_requested_at: reqTime,
      },
      lastRead: null, // never read
      latestOtherCommentAt: null, // no comment was attached
    });

    expect(hasUnread).toBe(true);
  });

  it('marks ticket as unread when confirmation was requested after user last read the ticket', () => {
    const userId = 'user-reporter-1';
    const staffId = 'admin-staff-1';
    const lastRead = new Date('2026-09-11T05:00:00.000Z').toISOString();
    const reqTime = new Date('2026-09-11T05:30:00.000Z').toISOString();

    const hasUnread = computeHasUnread({
      userId,
      ticket: {
        created_by: userId,
        created_at: new Date('2026-09-10T10:00:00.000Z').toISOString(),
        waiting_for_user_confirmation: true,
        resolution_requested_by: staffId,
        resolution_requested_at: reqTime,
      },
      lastRead,
      latestOtherCommentAt: null,
    });

    expect(hasUnread).toBe(true);
  });

  it('clears unread status once user has read the ticket after confirmation request', () => {
    const userId = 'user-reporter-1';
    const staffId = 'admin-staff-1';
    const reqTime = new Date('2026-09-11T05:30:00.000Z').toISOString();
    const lastRead = new Date('2026-09-11T05:35:00.000Z').toISOString(); // read 5 min after request

    const hasUnread = computeHasUnread({
      userId,
      ticket: {
        created_by: userId,
        created_at: new Date('2026-09-10T10:00:00.000Z').toISOString(),
        waiting_for_user_confirmation: true,
        resolution_requested_by: staffId,
        resolution_requested_at: reqTime,
      },
      lastRead,
      latestOtherCommentAt: null,
    });

    expect(hasUnread).toBe(false);
  });

  it('does not mark ticket as unread for the staff member who requested confirmation', () => {
    const staffId = 'admin-staff-1';
    const reqTime = new Date('2026-09-11T05:30:00.000Z').toISOString();

    const hasUnread = computeHasUnread({
      userId: staffId, // staff viewing own request
      ticket: {
        created_by: 'user-reporter-1',
        created_at: new Date('2026-09-10T10:00:00.000Z').toISOString(),
        waiting_for_user_confirmation: true,
        resolution_requested_by: staffId,
        resolution_requested_at: reqTime,
      },
      lastRead: new Date('2026-09-11T05:00:00.000Z').toISOString(),
      latestOtherCommentAt: null,
    });

    expect(hasUnread).toBe(false);
  });
});
