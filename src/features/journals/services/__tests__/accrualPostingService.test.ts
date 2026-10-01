import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findActiveMixedJournal,
  getExistingAccrualForInvoice,
  createAccrualJournalEntry,
  deleteAccrualEntry,
  type CreateAccrualJournalParams,
} from '../accrualPostingService';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'usr_mock_123' } },
        error: null,
      }),
    },
  },
}));

describe('accrualPostingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findActiveMixedJournal', () => {
    it('returns the active VE or MIXED journal when present', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 'j_mixed_1', code: 'VE', name: 'Vegyes napló', type: 'MIXED' },
        error: null,
      });
      const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockSingle });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockOr = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqActive = vi.fn().mockReturnValue({ or: mockOr });
      const mockEqCompany = vi.fn().mockReturnValue({ eq: mockEqActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqCompany });

      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const result = await findActiveMixedJournal('comp_123');

      expect(supabase.from).toHaveBeenCalledWith('acc_journals');
      expect(mockSelect).toHaveBeenCalledWith('id, code, name, type');
      expect(mockEqCompany).toHaveBeenCalledWith('company_id', 'comp_123');
      expect(mockEqActive).toHaveBeenCalledWith('is_active', true);
      expect(result).toEqual({ id: 'j_mixed_1', code: 'VE', name: 'Vegyes napló', type: 'MIXED' });
    });

    it('falls back to first non-opening journal if VE/MIXED not specifically configured', async () => {
      // First call (searching VE/MIXED) returns data: null
      const mockSingleFirst = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockLimitFirst = vi.fn().mockReturnValue({ maybeSingle: mockSingleFirst });
      const mockOrderFirst = vi.fn().mockReturnValue({ limit: mockLimitFirst });
      const mockOrFirst = vi.fn().mockReturnValue({ order: mockOrderFirst });
      const mockEqActiveFirst = vi.fn().mockReturnValue({ or: mockOrFirst });
      const mockEqCompanyFirst = vi.fn().mockReturnValue({ eq: mockEqActiveFirst });
      const mockSelectFirst = vi.fn().mockReturnValue({ eq: mockEqCompanyFirst });

      // Second fallback call returns a general journal
      const mockSingleFallback = vi.fn().mockResolvedValue({
        data: { id: 'j_fallback_2', code: 'KONYV', name: 'Könyvelési napló', type: 'GENERAL' },
        error: null,
      });
      const mockLimitFallback = vi.fn().mockReturnValue({ maybeSingle: mockSingleFallback });
      const mockNeqFallback = vi.fn().mockReturnValue({ limit: mockLimitFallback });
      const mockEqActiveFallback = vi.fn().mockReturnValue({ neq: mockNeqFallback });
      const mockEqCompanyFallback = vi.fn().mockReturnValue({ eq: mockEqActiveFallback });
      const mockSelectFallback = vi.fn().mockReturnValue({ eq: mockEqCompanyFallback });

      vi.mocked(supabase.from)
        .mockReturnValueOnce({ select: mockSelectFirst } as any)
        .mockReturnValueOnce({ select: mockSelectFallback } as any);

      const result = await findActiveMixedJournal('comp_123');

      expect(result).toEqual({ id: 'j_fallback_2', code: 'KONYV', name: 'Könyvelési napló', type: 'GENERAL' });
    });

    it('throws error when no active journal is found for company', async () => {
      // First call returns null
      const mockSingleFirst = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockLimitFirst = vi.fn().mockReturnValue({ maybeSingle: mockSingleFirst });
      const mockOrderFirst = vi.fn().mockReturnValue({ limit: mockLimitFirst });
      const mockOrFirst = vi.fn().mockReturnValue({ order: mockOrderFirst });
      const mockEqActiveFirst = vi.fn().mockReturnValue({ or: mockOrFirst });
      const mockEqCompanyFirst = vi.fn().mockReturnValue({ eq: mockEqActiveFirst });
      const mockSelectFirst = vi.fn().mockReturnValue({ eq: mockEqCompanyFirst });

      // Fallback also returns null
      const mockSingleFallback = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockLimitFallback = vi.fn().mockReturnValue({ maybeSingle: mockSingleFallback });
      const mockNeqFallback = vi.fn().mockReturnValue({ limit: mockLimitFallback });
      const mockEqActiveFallback = vi.fn().mockReturnValue({ neq: mockNeqFallback });
      const mockEqCompanyFallback = vi.fn().mockReturnValue({ eq: mockEqActiveFallback });
      const mockSelectFallback = vi.fn().mockReturnValue({ eq: mockEqCompanyFallback });

      vi.mocked(supabase.from)
        .mockReturnValueOnce({ select: mockSelectFirst } as any)
        .mockReturnValueOnce({ select: mockSelectFallback } as any);

      await expect(findActiveMixedJournal('comp_empty')).rejects.toThrow('Nem található aktív könyvelési napló a céghez.');
    });
  });

  describe('getExistingAccrualForInvoice', () => {
    it('returns the active accrual record for given invoiceId excluding reversed', async () => {
      const mockAccrual = {
        id: 'acc_1',
        invoice_id: 'inv_100',
        accrual_type: 'AIE',
        accrual_date: '2026-12-31',
        reversal_date: '2027-01-01',
        amount: 5133,
        gl_debit: '392',
        gl_credit: '5359',
        status: 'booked',
        booked_journal_entry_id: 'head_ve_1',
      };

      const mockSingle = vi.fn().mockResolvedValue({ data: mockAccrual, error: null });
      const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockSingle });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockNeq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const result = await getExistingAccrualForInvoice('inv_100');

      expect(supabase.from).toHaveBeenCalledWith('accrual_entries');
      expect(mockEq).toHaveBeenCalledWith('invoice_id', 'inv_100');
      expect(mockNeq).toHaveBeenCalledWith('status', 'reversed');
      expect(result).toEqual(mockAccrual);
    });

    it('returns null on database error or when no record exists', async () => {
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
      const mockLimit = vi.fn().mockReturnValue({ maybeSingle: mockSingle });
      const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockNeq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq = vi.fn().mockReturnValue({ neq: mockNeq });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });

      vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

      const result = await getExistingAccrualForInvoice('inv_none');
      expect(result).toBeNull();
    });
  });

  describe('createAccrualJournalEntry', () => {
    it('creates header, lines, and accrual_entries record with accurate double-entry sides', async () => {
      // 1. Mock findActiveMixedJournal
      const mockSingleJournal = vi.fn().mockResolvedValue({
        data: { id: 'journal_ve_1', code: 'VE', name: 'Vegyes napló', type: 'MIXED' },
        error: null,
      });
      const mockJournalLimit = vi.fn().mockReturnValue({ maybeSingle: mockSingleJournal });
      const mockJournalOrder = vi.fn().mockReturnValue({ limit: mockJournalLimit });
      const mockJournalOr = vi.fn().mockReturnValue({ order: mockJournalOrder });
      const mockJournalEqActive = vi.fn().mockReturnValue({ or: mockJournalOr });
      const mockJournalEqCompany = vi.fn().mockReturnValue({ eq: mockJournalEqActive });
      const mockJournalSelect = vi.fn().mockReturnValue({ eq: mockJournalEqCompany });

      // 2. Mock doc_number generation (select max)
      const mockDocSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockDocLimit = vi.fn().mockReturnValue({ maybeSingle: mockDocSingle });
      const mockDocOrder = vi.fn().mockReturnValue({ limit: mockDocLimit });
      const mockDocLike = vi.fn().mockReturnValue({ order: mockDocOrder });
      const mockDocEqCompany = vi.fn().mockReturnValue({ like: mockDocLike });
      const mockDocSelect = vi.fn().mockReturnValue({ eq: mockDocEqCompany });

      // 3. Mock insert acc_journal_headers
      const mockHeaderSingle = vi.fn().mockResolvedValue({ data: { id: 'hdr_uuid_100' }, error: null });
      const mockHeaderSelect = vi.fn().mockReturnValue({ single: mockHeaderSingle });
      const mockHeaderInsert = vi.fn().mockReturnValue({ select: mockHeaderSelect });

      // 4. Mock insert acc_journal_lines
      const mockLinesInsert = vi.fn().mockResolvedValue({ error: null });

      // 5. Mock insert accrual_entries
      const mockAccrualSingle = vi.fn().mockResolvedValue({ data: { id: 'accrual_uuid_200' }, error: null });
      const mockAccrualSelect = vi.fn().mockReturnValue({ single: mockAccrualSingle });
      const mockAccrualInsert = vi.fn().mockReturnValue({ select: mockAccrualSelect });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'acc_journals') return { select: mockJournalSelect } as any;
        if (table === 'acc_journal_headers') {
          return {
            select: mockDocSelect,
            insert: mockHeaderInsert,
          } as any;
        }
        if (table === 'acc_journal_lines') return { insert: mockLinesInsert } as any;
        if (table === 'accrual_entries') return { insert: mockAccrualInsert } as any;
        return {} as any;
      });

      const params: CreateAccrualJournalParams = {
        companyId: 'comp_1',
        presetId: 'preset_1',
        invoiceId: 'inv_100',
        invoiceNumber: 'E1720263358',
        partnerId: '18105791',
        partnerName: 'MKOE',
        itemDescription: 'GDPR Kieg.biztosítási díj',
        accrualType: 'AIE',
        accrualDate: '2026-12-31',
        reversalDate: '2027-01-01',
        accrualAmount: 5133,
        debitGlAccountId: 'acc_392',
        debitGlNumber: '392',
        creditGlAccountId: 'acc_5359',
        creditGlNumber: '5359',
        currency: 'HUF',
      };

      const result = await createAccrualJournalEntry(params);

      expect(result).toEqual({ headerId: 'hdr_uuid_100', accrualId: 'accrual_uuid_200' });

      // Verify header insert
      expect(mockHeaderInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          company_id: 'comp_1',
          journal_id: 'journal_ve_1',
          status: 'KONYVELT',
          document_date: '2026-12-31',
          posting_date: '2026-12-31',
          accounting_year: 2026,
          document_id: 'E1720263358',
          created_by: 'usr_mock_123',
        })
      );

      // Verify lines insert (Tartozik 392, Követel 5359)
      expect(mockLinesInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          header_id: 'hdr_uuid_100',
          sequence_number: 1,
          gl_account_id: 'acc_392',
          dc_type: 'T',
          amount: 5133,
        }),
        expect.objectContaining({
          header_id: 'hdr_uuid_100',
          sequence_number: 2,
          gl_account_id: 'acc_5359',
          dc_type: 'K',
          amount: 5133,
        }),
      ]);

      // Verify accrual_entries insert
      expect(mockAccrualInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          company_id: 'comp_1',
          preset_id: 'preset_1',
          invoice_id: 'inv_100',
          accrual_type: 'AIE',
          accrual_date: '2026-12-31',
          reversal_date: '2027-01-01',
          amount: 5133,
          gl_debit: '392',
          gl_credit: '5359',
          status: 'booked',
          booked_journal_entry_id: 'hdr_uuid_100',
        })
      );
    });
  });

  describe('deleteAccrualEntry', () => {
    it('deletes journal lines, journal header, and accrual entry record', async () => {
      const mockLinesEq = vi.fn().mockResolvedValue({ error: null });
      const mockLinesDelete = vi.fn().mockReturnValue({ eq: mockLinesEq });

      const mockHdrEq = vi.fn().mockResolvedValue({ error: null });
      const mockHdrDelete = vi.fn().mockReturnValue({ eq: mockHdrEq });

      const mockAccrualEq = vi.fn().mockResolvedValue({ error: null });
      const mockAccrualDelete = vi.fn().mockReturnValue({ eq: mockAccrualEq });

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'acc_journal_lines') return { delete: mockLinesDelete } as any;
        if (table === 'acc_journal_headers') return { delete: mockHdrDelete } as any;
        if (table === 'accrual_entries') return { delete: mockAccrualDelete } as any;
        return {} as any;
      });

      await deleteAccrualEntry('acc_id_1', 'hdr_id_1');

      expect(mockLinesDelete).toHaveBeenCalled();
      expect(mockLinesEq).toHaveBeenCalledWith('header_id', 'hdr_id_1');

      expect(mockHdrDelete).toHaveBeenCalled();
      expect(mockHdrEq).toHaveBeenCalledWith('id', 'hdr_id_1');

      expect(mockAccrualDelete).toHaveBeenCalled();
      expect(mockAccrualEq).toHaveBeenCalledWith('id', 'acc_id_1');
    });
  });
});
