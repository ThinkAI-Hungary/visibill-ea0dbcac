import { describe, it, expect } from 'vitest';
import { computeTicketSla, type TicketSlaInputTicket, type TicketSlaInputComment } from '@/utils/ticketSlaUtils';

describe('ticketSlaUtils: computeTicketSla', () => {
  const baseNow = new Date('2026-09-21T12:00:00.000Z');

  it('marks customer ticket with no response after 50 hours as breached_48h and assigned to assignee', () => {
    const ticket: TicketSlaInputTicket = {
      created_at: '2026-09-19T10:00:00.000Z', // 50 hours ago
      status: 'assigned',
      assigned_to: 'agent-123',
    };

    const sla = computeTicketSla(ticket, [], baseNow);
    expect(sla.isOverdue48h).toBe(true);
    expect(sla.hoursWaiting).toBe(50);
    expect(sla.targetParty).toBe('assignee');
    expect(sla.severity).toBe('breached_48h');
    expect(sla.formattedWaitTime).toBe('50ó');
  });

  it('marks customer ticket with no response after 50 hours and NO assignee as team targetParty', () => {
    const ticket: TicketSlaInputTicket = {
      created_at: '2026-09-19T10:00:00.000Z', // 50 hours ago
      status: 'created',
      assigned_to: null,
    };

    const sla = computeTicketSla(ticket, [], baseNow);
    expect(sla.isOverdue48h).toBe(true);
    expect(sla.hoursWaiting).toBe(50);
    expect(sla.targetParty).toBe('team');
    expect(sla.severity).toBe('breached_48h');
  });

  it('does NOT mark ticket overdue if admin has replied after customer message', () => {
    const ticket: TicketSlaInputTicket = {
      created_at: '2026-09-18T10:00:00.000Z', // 74 hours ago
      status: 'in_progress',
      assigned_to: 'agent-123',
    };

    const comments: TicketSlaInputComment[] = [
      {
        created_at: '2026-09-21T08:00:00.000Z', // 4 hours ago by admin
        is_admin: true,
        is_internal: false,
      },
    ];

    const sla = computeTicketSla(ticket, comments, baseNow);
    expect(sla.isOverdue48h).toBe(false);
    expect(sla.hoursWaiting).toBe(0);
    expect(sla.targetParty).toBe('none');
    expect(sla.severity).toBe('normal');
  });

  it('marks ticket overdue if customer replied again after admin response and 49 hours elapsed', () => {
    const ticket: TicketSlaInputTicket = {
      created_at: '2026-09-17T10:00:00.000Z',
      status: 'in_progress',
      assigned_to: 'agent-123',
    };

    const comments: TicketSlaInputComment[] = [
      {
        created_at: '2026-09-18T12:00:00.000Z', // admin replied
        is_admin: true,
        is_internal: false,
      },
      {
        created_at: '2026-09-19T11:00:00.000Z', // customer replied 49h ago
        is_admin: false,
        is_internal: false,
      },
    ];

    const sla = computeTicketSla(ticket, comments, baseNow);
    expect(sla.isOverdue48h).toBe(true);
    expect(sla.hoursWaiting).toBe(49);
    expect(sla.targetParty).toBe('assignee');
    expect(sla.severity).toBe('breached_48h');
  });

  it('ignores internal notes (is_internal = true) when determining staff response', () => {
    const ticket: TicketSlaInputTicket = {
      created_at: '2026-09-19T08:00:00.000Z', // 52 hours ago
      status: 'in_progress',
      assigned_to: 'agent-123',
    };

    const comments: TicketSlaInputComment[] = [
      {
        created_at: '2026-09-21T10:00:00.000Z', // internal note 2h ago
        is_admin: true,
        is_internal: true,
      },
    ];

    const sla = computeTicketSla(ticket, comments, baseNow);
    expect(sla.isOverdue48h).toBe(true);
    expect(sla.hoursWaiting).toBe(52);
    expect(sla.targetParty).toBe('assignee');
    expect(sla.severity).toBe('breached_48h');
  });

  it('never marks resolved tickets or tickets waiting for user confirmation as overdue', () => {
    const resolvedTicket: TicketSlaInputTicket = {
      created_at: '2026-09-01T10:00:00.000Z',
      status: 'resolved',
      assigned_to: 'agent-123',
    };

    const waitingConfirmationTicket: TicketSlaInputTicket = {
      created_at: '2026-09-01T10:00:00.000Z',
      status: 'in_progress',
      waiting_for_user_confirmation: true,
      assigned_to: 'agent-123',
    };

    expect(computeTicketSla(resolvedTicket, [], baseNow).isOverdue48h).toBe(false);
    expect(computeTicketSla(resolvedTicket, [], baseNow).targetParty).toBe('none');

    expect(computeTicketSla(waitingConfirmationTicket, [], baseNow).isOverdue48h).toBe(false);
    expect(computeTicketSla(waitingConfirmationTicket, [], baseNow).targetParty).toBe('none');
  });

  it('marks ticket with 30 hours wait as warning_24h severity', () => {
    const ticket: TicketSlaInputTicket = {
      created_at: '2026-09-20T06:00:00.000Z', // 30 hours ago
      status: 'in_progress',
      assigned_to: 'agent-123',
    };

    const sla = computeTicketSla(ticket, [], baseNow);
    expect(sla.isOverdue48h).toBe(false);
    expect(sla.hoursWaiting).toBe(30);
    expect(sla.severity).toBe('warning_24h');
    expect(sla.targetParty).toBe('assignee');
  });

  it('formats wait time as days when wait time is >= 72 hours', () => {
    const ticket: TicketSlaInputTicket = {
      created_at: '2026-09-17T12:00:00.000Z', // 4 days ago (96 hours)
      status: 'assigned',
      assigned_to: 'agent-123',
    };

    const sla = computeTicketSla(ticket, [], baseNow);
    expect(sla.isOverdue48h).toBe(true);
    expect(sla.hoursWaiting).toBe(96);
    expect(sla.formattedWaitTime).toBe('4 nap');
  });

  it('never marks ticket overdue if needs_staff_response is explicitly false (e.g. client only wrote "köszi")', () => {
    const ticket: TicketSlaInputTicket = {
      created_at: '2026-09-17T12:00:00.000Z', // 4 days ago
      status: 'assigned',
      assigned_to: 'agent-123',
      needs_staff_response: false,
    };

    const sla = computeTicketSla(ticket, [], baseNow);
    expect(sla.isOverdue48h).toBe(false);
    expect(sla.hoursWaiting).toBe(0);
    expect(sla.severity).toBe('normal');
    expect(sla.targetParty).toBe('none');
  });
});
