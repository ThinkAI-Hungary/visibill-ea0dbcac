import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importRlbAuditXml, importRlbCsvLedger } from '@/lib/rlb/rlbImportService';
import type { RlbXmlParseResult, RlbCsvParseResult } from '@/lib/rlb/rlbParser';

// Supabase table spies
const mockInsert = vi.fn();
const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

vi.mock('@/lib/errorReporter', () => ({
  reportError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      const builder: any = {
        select: vi.fn((cols?: string) => {
          mockSelect(table, cols);
          return builder;
        }),
        insert: vi.fn((payload: any) => {
          mockInsert(table, payload);
          return builder;
        }),
        upsert: vi.fn((payload: any, options?: any) => {
          mockUpsert(table, payload, options);
          return Promise.resolve({ data: payload, error: null });
        }),
        update: vi.fn((payload: any) => {
          mockUpdate(table, payload);
          return builder;
        }),
        eq: vi.fn(() => builder),
        neq: vi.fn(() => builder),
        maybeSingle: vi.fn(() => {
          // If searching for existing preset
          if (table === 'chart_of_accounts_presets') {
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
        single: vi.fn(() => {
          if (table === 'chart_of_accounts_presets') {
            return Promise.resolve({ data: { id: 'mock-preset-123' }, error: null });
          }
          if (table === 'gl_audit_imports') {
            return Promise.resolve({ data: { id: 'mock-import-456' }, error: null });
          }
          return Promise.resolve({ data: { id: 'mock-id' }, error: null });
        }),
      };
      // Allow awaiting builder directly
      builder.then = (onFulfilled: any) => Promise.resolve({ data: [], error: null }).then(onFulfilled);
      return builder;
    }),
  },
}));

describe('rlbImportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockXmlResult: RlbXmlParseResult = {
    format: 'rlb_audit_xml',
    meta: {
      sourceProgram: 'RLB',
      sourceVersion: '26.6',
      companyName: 'WR HOME KFT.',
      taxNumber: '26242363-2-43',
      periodStart: '2026-01-01',
      periodEnd: '2026-12-31',
      currency: 'HUF',
      journalCount: 1,
      accountCount: 3,
      partnerCount: 1,
      voucherCount: 1,
      entryCount: 1,
    },
    journals: [{ code: '1', name: 'Vegyes' }],
    accounts: [
      { code: '131', rawCode: '23', name: 'Gépek', accountClass: '1', accountType: 'asset' },
      { code: '491', rawCode: '383', name: 'Nyitó', accountClass: '4', accountType: 'liability' },
      { code: '311', rawCode: '311', name: 'Vevők', accountClass: '3', accountType: 'asset' },
    ],
    partners: [
      { code: 'P01', name: 'Partner 1 Kft.', taxNumber: '11111111-1-11', isRelatedParty: false },
    ],
    vouchers: {
      1: { bizId: 1, bizSzam: 'Nyitó 000001', datum: '2026-01-01', journalCode: '1', periodCode: '1' },
    },
    entries: [
      {
        bizId: 1,
        entryIndex: 1,
        voucherNumber: 'Nyitó 000001',
        voucherDate: '2026-01-01',
        journalCode: '1',
        journalName: 'Vegyes',
        description: 'Nyitó tétel',
        debitAccount: '131',
        creditAccount: '491',
        rawDebitAccount: '23',
        rawCreditAccount: '383',
        amount: 241228,
        foreignAmount: null,
        foreignCurrency: null,
        exchangeRate: null,
        vatBase: null,
        vatRate: null,
        serviceDate: '2026-01-01',
        paymentDueDate: null,
        partnerCode: 'P01',
        partnerName: 'Partner 1 Kft.',
        partnerTaxNumber: '11111111-1-11',
        costCenter: null,
        workNumber: null,
        isStorno: false,
      },
    ],
    accountCodeMap: { '23': '131', '383': '491' },
    stats: {
      totalDebit: 241228,
      totalCredit: 241228,
      balanceDiff: 0,
      isBalanced: true,
      entriesWithPartnerCount: 1,
      stornoCount: 0,
    },
    errors: [],
    warnings: [],
  };

  it('imports RLB XML data in live mode and populates all tables', async () => {
    const progressSpy = vi.fn();

    const result = await importRlbAuditXml({
      companyId: 'company-wr-home',
      userId: 'user-jambor',
      fileName: 'feladas.xml',
      xmlResult: mockXmlResult,
      presetMode: 'original',
      dryRun: false,
      onProgress: progressSpy,
    });

    expect(result.success).toBe(true);
    expect(result.presetId).toBe('mock-preset-123');
    expect(result.importId).toBe('mock-import-456');
    expect(result.dryRun).toBe(false);
    expect(result.entriesImported).toBe(1);

    // Verify preset was created
    expect(mockInsert).toHaveBeenCalledWith('chart_of_accounts_presets', expect.objectContaining({
      company_id: 'company-wr-home',
      name: 'WR HOME KFT. - RLB Számlatükör',
    }));

    // Verify accounts were upserted with conflict resolution
    expect(mockUpsert).toHaveBeenCalledWith('gl_accounts', expect.any(Array), { onConflict: 'preset_id,gl_number' });

    // Verify import record was inserted
    expect(mockInsert).toHaveBeenCalledWith('gl_audit_imports', expect.objectContaining({
      company_id: 'company-wr-home',
      file_name: 'feladas.xml',
      source_program: 'RLB',
      dry_run: false,
    }));

    // Verify child tables were inserted
    expect(mockInsert).toHaveBeenCalledWith('gl_audit_accounts', expect.any(Array));
    expect(mockInsert).toHaveBeenCalledWith('gl_audit_partners', expect.any(Array));
    expect(mockInsert).toHaveBeenCalledWith('gl_journal_entries', expect.any(Array));

    // Verify progress reported
    expect(progressSpy).toHaveBeenCalled();
  });

  it('handles dry-run mode without populating journal entries', async () => {
    const result = await importRlbAuditXml({
      companyId: 'company-wr-home',
      userId: 'user-jambor',
      fileName: 'feladas.xml',
      xmlResult: mockXmlResult,
      presetMode: 'original',
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);

    // gl_journal_entries should NOT have been inserted in dry-run
    const journalInserts = mockInsert.mock.calls.filter(call => call[0] === 'gl_journal_entries');
    expect(journalInserts.length).toBe(0);
  });

  it('imports RLB CSV Ledger into chart_of_accounts_presets and gl_accounts', async () => {
    const mockCsvResult: RlbCsvParseResult = {
      format: 'rlb_csv_ledger',
      companyName: 'WR HOME KFT.',
      accounts: [
        {
          glNumber: '3811',
          accountName: 'Házipénztár',
          openingDebit: 0,
          openingCredit: 0,
          turnoverDebit: 150000,
          turnoverCredit: 50000,
          periodBalanceDebit: 100000,
          periodBalanceCredit: 0,
          totalBalanceDebit: 100000,
          totalBalanceCredit: 0,
          accountTypeCategory: '7',
          isGroup: false,
        },
      ],
      stats: {
        totalAccounts: 1,
        groupAccountsCount: 0,
        detailAccountsCount: 1,
        totalOpeningDebit: 0,
        totalOpeningCredit: 0,
        totalTurnoverDebit: 150000,
        totalTurnoverCredit: 50000,
        totalBalanceDebit: 100000,
        totalBalanceCredit: 0,
        isTurnoverBalanced: false,
      },
      errors: [],
      warnings: [],
    };

    const result = await importRlbCsvLedger({
      companyId: 'company-wr-home',
      fileName: 'fokonyv.csv',
      csvResult: mockCsvResult,
      presetMode: 'original',
    });

    expect(result.success).toBe(true);
    expect(result.presetId).toBe('mock-preset-123');
    expect(result.accountsImported).toBeGreaterThanOrEqual(1);

    expect(mockUpsert).toHaveBeenCalledWith('gl_accounts', expect.any(Array), { onConflict: 'preset_id,gl_number' });
  });
});
