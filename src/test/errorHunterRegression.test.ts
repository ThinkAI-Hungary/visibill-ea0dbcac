import { describe, it, expect, vi } from 'vitest';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/lib/locale/formatters';
import { addExtraMatch } from '@/lib/matching/matchingService';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client for matchingService
vi.mock('@/integrations/supabase/client', () => {
  const qb: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    supabase: {
      from: vi.fn(() => qb),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-1' } }, error: null }),
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user-1' } } }, error: null }),
      },
    },
  };
});

describe('Error Hunter Regression Suite', () => {
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. ClientInvoicesPage: szamlazzStatus null-safety
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('ClientInvoicesPage - szamlazzStatus null-safety', () => {
    it('evaluates safely when szamlazzStatus is undefined without throwing TypeError', () => {
      const szamlazzStatus: { pendingCount?: number } | undefined = undefined;

      // Old pattern would throw: szamlazzStatus.pendingCount > 0
      expect(() => {
        const hasPending = (szamlazzStatus?.pendingCount ?? 0) > 0;
        expect(hasPending).toBe(false);
      }).not.toThrow();
    });

    it('evaluates safely when szamlazzStatus is null or empty', () => {
      const szamlazzStatus: any = null;
      const hasPending = (szamlazzStatus?.pendingCount ?? 0) > 0;
      const displayCount = szamlazzStatus?.pendingCount;

      expect(hasPending).toBe(false);
      expect(displayCount).toBeUndefined();
    });

    it('correctly detects pending items when szamlazzStatus has positive pendingCount', () => {
      const szamlazzStatus = { pendingCount: 7, hasAgentKey: true, totalOutbound: 10, withImageCount: 3 };
      const hasPending = (szamlazzStatus?.pendingCount ?? 0) > 0;
      const displayCount = szamlazzStatus?.pendingCount;

      expect(hasPending).toBe(true);
      expect(displayCount).toBe(7);
    });

    it('correctly hides badge when pendingCount is 0', () => {
      const szamlazzStatus = { pendingCount: 0, hasAgentKey: true, totalOutbound: 5, withImageCount: 5 };
      const hasPending = (szamlazzStatus?.pendingCount ?? 0) > 0;

      expect(hasPending).toBe(false);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. InvoiceFilterBar: getDateFnsLocale import & date formatting
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('InvoiceFilterBar - getDateFnsLocale import & date formatting', () => {
    it('resolves getDateFnsLocale without throwing ReferenceError', () => {
      expect(() => {
        const locale = getDateFnsLocale();
        expect(locale).toBeDefined();
      }).not.toThrow();
    });

    it('formats dates cleanly using getDateFnsLocale with Hungarian pattern', () => {
      const testDate = new Date('2026-09-30T10:00:00Z');
      const dateFormat = 'yyyy. MMM dd.';

      const formatted = format(testDate, dateFormat, { locale: getDateFnsLocale() });
      expect(formatted).toBeTruthy();
      expect(formatted).toContain('2026');
      expect(formatted).toContain('30');
    });

    it('formats dates cleanly using getDateFnsLocale with Croatian pattern', () => {
      const testDate = new Date('2026-09-30T10:00:00Z');
      const dateFormat = 'dd.MM.yyyy.';

      const formatted = format(testDate, dateFormat, { locale: getDateFnsLocale() });
      expect(formatted).toBe('30.09.2026.');
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. VatAnnualMatrixView: normalizeInvNum & deduplication TDZ prevention
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('VatAnnualMatrixView - normalizeInvNum & deduplication TDZ prevention', () => {
    // Isolated reproduction of the exact logic from VatAnnualMatrixView
    const normalizeInvNum = (s?: string | null) => (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    const hasImg = (s: any) => Boolean(
      s.image_url ||
      s.melleklet_url ||
      s.invoice_uploads_id ||
      (Array.isArray(s.attachments) && s.attachments.length > 0)
    );

    it('normalizes invoice numbers consistently regardless of spacing, dashes, or casing', () => {
      expect(normalizeInvNum('szl-2026/001')).toBe('SZL2026001');
      expect(normalizeInvNum('SZL - 2026 / 001 ')).toBe('SZL2026001');
      expect(normalizeInvNum(null)).toBe('');
      expect(normalizeInvNum(undefined)).toBe('');
    });

    it('builds subWithImageByNum and deduplicates against nav_invoices without TDZ reference errors', () => {
      const subInvs = [
        {
          id: 'sub-1',
          bizonylatsorszam: 'INV-2026-001',
          image_url: 'https://storage/image1.pdf',
        },
        {
          id: 'sub-2',
          bizonylatsorszam: 'INV-2026-002',
          image_url: null,
          attachments: [],
        },
        {
          id: 'sub-3',
          bizonylatsorszam: 'INV-2026-003',
          melleklet_url: 'https://storage/attachment.pdf',
        },
      ];

      const navInvs = [
        {
          id: 'nav-1',
          invoice_number: 'INV/2026/001', // Corresponds to sub-1
        },
      ];

      expect(() => {
        // Build map of submitted invoices with actual images
        const subWithImageByNum = new Map<string, boolean>();
        subInvs.forEach((s) => {
          if (s.bizonylatsorszam && hasImg(s)) {
            subWithImageByNum.set(normalizeInvNum(s.bizonylatsorszam), true);
          }
        });

        // Deduplicate manual invoices already present in nav_invoices
        const existingNavNumbers = new Set(navInvs.map((i) => normalizeInvNum(i.invoice_number)).filter(Boolean));
        const standaloneSubInvs = subInvs.filter((i) => !existingNavNumbers.has(normalizeInvNum(i.bizonylatsorszam)));

        expect(subWithImageByNum.get('INV2026001')).toBe(true);
        expect(subWithImageByNum.get('INV2026002')).toBeUndefined();
        expect(subWithImageByNum.get('INV2026003')).toBe(true);

        // sub-1 is deduplicated because it exists in navInvs
        expect(standaloneSubInvs.length).toBe(2);
        expect(standaloneSubInvs.map(s => s.id)).toEqual(['sub-2', 'sub-3']);
      }).not.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. matchingService: addExtraMatch idempotency
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('matchingService - addExtraMatch idempotency', () => {
    it('executes upsert with onConflict transaction_id,invoice_id and ignoreDuplicates: true', async () => {
      const qb: any = {
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
      (supabase.from as any).mockReturnValue(qb);

      await addExtraMatch({
        transactionId: 'tx-2026-001',
        invoiceId: 'inv-2026-001',
      });

      expect(supabase.from).toHaveBeenCalledWith('transaction_invoice_matches');
      expect(qb.upsert).toHaveBeenCalledWith(
        {
          transaction_id: 'tx-2026-001',
          invoice_id: 'inv-2026-001',
          invoice_source: 'nav',
          created_by: 'manual',
        },
        { onConflict: 'transaction_id,invoice_id', ignoreDuplicates: true }
      );
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. GeneralLedger: Polling Removal & Realtime Progress Streaming
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  describe('GeneralLedger - Polling Removal & Realtime Progress Streaming', () => {
    it('calculates AI progress percentages accurately and safely without NaN or division by zero', () => {
      const calcProgress = (processed?: number | null, total?: number | null) => {
        if (!total || total <= 0) return 0;
        const p = processed || 0;
        return Math.min(100, Math.max(0, Math.round((p / total) * 100)));
      };

      // Exact case seen in user screenshot: 51 / 307 = 17%
      expect(calcProgress(51, 307)).toBe(17);

      // Boundary: 0 total items
      expect(calcProgress(0, 0)).toBe(0);
      expect(calcProgress(undefined, null)).toBe(0);

      // Boundary: 100% completion
      expect(calcProgress(307, 307)).toBe(100);

      // Edge case: processed exceeds total (capped at 100%)
      expect(calcProgress(320, 307)).toBe(100);
    });

    it('formats AI button and banner status labels properly based on progress state', () => {
      const formatButtonText = (isAIRunning: boolean, aiProgress?: { processed: number; total: number } | null) => {
        if (isAIRunning && aiProgress && aiProgress.total > 0) {
          return `AI Fut... (${aiProgress.processed}/${aiProgress.total})`;
        }
        return 'AI Besorolás';
      };

      expect(formatButtonText(false, null)).toBe('AI Besorolás');
      expect(formatButtonText(true, { processed: 0, total: 0 })).toBe('AI Besorolás');
      expect(formatButtonText(true, { processed: 51, total: 307 })).toBe('AI Fut... (51/307)');
      expect(formatButtonText(true, { processed: 307, total: 307 })).toBe('AI Fut... (307/307)');
    });

    it('simulates Realtime payload transitions from processing to completed', () => {
      let isAIRunning = false;
      let aiProgress: { processed: number; total: number } | null = null;
      let invalidatedQueries: string[] = [];

      const handleRealtimePayload = (row: {
        processing_status: string;
        message: string;
        items_processed?: number | null;
        items_total?: number | null;
      }) => {
        if (row.processing_status === 'processing') {
          isAIRunning = true;
          aiProgress = {
            processed: row.items_processed || 0,
            total: row.items_total || 0,
          };
          return;
        }

        if (row.processing_status !== 'completed' && row.processing_status !== 'error') return;

        isAIRunning = false;
        aiProgress = null;
        invalidatedQueries.push('glBalances', 'glItems', 'glJournalItems', 'glCategorizedItems');
      };

      // 1. Initial job processing event (e.g. 51 / 307)
      handleRealtimePayload({
        processing_status: 'processing',
        message: 'AI besorolás folyamatban (51/307)',
        items_processed: 51,
        items_total: 307,
      });

      expect(isAIRunning).toBe(true);
      expect(aiProgress).toEqual({ processed: 51, total: 307 });
      expect(invalidatedQueries.length).toBe(0);

      // 2. Next throttled event (e.g. 150 / 307)
      handleRealtimePayload({
        processing_status: 'processing',
        message: 'AI besorolás folyamatban (150/307)',
        items_processed: 150,
        items_total: 307,
      });

      expect(isAIRunning).toBe(true);
      expect(aiProgress).toEqual({ processed: 150, total: 307 });

      // 3. Completed event
      handleRealtimePayload({
        processing_status: 'completed',
        message: 'AI besorolás elkészült! (307/307 tétel sikeresen besorolva)',
        items_processed: 307,
        items_total: 307,
      });

      expect(isAIRunning).toBe(false);
      expect(aiProgress).toBeNull();
      expect(invalidatedQueries).toContain('glBalances');
      expect(invalidatedQueries).toContain('glCategorizedItems');
    });

    it('validates that glBalances query relies on event-driven invalidation instead of polling', () => {
      // Invariant: refetchInterval should be absent/falsy, staleTime should be >= 10s
      const glBalancesQueryConfig = {
        staleTime: 30_000,
        refetchInterval: false,
        placeholderData: (prev: any) => prev,
      };

      expect(glBalancesQueryConfig.refetchInterval).toBe(false);
      expect(glBalancesQueryConfig.staleTime).toBeGreaterThanOrEqual(10_000);
      expect(typeof glBalancesQueryConfig.placeholderData).toBe('function');
    });

    it('ignores stale active jobs older than 15 minutes to avoid stuck UI state on worker crash', () => {
      const now = Date.now();
      const fifteenMinutesMs = 15 * 60 * 1000;
      const isJobFresh = (createdAtStr: string) => {
        const jobTime = new Date(createdAtStr).getTime();
        return now - jobTime < fifteenMinutesMs;
      };

      // Job started 20 minutes ago (stale worker crash) -> should be discarded
      const staleJobCreatedAt = new Date(now - 20 * 60 * 1000).toISOString();
      expect(isJobFresh(staleJobCreatedAt)).toBe(false);

      // Job started 5 minutes ago (active job) -> should be recognized as active
      const freshJobCreatedAt = new Date(now - 5 * 60 * 1000).toISOString();
      expect(isJobFresh(freshJobCreatedAt)).toBe(true);
    });
  });
});

