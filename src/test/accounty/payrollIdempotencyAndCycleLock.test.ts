import { describe, it, expect, vi } from 'vitest';
import { postPayrollCycleToLedger } from '@/lib/payroll/payrollAutoPoster';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

import { supabase } from '@/integrations/supabase/client';

describe('Payroll Idempotency & Duplicate Posting Guard', () => {
  it('should detect existing active journal entry and return isAlreadyPosted without duplicate insert', async () => {
    const cycleId = 'cycle-test-123';
    const companyId = 'company-test-123';
    const userId = 'user-test-123';

    // Mock cycle query
    const mockCycle = {
      id: cycleId,
      company_id: companyId,
      year: 2026,
      month: 9,
      status: 'closed',
    };

    const mockCalcs = [
      { id: 'calc-1', gross_salary: 700000, szja_amount: 105000, tb_amount: 129500, net_salary: 465500 },
    ];

    const mockExistingHeader = {
      id: 'existing-header-1',
      document_id: 'BER-2026-09',
      journal_number: 'BER-2026-09',
      status: 'KONYVELT',
    };

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    const mockInsert = vi.fn();

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'accounty_payroll_cycles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCycle, error: null }),
            }),
          }),
          update: mockUpdate,
        };
      }
      if (table === 'accounty_payroll_calculations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockCalcs, error: null }),
          }),
        };
      }
      if (table === 'accounty_employments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === 'accounty_tax_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { is_kiva: false }, error: null }),
            }),
          }),
        };
      }
      if (table === 'acc_journals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ id: 'journal-ve', code: 'VE', name: 'Vegyes' }], error: null }),
          }),
        };
      }
      if (table === 'acc_journal_headers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({ data: [mockExistingHeader], error: null }),
              }),
            }),
          }),
          insert: mockInsert,
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    const result = await postPayrollCycleToLedger(cycleId, companyId, userId, {
      gl541: 'gl-541',
      gl471: 'gl-471',
    });

    expect(result.success).toBe(true);
    expect(result.isAlreadyPosted).toBe(true);
    expect(result.journalNumber).toBe('BER-2026-09');
    expect(result.headerId).toBe('existing-header-1');
    // Crucial: insert should NOT be called because an active entry already exists!
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('should post fresh journal entry when no active header exists', async () => {
    const cycleId = 'cycle-fresh-456';
    const companyId = 'company-fresh-456';
    const userId = 'user-fresh-456';

    const mockCycle = {
      id: cycleId,
      company_id: companyId,
      year: 2026,
      month: 10,
      status: 'calculated',
    };

    const mockCalcs = [
      { id: 'calc-2', gross_salary: 500000, szja_amount: 75000, tb_amount: 92500, net_salary: 332500 },
    ];

    const mockInsertHeader = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'new-header-123' }, error: null }),
      }),
    });

    const mockInsertLines = vi.fn().mockResolvedValue({ error: null });

    const mockUpdateCycle = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'accounty_payroll_cycles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCycle, error: null }),
            }),
          }),
          update: mockUpdateCycle,
        };
      }
      if (table === 'accounty_payroll_calculations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: mockCalcs, error: null }),
          }),
        };
      }
      if (table === 'accounty_employments') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === 'accounty_tax_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { is_kiva: false }, error: null }),
            }),
          }),
        };
      }
      if (table === 'acc_journals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [{ id: 'journal-ve', code: 'VE', name: 'Vegyes' }], error: null }),
          }),
        };
      }
      if (table === 'acc_journal_headers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockResolvedValue({ data: [], error: null }), // No existing active header!
              }),
            }),
          }),
          insert: mockInsertHeader,
        };
      }
      if (table === 'acc_journal_lines') {
        return {
          insert: mockInsertLines,
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    const result = await postPayrollCycleToLedger(cycleId, companyId, userId, {
      gl541: 'gl-541',
      gl471: 'gl-471',
    });

    expect(result.success).toBe(true);
    expect(result.isAlreadyPosted).toBeUndefined();
    expect(result.headerId).toBe('new-header-123');
    expect(result.journalNumber).toBe('BER-2026-10');
    expect(mockInsertHeader).toHaveBeenCalledTimes(1);
    expect(mockInsertLines).toHaveBeenCalledTimes(1);
    expect(mockUpdateCycle).toHaveBeenCalledWith(expect.objectContaining({
      status: 'closed',
      current_step: 8,
    }));
  });
});
