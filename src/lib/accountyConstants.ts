/**
 * Centralized constants for eaisybooks (Accounty) module.
 * Eliminates magic strings across hooks, pages, and components.
 */

// ── Client Status ──────────────────────────────────────────

export const CLIENT_STATUS = {
  OK: 'Rendben',
  PROCESSING: 'Feldolgozandó',
  CRITICAL: 'Kritikus',
} as const;

export type ClientStatus = (typeof CLIENT_STATUS)[keyof typeof CLIENT_STATUS];

export const CLIENT_STATUS_LIST: ClientStatus[] = [
  CLIENT_STATUS.OK,
  CLIENT_STATUS.PROCESSING,
  CLIENT_STATUS.CRITICAL,
];

// ── Accounty Roles ─────────────────────────────────────────

export const ACCOUNTY_ROLE = {
  ADMIN: 'iroda_admin',
  SENIOR: 'senior_könyvelő',
  JUNIOR: 'könyvelő',
} as const;

export type AccountyRole = (typeof ACCOUNTY_ROLE)[keyof typeof ACCOUNTY_ROLE];

export const ADMIN_ROLES: AccountyRole[] = [ACCOUNTY_ROLE.ADMIN];
export const SENIOR_ROLES: AccountyRole[] = [ACCOUNTY_ROLE.ADMIN, ACCOUNTY_ROLE.SENIOR];

// ── Missing Item Status ────────────────────────────────────

export const MISSING_ITEM_STATUS = {
  OPEN: 'open',
  NOTIFIED: 'notified',
  RESOLVED: 'resolved',
  IGNORED: 'ignored',
} as const;

export type MissingItemStatus = (typeof MISSING_ITEM_STATUS)[keyof typeof MISSING_ITEM_STATUS];

/** Active (actionable) missing item statuses */
export const ACTIVE_MISSING_STATUSES: MissingItemStatus[] = [
  MISSING_ITEM_STATUS.OPEN,
  MISSING_ITEM_STATUS.NOTIFIED,
];

// ── Missing Item Priority ──────────────────────────────────

export const MISSING_ITEM_PRIORITY = {
  URGENT: 'urgent',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;

export type MissingItemPriority = (typeof MISSING_ITEM_PRIORITY)[keyof typeof MISSING_ITEM_PRIORITY];

// ── Missing Item Category ──────────────────────────────────

export const MISSING_ITEM_CATEGORY = {
  INCOMING: 'bejovo',
  OUTGOING: 'kimeno',
  BANK: 'bank',
  SALARY: 'ber',
} as const;

export type MissingItemCategory = (typeof MISSING_ITEM_CATEGORY)[keyof typeof MISSING_ITEM_CATEGORY];

// ── Deadline Status ────────────────────────────────────────

export const DEADLINE_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
} as const;

export type DeadlineStatus = (typeof DEADLINE_STATUS)[keyof typeof DEADLINE_STATUS];

export const ACTIVE_DEADLINE_STATUSES: DeadlineStatus[] = [
  DEADLINE_STATUS.PENDING,
  DEADLINE_STATUS.IN_PROGRESS,
];

// ── SANDBOX Filter ─────────────────────────────────────────

/** Filter predicate to exclude SANDBOX companies */
export const isNonSandbox = <T extends { name: string }>(company: T): boolean =>
  company.name !== 'SANDBOX';

/** The SANDBOX company name constant */
export const SANDBOX_COMPANY_NAME = 'SANDBOX';

// ── View Modes ─────────────────────────────────────────────

export const VIEW_MODE = {
  GRID: 'grid',
  LIST: 'list',
  KANBAN: 'kanban',
} as const;

export type ViewMode = (typeof VIEW_MODE)[keyof typeof VIEW_MODE];
