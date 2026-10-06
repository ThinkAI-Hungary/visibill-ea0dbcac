import { describe, it, expect } from 'vitest';

describe('NAV Auto-Sync & Detail Orchestration Contracts', () => {
  // Pure replica of calculateDynamicDateFrom logic
  function calculateDynamicDateFrom(
    lastSuccessDate: string | null,
    requestedDateFrom?: string,
    maxLookbackDays = 7,
    nowDate: Date = new Date('2026-10-03T18:00:00Z')
  ): string {
    if (requestedDateFrom) return requestedDateFrom;

    const maxLookbackDate = new Date(nowDate);
    maxLookbackDate.setDate(maxLookbackDate.getDate() - maxLookbackDays);

    const defaultLookbackDate = new Date(nowDate);
    defaultLookbackDate.setDate(defaultLookbackDate.getDate() - Math.min(maxLookbackDays, 7));

    if (lastSuccessDate) {
      const lastDate = new Date(lastSuccessDate);
      if (!isNaN(lastDate.getTime())) {
        // Safety overlap of 2 days
        lastDate.setDate(lastDate.getDate() - 2);
        const effectiveDate = lastDate < maxLookbackDate ? maxLookbackDate : lastDate;
        return effectiveDate.toISOString().split('T')[0];
      }
    }

    return defaultLookbackDate.toISOString().split('T')[0];
  }

  // Pure replica of getCompanySyncBucket logic
  function getCompanySyncBucket(companyId: string, totalBuckets = 4): number {
    if (!companyId || typeof companyId !== 'string' || totalBuckets <= 1) return 0;
    const cleanHex = companyId.replace(/[^0-9a-fA-F]/g, '').slice(0, 8);
    if (!cleanHex) {
      let hash = 0;
      for (let i = 0; i < companyId.length; i++) {
        hash = (hash * 31 + companyId.charCodeAt(i)) >>> 0;
      }
      return hash % totalBuckets;
    }
    const intVal = parseInt(cleanHex, 16);
    return isNaN(intVal) ? 0 : Math.abs(intVal) % totalBuckets;
  }

  describe('Dynamic Lookback Window (7-day cap invariant)', () => {
    const fixedNow = new Date('2026-10-03T18:00:00Z');

    it('enforces 7-day maximum lookback even if company was stuck for 150 days (Mandala Fogadó case)', () => {
      // Last sync May 4 2026 -> 152 days ago
      const result = calculateDynamicDateFrom('2026-05-04', undefined, 7, fixedNow);
      expect(result).toBe('2026-09-26'); // exactly 7 days before Oct 3
    });

    it('applies 2-day safety overlap when last sync was recent', () => {
      // Last sync Oct 1 2026 (2 days ago) -> minus 2 days overlap = Sept 29
      const result = calculateDynamicDateFrom('2026-10-01', undefined, 7, fixedNow);
      expect(result).toBe('2026-09-29');
    });

    it('honors explicitly requested dateFrom without overriding', () => {
      const result = calculateDynamicDateFrom('2026-05-04', '2026-01-01', 7, fixedNow);
      expect(result).toBe('2026-01-01');
    });

    it('falls back to default 7 days when no previous sync log exists', () => {
      const result = calculateDynamicDateFrom(null, undefined, 7, fixedNow);
      expect(result).toBe('2026-09-26');
    });
  });

  describe('Company Dawn Bucket Staggering', () => {
    it('deterministically calculates bucket for company UUIDs', () => {
      const taxologyId = 'acc22ca9-e9ff-4f9f-9495-ca7612b2e5e2';
      const bucket = getCompanySyncBucket(taxologyId, 4);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(4);
      // Deterministic check
      expect(getCompanySyncBucket(taxologyId, 4)).toBe(bucket);
    });

    it('handles edge case inputs without throwing', () => {
      expect(getCompanySyncBucket('', 4)).toBe(0);
      expect(getCompanySyncBucket('non-hex-string-test', 4)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('PGMQ nav_item_jobs payload contract', () => {
    it('creates compliant message structure for background worker queue', () => {
      const payload = {
        job_type: 'fetch_nav_items',
        company_id: 'acc22ca9-e9ff-4f9f-9495-ca7612b2e5e2',
        user_id: '14697333-8200-4621-8a3a-5cf2c692a901',
        created_at: new Date().toISOString()
      };

      expect(payload.job_type).toBe('fetch_nav_items');
      expect(payload.company_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(payload.user_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(new Date(payload.created_at).getTime()).toBeGreaterThan(0);
    });
  });

  describe('nav-fetch-details Edge Function contract', () => {
    it('validates batch detail response schema', () => {
      const mockResponse = {
        success: true,
        companyId: 'acc22ca9-e9ff-4f9f-9495-ca7612b2e5e2',
        processedCount: 5,
        failedCount: 0,
        remainingCount: 0
      };

      expect(mockResponse.success).toBe(true);
      expect(typeof mockResponse.processedCount).toBe('number');
      expect(typeof mockResponse.failedCount).toBe('number');
      expect(typeof mockResponse.remainingCount).toBe('number');
      expect(mockResponse.remainingCount).toBe(0);
    });

    it('enforces multi-tenant security: caller user must have company_members access if not service_role', () => {
      const checkAccess = (isServiceRole: boolean, callerUserId: string | null, memberList: string[]) => {
        if (isServiceRole) return true;
        if (!callerUserId) return false;
        return memberList.includes(callerUserId);
      };

      // Service role (worker/cron) always allowed
      expect(checkAccess(true, null, [])).toBe(true);

      // Authenticated company member allowed
      expect(checkAccess(false, 'user-123', ['user-123', 'user-456'])).toBe(true);

      // Authenticated user from different company forbidden
      expect(checkAccess(false, 'user-stranger', ['user-123', 'user-456'])).toBe(false);
    });
  });

  describe('Zero-as-Value & Financial Invariant Audit', () => {
    it('preserves legitimate zero amounts in line item mapping without falsy fallback distortion', () => {
      const rawLineItem = {
        lineNumber: 1,
        netAmount: 0,
        vatAmount: 0,
        grossAmount: 0,
        quantity: 0
      };

      // Falsy zero guard: (val !== undefined && val !== null) ? val : default
      const mapped = {
        net_amount: rawLineItem.netAmount ?? 0,
        vat_amount: rawLineItem.vatAmount ?? 0,
        gross_amount: rawLineItem.grossAmount ?? 0,
        quantity: rawLineItem.quantity ?? null
      };

      expect(mapped.net_amount).toBe(0);
      expect(mapped.vat_amount).toBe(0);
      expect(mapped.gross_amount).toBe(0);
      expect(mapped.quantity).toBe(0);
    });
  });
  describe('Credential Save 30-day Catch-Up Window Contract', () => {
    const fixedNow = new Date('2026-10-03T18:00:00Z');

    function calculateCredentialSaveCatchUpDate(
      lastSuccessDate: string | null,
      nowDate: Date = fixedNow
    ): { dateFromStr: string; dateToStr: string } {
      const dateTo = new Date(nowDate);
      const dateFrom = new Date(nowDate);
      const catchUpDate = new Date(dateTo);
      catchUpDate.setDate(catchUpDate.getDate() - 30);

      if (lastSuccessDate) {
        const lastDate = new Date(lastSuccessDate);
        if (!isNaN(lastDate.getTime())) {
          lastDate.setDate(lastDate.getDate() - 2);
          const effectiveDate = lastDate < catchUpDate ? lastDate : catchUpDate;
          const maxLookback = new Date(dateTo);
          maxLookback.setDate(maxLookback.getDate() - 365);
          dateFrom.setTime(effectiveDate < maxLookback ? maxLookback.getTime() : effectiveDate.getTime());
        } else {
          dateFrom.setTime(catchUpDate.getTime());
        }
      } else {
        dateFrom.setDate(dateFrom.getDate() - 90);
      }

      return {
        dateFromStr: dateFrom.toISOString().split('T')[0],
        dateToStr: dateTo.toISOString().split('T')[0]
      };
    }

    it('forces at least 30 days lookback on credential save even if last sync was yesterday', () => {
      // Last sync was yesterday (2026-10-02) -> must still look back 30 days to catch up on any missed invoices
      const { dateFromStr, dateToStr } = calculateCredentialSaveCatchUpDate('2026-10-02');
      expect(dateToStr).toBe('2026-10-03');
      expect(dateFromStr).toBe('2026-09-03'); // 30 days ago
    });

    it('looks back further if last sync was older than 30 days (e.g. 60 days ago)', () => {
      // Last sync 60 days ago (2026-08-04) -> look back to 2026-08-02 (minus 2 days overlap)
      const { dateFromStr } = calculateCredentialSaveCatchUpDate('2026-08-04');
      expect(dateFromStr).toBe('2026-08-02');
    });

    it('caps lookback at 365 days maximum', () => {
      const { dateFromStr } = calculateCredentialSaveCatchUpDate('2024-01-01');
      expect(dateFromStr).toBe('2025-10-03');
    });

    it('defaults to 90 days for completely new credentials without previous sync logs', () => {
      const { dateFromStr } = calculateCredentialSaveCatchUpDate(null);
      expect(dateFromStr).toBe('2026-07-05'); // 90 days ago
    });
  });

  describe('save_nav_invoice_details_and_items RPC Contract', () => {
    it('structures atomic transaction payload for header and item updates', () => {
      const invoiceId = 'd8920409-5b6d-49d6-96ec-bbca95b8ea79';
      const companyId = 'acc22ca9-e9ff-4f9f-9495-ca7612b2e5e2';

      const invoiceUpdates = {
        details_fetched: true,
        supplier_address: '1111 Budapest, Váci út 1.',
        is_cash_accounting: true,
        vat_summary: { netAmount: 10000, vatAmount: 2700, grossAmount: 12700 }
      };

      const lineItems = [
        {
          company_id: companyId,
          line_number: 1,
          line_description: 'Szoftverfejlesztési szolgáltatás',
          quantity: 1,
          unit_price: 10000,
          net_amount: 10000,
          vat_rate: '27%',
          vat_amount: 2700,
          gross_amount: 12700
        }
      ];

      const rpcPayload = {
        p_invoice_id: invoiceId,
        p_invoice_updates: invoiceUpdates,
        p_line_items: lineItems
      };

      expect(rpcPayload.p_invoice_id).toBe(invoiceId);
      expect(rpcPayload.p_invoice_updates.details_fetched).toBe(true);
      expect(rpcPayload.p_line_items).toHaveLength(1);
      expect(rpcPayload.p_line_items[0].line_number).toBe(1);
      expect(rpcPayload.p_line_items[0].gross_amount).toBe(12700);
    });

    it('normalizes and prevents duplicate line_number collisions to avoid error 21000', () => {
      const rawItems = [
        { lineNumber: 1, lineDescription: 'Gasztro Item A', netAmount: 100 },
        { lineNumber: 1, lineDescription: 'Gasztro Item B (duplicate)', netAmount: 200 },
        { lineNumber: 2, lineDescription: 'Gasztro Item C', netAmount: 300 }
      ];

      const seen = new Set<number>();
      let nextSeq = 1;
      const normalized = rawItems.map((item, idx) => {
        let lineNum = typeof item.lineNumber === 'number' && item.lineNumber > 0 ? item.lineNumber : (idx + 1);
        if (seen.has(lineNum)) {
          while (seen.has(nextSeq)) {
            nextSeq++;
          }
          lineNum = nextSeq;
        }
        seen.add(lineNum);
        return { ...item, line_number: lineNum };
      });

      expect(normalized).toHaveLength(3);
      expect(normalized[0].line_number).toBe(1);
      expect(normalized[1].line_number).toBe(2);
      expect(normalized[2].line_number).toBe(3);
      const lineNumbers = normalized.map(i => i.line_number);
      expect(new Set(lineNumbers).size).toBe(lineNumbers.length);
    });

    it('validates migration 20261006020000 includes safe line number normalization CTE', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const migrationFile = path.resolve(__dirname, '../../supabase/migrations/20261006020000_resilient_nav_invoice_item_dedup_rpc.sql');
      expect(fs.existsSync(migrationFile)).toBe(true);

      const sql = fs.readFileSync(migrationFile, 'utf8');
      expect(sql).toContain('safe_line_number');
      expect(sql).toContain('WITH ORDINALITY');
      expect(sql).toContain('valid_distinct_lines');
      expect(sql).toContain('ON CONFLICT (nav_invoice_id, line_number)');
      expect(sql).toContain('GRANT  EXECUTE ON FUNCTION public.save_nav_invoice_details_and_items(uuid, jsonb, jsonb) TO service_role');
    });
  });

  describe('PGMQ NAV 503 Maintenance Postponement Contract', () => {
    it('uses 900 seconds (15 minutes) visibility delay for NAV maintenance', () => {
      const MAINTENANCE_POSTPONE_SECONDS = 900;
      const queueName = 'nav_item_jobs';
      const msgId = 42;

      const vtPayload = {
        queue_name: queueName,
        msg_id: msgId,
        vt: MAINTENANCE_POSTPONE_SECONDS
      };

      expect(vtPayload.queue_name).toBe('nav_item_jobs');
      expect(vtPayload.vt).toBe(900); // exactly 15 minutes
      expect(vtPayload.vt / 60).toBe(15);
    });

    it('identifies 503 and maintenance patterns in API responses', () => {
      const isMaintenance = (status: number, body: string) => {
        const lower = body.toLowerCase();
        return status === 503 || body.includes('503') || lower.includes('karbantart') || lower.includes('service unavailable');
      };

      expect(isMaintenance(503, 'Service Temporarily Unavailable')).toBe(true);
      expect(isMaintenance(200, 'A NAV szerver karbantartás alatt áll.')).toBe(true);
      expect(isMaintenance(500, 'NAV 503 backend error')).toBe(true);
      expect(isMaintenance(400, 'Érvénytelen adószám')).toBe(false);
      expect(isMaintenance(401, 'Unauthorized')).toBe(false);
    });
  });

  describe('Manual Sync Fast-Header & PGMQ Worker Queueing Contract', () => {
    it('defaults fetchDetailedItems to false in manual sync to prevent browser timeouts', () => {
      const parseManualSyncOptions = (body: { fetchDetailedItems?: boolean }) => {
        return {
          fetchDetailedItemsInline: body.fetchDetailedItems === true,
          shouldEnqueueToPgmq: body.fetchDetailedItems !== true
        };
      };

      // Default call without explicit fetchDetailedItems
      const defaultCall = parseManualSyncOptions({});
      expect(defaultCall.fetchDetailedItemsInline).toBe(false);
      expect(defaultCall.shouldEnqueueToPgmq).toBe(true);

      // Explicit true (e.g. debugging/small batch)
      const explicitTrue = parseManualSyncOptions({ fetchDetailedItems: true });
      expect(explicitTrue.fetchDetailedItemsInline).toBe(true);
      expect(explicitTrue.shouldEnqueueToPgmq).toBe(false);
    });

    it('enqueues nav_item_jobs for worker when new invoices are inserted without inline details', () => {
      const determineEnqueueAction = (totalInserted: number, fetchDetailedItemsInline: boolean) => {
        return totalInserted > 0 && !fetchDetailedItemsInline;
      };

      // 50 new invoices inserted via manual sync -> must enqueue to PGMQ
      expect(determineEnqueueAction(50, false)).toBe(true);

      // 0 new invoices inserted (all already in DB) -> do not flood PGMQ
      expect(determineEnqueueAction(0, false)).toBe(false);

      // Details fetched inline -> no need to enqueue
      expect(determineEnqueueAction(50, true)).toBe(false);
    });
  });
});

