import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import {
  getPartner360Matrix,
  getOmniPartnerLedger,
  simulateReclassification,
  executeReclassification,
  rollbackReclassification,
  detectAccountingAnomalies,
  getReclassificationHistory,
} from '@/services/technicalAccountingService';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('Module 22 - Technical Accounting & Analytics Unit Tests', () => {
  const mockCompanyId = '00000000-0000-0000-0000-000000000001';
  const mockPartnerId = '00000000-0000-0000-0000-000000000002';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Partner 360 Matrix (getPartner360Matrix)', () => {
    it('correctly maps partner 360 RPC response with net position and compensation', async () => {
      const mockRpcResponse = {
        partner: {
          id: mockPartnerId,
          name: 'Teszt Partner Kft.',
          tax_number: '12345678-2-41',
          partner_type: 'both',
          email: 'teszt@partner.hu',
          address: '1011 Budapest, Fő u. 1.',
          bank_account_number: '11700000-00000000',
        },
        accounts: [
          {
            gl_account_id: 'acc-311',
            gl_number: '311100',
            short_name: 'Belföldi vevők',
            account_nature: 'RECEIVABLE',
            total_debit: 500000,
            total_credit: 200000,
            balance: 300000,
            raw_balance: 300000,
            entries_count: 5,
            last_posting_date: '2026-03-01',
          },
          {
            gl_account_id: 'acc-454',
            gl_number: '454100',
            short_name: 'Belföldi szállítók',
            account_nature: 'PAYABLE',
            total_debit: 50000,
            total_credit: 150000,
            balance: 100000,
            raw_balance: -100000,
            entries_count: 2,
            last_posting_date: '2026-03-10',
          },
        ],
        summary: {
          total_receivables: 300000,
          total_payables: 100000,
          net_position: 200000,
          position_type: 'NET_RECEIVABLE',
          can_compensate: true,
          compensable_amount: 100000,
        },
      };

      (supabase.rpc as any).mockResolvedValueOnce({
        data: mockRpcResponse,
        error: null,
      });

      const result = await getPartner360Matrix(
        mockCompanyId,
        mockPartnerId,
        '2026-01-01',
        '2026-12-31'
      );

      expect(supabase.rpc).toHaveBeenCalledWith('get_partner_360_matrix', {
        p_company_id: mockCompanyId,
        p_partner_id: mockPartnerId,
        p_start_date: '2026-01-01',
        p_end_date: '2026-12-31',
      });

      expect(result.partner.name).toBe('Teszt Partner Kft.');
      expect(result.summary.position_type).toBe('NET_RECEIVABLE');
      expect(result.summary.can_compensate).toBe(true);
      expect(result.summary.compensable_amount).toBe(100000);
      expect(result.accounts).toHaveLength(2);
    });

    it('throws error when RPC fails', async () => {
      (supabase.rpc as any).mockResolvedValueOnce({
        data: null,
        error: new Error('Database error in get_partner_360_matrix'),
      });

      await expect(
        getPartner360Matrix(mockCompanyId, mockPartnerId)
      ).rejects.toThrow('Database error in get_partner_360_matrix');
    });
  });

  describe('Omni Partner Ledger (getOmniPartnerLedger)', () => {
    it('calls get_omni_partner_ledger with valid parameters and filters', async () => {
      const mockItems = [
        {
          partner_id: mockPartnerId,
          partner_name: 'Teszt Partner Kft.',
          partner_tax_number: '12345678-2-41',
          total_debit: 250000,
          total_credit: 100000,
          net_balance: 150000,
          entries_count: 8,
          last_entry_date: '2026-04-15',
        },
      ];

      (supabase.rpc as any).mockResolvedValueOnce({
        data: mockItems,
        error: null,
      });

      const result = await getOmniPartnerLedger(
        mockCompanyId,
        undefined,
        '5',
        '2026-01-01',
        '2026-06-30'
      );

      expect(supabase.rpc).toHaveBeenCalledWith('get_omni_partner_ledger', {
        p_company_id: mockCompanyId,
        p_gl_account_id: null,
        p_account_code_prefix: '5',
        p_start_date: '2026-01-01',
        p_end_date: '2026-06-30',
      });

      expect(result).toHaveLength(1);
      expect(result[0].partner_name).toBe('Teszt Partner Kft.');
    });
  });

  describe('Reclassification Simulation and Execution (Sztv. 165-169. §)', () => {
    const sourceGl = '00000000-0000-0000-0000-000000000010';
    const targetGl = '00000000-0000-0000-0000-000000000020';
    const lines = ['line-1', 'line-2'];

    it('runs simulation with p_is_simulation = true without altering state', async () => {
      const mockSimResult = {
        is_simulation: true,
        affected_lines_count: 2,
        total_amount: 150000,
        source_account: {
          id: sourceGl,
          gl_number: '511100',
          short_name: 'Anyagköltség',
          current_balance: 500000,
          simulated_balance: 350000,
          delta: -150000,
        },
        target_account: {
          id: targetGl,
          gl_number: '521100',
          short_name: 'Igénybevett szolgáltatás',
          current_balance: 200000,
          simulated_balance: 350000,
          delta: 150000,
        },
        has_cross_class_impact: false,
      };

      (supabase.rpc as any).mockResolvedValueOnce({
        data: mockSimResult,
        error: null,
      });

      const res = await simulateReclassification({
        companyId: mockCompanyId,
        sourceGlAccountId: sourceGl,
        targetGlAccountId: targetGl,
        journalLineIds: lines,
        reclassificationDate: '2026-04-01',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('execute_journal_reclassification', {
        p_company_id: mockCompanyId,
        p_source_gl_account_id: sourceGl,
        p_target_gl_account_id: targetGl,
        p_journal_line_ids: lines,
        p_reclassification_date: '2026-04-01',
        p_reason: 'Tömeges főkönyvi átvezetés szimuláció',
        p_is_simulation: true,
      });

      expect(res.is_simulation).toBe(true);
      expect(res.total_amount).toBe(150000);
      expect(res.source_account.delta).toBe(-150000);
      expect(res.target_account.delta).toBe(150000);
    });

    it('executes reclassification and returns numbered V-ATV voucher', async () => {
      const mockExecResult = {
        success: true,
        reclassification_id: 'reclass-100',
        batch_number: 'BATCH-20260401-100',
        document_id: 'V-ATV-2026-0042',
        header_id: 'hdr-100',
        affected_lines_count: 2,
        total_amount: 150000,
      };

      (supabase.rpc as any).mockResolvedValueOnce({
        data: mockExecResult,
        error: null,
      });

      const res = await executeReclassification({
        companyId: mockCompanyId,
        sourceGlAccountId: sourceGl,
        targetGlAccountId: targetGl,
        journalLineIds: lines,
        reclassificationDate: '2026-04-01',
        reason: 'Téves könyvelés átsorolása',
      });

      expect(supabase.rpc).toHaveBeenCalledWith('execute_journal_reclassification', {
        p_company_id: mockCompanyId,
        p_source_gl_account_id: sourceGl,
        p_target_gl_account_id: targetGl,
        p_journal_line_ids: lines,
        p_reclassification_date: '2026-04-01',
        p_reason: 'Téves könyvelés átsorolása',
        p_is_simulation: false,
        p_clearing_gl_account_id: null,
      });

      expect(res.success).toBe(true);
      expect(res.document_id).toMatch(/^V-ATV-\d{4}-\d{4}$/);
    });

    it('executes rollback and generates storno V-STV voucher', async () => {
      const mockRollbackResult = {
        success: true,
        storno_document_id: 'V-STV-2026-0043',
        storno_header_id: 'hdr-storno-100',
      };

      (supabase.rpc as any).mockResolvedValueOnce({
        data: mockRollbackResult,
        error: null,
      });

      const res = await rollbackReclassification(
        mockCompanyId,
        'reclass-100',
        'Nem jóváhagyott átvezetés'
      );

      expect(supabase.rpc).toHaveBeenCalledWith('rollback_journal_reclassification', {
        p_company_id: mockCompanyId,
        p_reclassification_id: 'reclass-100',
        p_reason: 'Nem jóváhagyott átvezetés',
      });

      expect(res.success).toBe(true);
      expect(res.storno_document_id).toMatch(/^V-STV-\d{4}-\d{4}$/);
    });
  });

  describe('Accounting Anomaly Guard (detectAccountingAnomalies)', () => {
    it('correctly categorizes anomalies into missing partners, inverted balances, and vat inconsistencies', async () => {
      const mockAnomalyResult = {
        total_anomalies_count: 3,
        missing_partners: [
          {
            type: 'MISSING_PARTNER' as const,
            severity: 'CRITICAL' as const,
            line_id: 'line-m-1',
            gl_number: '311100',
            gl_name: 'Vevők',
            amount: 250000,
            message: 'Partner nélküli vevő/szállító tétel',
          },
        ],
        inverted_balances: [
          {
            type: 'INVERTED_BALANCE' as const,
            severity: 'CRITICAL' as const,
            gl_number: '381100',
            gl_name: 'Házipénztár',
            balance: -45000,
            message: 'Fordított egyenlegű pénztárszámla (Negatív pénztár)',
          },
        ],
        vat_inconsistencies: [
          {
            type: 'VAT_INCONSISTENCY' as const,
            severity: 'WARNING' as const,
            gl_number: '466100',
            gl_name: 'Előzetesen felszámított ÁFA',
            message: 'ÁFA számla ÁFA-kód nélkül',
          },
        ],
      };

      (supabase.rpc as any).mockResolvedValueOnce({
        data: mockAnomalyResult,
        error: null,
      });

      const res = await detectAccountingAnomalies(mockCompanyId);

      expect(supabase.rpc).toHaveBeenCalledWith('detect_accounting_anomalies', {
        p_company_id: mockCompanyId,
        p_start_date: null,
        p_end_date: null,
      });

      expect(res.total_anomalies_count).toBe(3);
      expect(res.missing_partners).toHaveLength(1);
      expect(res.inverted_balances).toHaveLength(1);
      expect(res.vat_inconsistencies).toHaveLength(1);

      expect(res.missing_partners[0].gl_number).toBe('311100');
      expect(res.inverted_balances[0].balance).toBe(-45000);
    });
  });

  describe('Audit Log History (getReclassificationHistory)', () => {
    it('queries acc_reclassifications and maps relations', async () => {
      const mockHistory = [
        {
          id: 'rec-1',
          company_id: mockCompanyId,
          batch_number: 'BATCH-2026-001',
          source_gl_account_id: 'gl-1',
          target_gl_account_id: 'gl-2',
          reclassification_date: '2026-04-01',
          status: 'EXECUTED',
          affected_lines_count: 5,
          total_amount: 750000,
          currency: 'HUF',
          source_journal_line_ids: ['l1', 'l2'],
          source_account: { gl_number: '511100', short_name: 'Anyag' },
          target_account: { gl_number: '521100', short_name: 'Szolgáltatás' },
        },
      ];

      const selectMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValueOnce({
            data: mockHistory,
            error: null,
          }),
        }),
      });

      (supabase.from as any).mockReturnValueOnce({
        select: selectMock,
      });

      const history = await getReclassificationHistory(mockCompanyId);

      expect(supabase.from).toHaveBeenCalledWith('acc_reclassifications');
      expect(history).toHaveLength(1);
      expect(history[0].batch_number).toBe('BATCH-2026-001');
      expect(history[0].status).toBe('EXECUTED');
    });
  });
});
