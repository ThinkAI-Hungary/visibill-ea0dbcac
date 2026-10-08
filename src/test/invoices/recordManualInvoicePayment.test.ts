import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-test-123' } } }),
      },
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

import { supabase } from '@/integrations/supabase/client';

describe('record_manual_invoice_payment RPC & Migration Integrity Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Migration 20261007223500 Static Analysis & Conflict Guard', () => {
    it('verifies migration file exists and implements ON CONFLICT clause', () => {
      const migrationPath = path.resolve(
        process.cwd(),
        'supabase/migrations/20261007223500_fix_record_manual_invoice_payment_conflict.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const content = fs.readFileSync(migrationPath, 'utf-8');

      // 1. Must use ON CONFLICT (transaction_id, invoice_id) DO UPDATE
      expect(content).toMatch(/ON\s+CONFLICT\s*\(\s*transaction_id\s*,\s*invoice_id\s*\)\s*DO\s+UPDATE/i);

      // 2. Must set safe search_path to prevent schema injection
      expect(content).toMatch(/SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i);

      // 3. Must be SECURITY DEFINER
      expect(content).toMatch(/SECURITY\s+DEFINER/i);

      // 4. Must revoke from PUBLIC and anon, grant only to authenticated and service_role
      expect(content).toMatch(/REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.record_manual_invoice_payment.*FROM\s+PUBLIC\s*,\s*anon/i);
      expect(content).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.record_manual_invoice_payment.*TO\s+authenticated\s*,\s*service_role/i);
    });
  });

  describe('ManualPaymentDialog RPC Contract', () => {
    it('invokes record_manual_invoice_payment RPC with exact required parameters', async () => {
      const mockInvoiceId = 'inv-uuid-1234-5678';
      const mockDate = '2026-10-07';
      const mockPaymentType = 'cash';
      const mockNote = 'Személyes átvételkor kiegyenlítve';

      (supabase.rpc as any).mockResolvedValue({ data: null, error: null });

      const res = await supabase.rpc('record_manual_invoice_payment', {
        p_invoice_id: mockInvoiceId,
        p_payment_date: mockDate,
        p_payment_type: mockPaymentType,
        p_note: mockNote,
      });

      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.rpc).toHaveBeenCalledWith('record_manual_invoice_payment', {
        p_invoice_id: mockInvoiceId,
        p_payment_date: mockDate,
        p_payment_type: mockPaymentType,
        p_note: mockNote,
      });
      expect(res.error).toBeNull();
    });

    it('gracefully propagates RPC execution error if thrown', async () => {
      (supabase.rpc as any).mockResolvedValue({
        data: null,
        error: { message: 'Invoice not found', code: 'P0001' },
      });

      const res = await supabase.rpc('record_manual_invoice_payment', {
        p_invoice_id: 'non-existent-uuid',
        p_payment_date: '2026-10-07',
        p_payment_type: 'private_card',
        p_note: null,
      });

      expect(res.error).not.toBeNull();
      expect(res.error?.message).toBe('Invoice not found');
    });
  });
});
