/**
 * Visibill Ticket SLA & 48-Hour Inactivity Calculation Utilities
 * 
 * Rules:
 * 1. An active ticket (status != 'resolved' and waiting_for_user_confirmation != true)
 *    is considered awaiting response if the last non-internal message was sent by a customer.
 * 2. If no admin comment exists yet:
 *    - For customer-created tickets: wait time starts at ticket created_at.
 *    - For staff-initiated tickets: wait time starts at customer's first comment (if any).
 * 3. If an admin commented, but customer commented afterwards: wait time starts at customer's latest comment.
 * 4. Internal notes (is_internal = true) NEVER count as a customer-facing response.
 * 5. Tickets with assigned_to != null target the assignee; tickets without assigned_to target the team.
 */

export interface TicketSlaInputTicket {
  created_at: string;
  status: string;
  waiting_for_user_confirmation?: boolean | null;
  created_by_is_staff?: boolean | null;
  assigned_to?: string | null;
  needs_staff_response?: boolean | null;
}

export interface TicketSlaInputComment {
  created_at?: string | null;
  is_admin?: boolean | null;
  is_internal?: boolean | null;
}

export interface TicketSlaInfo {
  isOverdue48h: boolean;
  hoursWaiting: number;
  lastCustomerMessageAt: string | null;
  targetParty: 'assignee' | 'team' | 'none';
  severity: 'normal' | 'warning_24h' | 'breached_48h';
  formattedWaitTime: string;
}

const MS_PER_HOUR = 1000 * 60 * 60;

/**
 * Computes the SLA status of a ticket relative to a reference time (defaults to now).
 */
export function computeTicketSla(
  ticket: TicketSlaInputTicket,
  comments: TicketSlaInputComment[] = [],
  referenceDate: Date = new Date()
): TicketSlaInfo {
  // Resolved tickets, tickets waiting for user confirmation, or marked as not needing staff response have no pending staff SLA
  if (
    ticket.status === 'resolved' ||
    ticket.waiting_for_user_confirmation === true ||
    ticket.needs_staff_response === false
  ) {
    return {
      isOverdue48h: false,
      hoursWaiting: 0,
      lastCustomerMessageAt: null,
      targetParty: 'none',
      severity: 'normal',
      formattedWaitTime: '0ó',
    };
  }

  // Filter out internal notes as they are invisible to customers and don't reset customer wait time
  const publicComments = (comments || []).filter(c => !c.is_internal && c.created_at);

  // Sort chronological
  const sortedComments = [...publicComments].sort(
    (a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime()
  );

  let lastCustomerTime: string | null = null;
  let lastStaffTime: string | null = null;

  // Initial message: was it created by customer or staff?
  if (!ticket.created_by_is_staff) {
    lastCustomerTime = ticket.created_at;
  } else {
    lastStaffTime = ticket.created_at;
  }

  // Iterate over comments in chronological order
  for (const c of sortedComments) {
    if (c.is_admin) {
      lastStaffTime = c.created_at!;
    } else {
      lastCustomerTime = c.created_at!;
    }
  }

  // If there has been no customer message ever (e.g. staff-initiated ticket and customer hasn't replied yet)
  if (!lastCustomerTime) {
    return {
      isOverdue48h: false,
      hoursWaiting: 0,
      lastCustomerMessageAt: null,
      targetParty: 'none',
      severity: 'normal',
      formattedWaitTime: '0ó',
    };
  }

  // Check if staff responded AFTER the last customer message
  const customerTimestamp = new Date(lastCustomerTime).getTime();
  const staffTimestamp = lastStaffTime ? new Date(lastStaffTime).getTime() : 0;

  if (staffTimestamp > customerTimestamp) {
    // Staff has responded, ball is not in staff court
    return {
      isOverdue48h: false,
      hoursWaiting: 0,
      lastCustomerMessageAt: lastCustomerTime,
      targetParty: 'none',
      severity: 'normal',
      formattedWaitTime: '0ó',
    };
  }

  // Staff has NOT responded since customer message
  const refTime = referenceDate.getTime();
  const diffMs = Math.max(0, refTime - customerTimestamp);
  const hoursWaiting = Math.floor(diffMs / MS_PER_HOUR);

  const isOverdue48h = hoursWaiting >= 48;
  const targetParty: 'assignee' | 'team' = ticket.assigned_to ? 'assignee' : 'team';

  let severity: 'normal' | 'warning_24h' | 'breached_48h' = 'normal';
  if (hoursWaiting >= 48) {
    severity = 'breached_48h';
  } else if (hoursWaiting >= 24) {
    severity = 'warning_24h';
  }

  // Human-readable format
  let formattedWaitTime = `${hoursWaiting}ó`;
  if (hoursWaiting >= 72) {
    const days = Math.floor(hoursWaiting / 24);
    formattedWaitTime = `${days} nap`;
  }

  return {
    isOverdue48h,
    hoursWaiting,
    lastCustomerMessageAt: lastCustomerTime,
    targetParty,
    severity,
    formattedWaitTime,
  };
}
