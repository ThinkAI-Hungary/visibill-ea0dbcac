/**
 * nav-auto-sync → worker hand-off planning (A-193 follow-up).
 *
 * Pure, dependency-free module (importable from Deno and Vitest).
 *
 * Decides whether a `nav_item_jobs` PGMQ message must be enqueued for a company after
 * the header-only dawn sync, and whether the worker should chain
 * `auto-categorize-invoices` AFTER the line items were fetched.
 *
 * Why the worker chains categorization instead of nav-auto-sync calling it inline:
 *   - the inline call ran outside the 100 s time budget (p50 27 s, max 58 s) → 504s;
 *   - since A-193 the dawn sync is header-only, so an inline call categorized new
 *     NAV invoices WITHOUT line-item descriptions (lower AI accuracy).
 */

export const NAV_ITEM_QUEUE = 'nav_item_jobs' as const;

export interface NavItemJobPlanInput {
  companyId: string;
  userId: string;
  /** OUTBOUND + INBOUND newly inserted invoices in this run */
  totalNewInvoices: number;
  /** INBOUND invoices fetched (inserted or updated) in this run */
  inboundFetched: number;
  /** Line items were already fetched inline (fetchDetailedItems: true) */
  shouldFetchDetails: boolean;
  /** detailsOnly mode never triggered categorization (kept for parity) */
  detailsOnly: boolean;
  /** Injectable clock for deterministic tests */
  nowIso?: string;
}

export interface NavItemJobMessage {
  job_type: 'fetch_nav_items';
  company_id: string;
  user_id: string;
  auto_categorize: boolean;
  created_at: string;
}

export function planNavItemJob(input: NavItemJobPlanInput): NavItemJobMessage | null {
  const totalNew = Number.isFinite(input.totalNewInvoices) ? input.totalNewInvoices : 0;
  const inbound = Number.isFinite(input.inboundFetched) ? input.inboundFetched : 0;

  const needsItemFetch = totalNew > 0 && !input.shouldFetchDetails;
  const needsCategorize = inbound > 0 && !input.detailsOnly;

  if (!needsItemFetch && !needsCategorize) return null;

  return {
    job_type: 'fetch_nav_items',
    company_id: input.companyId,
    user_id: input.userId,
    auto_categorize: needsCategorize,
    created_at: input.nowIso ?? new Date().toISOString(),
  };
}
