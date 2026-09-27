import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePettyCashDrafts } from '../draftFallbackGenerator';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

describe('generatePettyCashDrafts enhancements', () => {
  const companyId = 'test-company-123';
  const activePresetId = 'test-preset-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assigns GL 526 (delegation) when description contains "kiküldetés"', async () => {
    const mockJournals = [
      { id: 'j-p1', code: 'P1', name: 'Pénztár', type: 'PETTY_CASH', connected_gl_account: '3811', currency: 'HUF' },
    ];

    const mockGlAccounts = [
      { id: 'gl-3811', gl_number: '3811' },
      { id: 'gl-3111', gl_number: '3111' },
      { id: 'gl-4541', gl_number: '4541' },
      { id: 'gl-9111', gl_number: '9111' },
      { id: 'gl-529', gl_number: '529' },
      { id: 'gl-4711', gl_number: '4711' },
      { id: 'gl-526', gl_number: '526' },
    ];

    const mockPce = [
      {
        id: 'pce-kik-1',
        entry_date: '2026-03-31',
        description: 'KIKÜLDETÉS',
        amount: -45000,
        currency: 'HUF',
        source_type: 'manual',
        source_table: null,
        source_id: null,
        partner_id: null,
      },
    ];

    const insertedHeaders: any[] = [];
    const insertedLines: any[] = [];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'acc_journals') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: mockJournals, error: null }),
          }),
        };
      }
      if (table === 'gl_accounts') {
        return {
          select: () => ({
            or: () => Promise.resolve({ data: mockGlAccounts, error: null }),
          }),
        };
      }
      if (table === 'petty_cash_entries') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: mockPce, error: null }),
          }),
        };
      }
      if (table === 'acc_journal_headers') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
          insert: (headerData: any) => {
            insertedHeaders.push(headerData);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'header-new-1' }, error: null }),
              }),
            };
          },
        };
      }
      if (table === 'invoices') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }
      if (table === 'acc_journal_lines') {
        return {
          insert: (linesData: any[]) => {
            insertedLines.push(...linesData);
            return Promise.resolve({ error: null });
          },
        };
      }
      return {
        select: () => Promise.resolve({ data: [], error: null }),
      };
    });

    const count = await generatePettyCashDrafts(companyId, activePresetId);
    expect(count).toBe(1);
    expect(insertedLines.length).toBe(2);

    const debitLine = insertedLines.find(l => l.dc_type === 'T');
    const creditLine = insertedLines.find(l => l.dc_type === 'K');

    expect(debitLine.gl_account_id).toBe('gl-526');
    expect(creditLine.gl_account_id).toBe('gl-3811');
  });

  it('matches open supplier invoice by description and assigns GL 4541', async () => {
    const mockJournals = [
      { id: 'j-p1', code: 'P1', name: 'Pénztár', type: 'PETTY_CASH', connected_gl_account: '3811', currency: 'HUF' },
    ];

    const mockGlAccounts = [
      { id: 'gl-3811', gl_number: '3811' },
      { id: 'gl-3111', gl_number: '3111' },
      { id: 'gl-4541', gl_number: '4541' },
      { id: 'gl-9111', gl_number: '9111' },
      { id: 'gl-529', gl_number: '529' },
      { id: 'gl-526', gl_number: '526' },
    ];

    const mockPce = [
      {
        id: 'pce-inv-match-1',
        entry_date: '2026-03-31',
        description: 'ZG-2026-2',
        amount: -160000,
        currency: 'HUF',
        source_type: 'manual',
        source_table: null,
        source_id: null,
        partner_id: null,
      },
    ];

    const mockAllCompanyInvoices = [
      {
        id: 'inv-zg-2',
        invoice_direction: 'INBOUND',
        bizonylatsorszam: 'ZG-2026-2',
      },
    ];

    const insertedLines: any[] = [];

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'acc_journals') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: mockJournals, error: null }),
          }),
        };
      }
      if (table === 'gl_accounts') {
        return {
          select: () => ({
            or: () => Promise.resolve({ data: mockGlAccounts, error: null }),
          }),
        };
      }
      if (table === 'petty_cash_entries') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: mockPce, error: null }),
          }),
        };
      }
      if (table === 'acc_journal_headers') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'header-new-2' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'invoices') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: mockAllCompanyInvoices, error: null }),
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }
      if (table === 'acc_journal_lines') {
        return {
          insert: (linesData: any[]) => {
            insertedLines.push(...linesData);
            return Promise.resolve({ error: null });
          },
        };
      }
      return {
        select: () => Promise.resolve({ data: [], error: null }),
      };
    });

    const count = await generatePettyCashDrafts(companyId, activePresetId);
    expect(count).toBe(1);
    expect(insertedLines.length).toBe(2);

    const debitLine = insertedLines.find(l => l.dc_type === 'T');
    const creditLine = insertedLines.find(l => l.dc_type === 'K');

    expect(debitLine.gl_account_id).toBe('gl-4541');
    expect(creditLine.gl_account_id).toBe('gl-3811');
    expect(debitLine.description).toContain('ZG-2026-2');
  });
});
