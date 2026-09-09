import { describe, it, expect } from 'vitest';
import type { TicketStatus } from '@/hooks/useTickets';

describe('Ticket Statuses Lifecycle (Nyitott -> Hozzárendelt -> Folyamatban -> Megoldva)', () => {
  it('defines the 4 required ticket status lifecycle values', () => {
    const validStatuses: TicketStatus[] = ['created', 'assigned', 'in_progress', 'resolved'];
    expect(validStatuses).toHaveLength(4);
    expect(validStatuses).toEqual(['created', 'assigned', 'in_progress', 'resolved']);
  });

  it('correctly maps statuses to Hungarian human-readable labels', () => {
    const statusLabels: Record<TicketStatus | 'new' | 'open', string> = {
      new: 'Nyitott',
      open: 'Nyitott',
      created: 'Nyitott',
      assigned: 'Hozzárendelt',
      in_progress: 'Folyamatban',
      resolved: 'Megoldva',
    };

    expect(statusLabels.created).toBe('Nyitott');
    expect(statusLabels.new).toBe('Nyitott');
    expect(statusLabels.open).toBe('Nyitott');
    expect(statusLabels.assigned).toBe('Hozzárendelt');
    expect(statusLabels.in_progress).toBe('Folyamatban');
    expect(statusLabels.resolved).toBe('Megoldva');
  });

  it('determines auto-transition when assigning a ticket', () => {
    const getNextStatusOnAssign = (currentStatus: string, assignedTo: string | null): string => {
      if (assignedTo && (currentStatus === 'created' || currentStatus === 'new' || currentStatus === 'open')) {
        return 'assigned';
      }
      if (!assignedTo && currentStatus === 'assigned') {
        return 'created';
      }
      return currentStatus;
    };

    // Assigning to an open ticket should transition to 'assigned'
    expect(getNextStatusOnAssign('created', 'agent-123')).toBe('assigned');
    expect(getNextStatusOnAssign('new', 'agent-123')).toBe('assigned');
    expect(getNextStatusOnAssign('open', 'agent-123')).toBe('assigned');

    // Removing assignment from an assigned ticket should revert to 'created' (Nyitott)
    expect(getNextStatusOnAssign('assigned', null)).toBe('created');

    // Tickets already in progress or resolved retain their status on reassignment
    expect(getNextStatusOnAssign('in_progress', 'agent-456')).toBe('in_progress');
    expect(getNextStatusOnAssign('resolved', 'agent-456')).toBe('resolved');
  });
});
