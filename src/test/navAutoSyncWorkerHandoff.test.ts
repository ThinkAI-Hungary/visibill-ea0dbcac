import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { planNavItemJob, NAV_ITEM_QUEUE } from '../../supabase/functions/nav-auto-sync/navItemJobPlanner';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// nav-auto-sync → worker hand-off (A-193 follow-up)
// Auto-categorization moved out of the synchronous nav-auto-sync tail into the
// worker's nav_item_jobs consumer (runs AFTER line items are fetched).
// Worker side is covered by worker/test/unit_test/test_nav_item_processor.py.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const NOW = '2026-10-04T01:00:00.000Z';
const base = {
  companyId: 'c-1',
  userId: 'u-1',
  totalNewInvoices: 0,
  inboundFetched: 0,
  shouldFetchDetails: false,
  detailsOnly: false,
  nowIso: NOW,
};

describe('planNavItemJob', () => {
  it('returns null when nothing new was fetched', () => {
    expect(planNavItemJob(base)).toBeNull();
  });

  it('enqueues item fetch without categorization for outbound-only new invoices', () => {
    expect(planNavItemJob({ ...base, totalNewInvoices: 3, inboundFetched: 0 })).toEqual({
      job_type: 'fetch_nav_items',
      company_id: 'c-1',
      user_id: 'u-1',
      auto_categorize: false,
      created_at: NOW,
    });
  });

  it('enqueues item fetch + categorization for new inbound invoices', () => {
    expect(planNavItemJob({ ...base, totalNewInvoices: 2, inboundFetched: 2 })).toMatchObject({
      auto_categorize: true,
    });
  });

  it('still enqueues (for categorization) when inbound invoices were only updated, not inserted', () => {
    // Preserves the old behaviour: categorization ran whenever inboundFetched > 0
    expect(planNavItemJob({ ...base, totalNewInvoices: 0, inboundFetched: 5 })).toMatchObject({
      job_type: 'fetch_nav_items',
      auto_categorize: true,
    });
  });

  it('enqueues categorization-only job when details were fetched inline', () => {
    expect(planNavItemJob({ ...base, totalNewInvoices: 4, inboundFetched: 4, shouldFetchDetails: true })).toMatchObject({
      auto_categorize: true,
    });
    expect(planNavItemJob({ ...base, totalNewInvoices: 4, inboundFetched: 0, shouldFetchDetails: true })).toBeNull();
  });

  it('never requests categorization in detailsOnly mode (parity with the old inline call)', () => {
    expect(planNavItemJob({ ...base, detailsOnly: true, totalNewInvoices: 0, inboundFetched: 7 })).toBeNull();
    expect(planNavItemJob({ ...base, detailsOnly: true, totalNewInvoices: 2, inboundFetched: 2 })).toMatchObject({
      auto_categorize: false,
    });
  });

  it('treats non-finite counters as zero (defensive against undefined/NaN results)', () => {
    expect(planNavItemJob({ ...base, totalNewInvoices: Number.NaN, inboundFetched: Number.NaN })).toBeNull();
  });

  it('targets the nav_item_jobs queue consumed by the worker', () => {
    expect(NAV_ITEM_QUEUE).toBe('nav_item_jobs');
  });
});

describe('nav-auto-sync/index.ts contract', () => {
  const src = readFileSync(
    join(process.cwd(), 'supabase', 'functions', 'nav-auto-sync', 'index.ts'),
    'utf8',
  );

  it('no longer calls auto-categorize-invoices synchronously (504 tail removed)', () => {
    expect(src).not.toMatch(/functions\/v1\/auto-categorize-invoices/);
    expect(src).not.toMatch(/companiesToCategorize/);
  });

  it('plans the hand-off via planNavItemJob and enqueues to NAV_ITEM_QUEUE', () => {
    expect(src).toMatch(/import\s*\{[^}]*planNavItemJob[^}]*\}\s*from\s*'\.\/navItemJobPlanner\.ts'/);
    expect(src).toMatch(/planNavItemJob\(\s*\{/);
    expect(src).toMatch(/queue_name:\s*NAV_ITEM_QUEUE/);
  });

  it('checks the PostgREST error of pgmq_send_retry (supabase-js does not throw)', () => {
    expect(src).toMatch(/const\s*\{\s*error:\s*enqueueError\s*\}\s*=\s*await\s+supabase\.rpc\('pgmq_send_retry'/);
    expect(src).toMatch(/if\s*\(\s*enqueueError\s*\)/);
  });

  it('keeps the CRON_SECRET guard', () => {
    expect(src).toMatch(/req\.headers\.get\('x-cron-secret'\)/);
    expect(src).toMatch(/status:\s*403/);
  });
});
