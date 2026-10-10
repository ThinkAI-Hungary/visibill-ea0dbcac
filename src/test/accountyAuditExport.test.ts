import { describe, it, expect } from 'vitest';
import {
  generateAuditorGlCsv,
  computeSha256Hex,
  generateAuditorGlExcel,
  generateSubsequentSettlementsExcel,
  getMkvkAuditXmlFileName,
  type AuditorGlLine,
  type AuditorGlSummary,
  type SubsequentSettlementsReport,
} from '@/services/auditorExportService';

describe('Auditor Export Service & Module 19 Engine', () => {
  const mockLine: AuditorGlLine = {
    line_id: 'test-line-1',
    header_id: 'test-header-1',
    journal_code: 'VE',
    journal_number: 101,
    accounting_date: '2025-06-15',
    document_date: '2025-06-10',
    due_date: '2025-06-25',
    gl_account_number: '31100',
    gl_account_name: 'Belföldi vevők',
    dc_type: 'T',
    amount: 1250000,
    currency: 'HUF',
    foreign_amount: null,
    exchange_rate: null,
    partner_tax_number: '12345678-2-41',
    partner_name: 'Minta Ügyfél Kft.',
    cost_center: 'Központ',
    job_code: '1',
    project_id: 'PRJ-2025',
    grant_id: 'GINOP-1',
    description: 'Szoftverfejlesztési szolgáltatás; havi díj',
    created_by: 'Kovács Anna',
  };

  const mockSummary: AuditorGlSummary = {
    total_lines: 1,
    total_debit: 1250000,
    total_credit: 1250000,
    is_balanced: true,
    imbalance_diff: 0,
  };

  describe('CSV Export Generator', () => {
    it('generates UTF-8 BOM CSV with semicolon delimiter and all 20 headers', () => {
      const csv = generateAuditorGlCsv([mockLine]);

      // Check UTF-8 BOM
      expect(csv.charCodeAt(0)).toBe(0xfeff);

      // Check header row
      const lines = csv.split('\r\n');
      const headerRow = lines[0].slice(1); // strip BOM
      const headers = headerRow.split(';');

      expect(headers).toHaveLength(20);
      expect(headers[0]).toBe('Naplokod');
      expect(headers[1]).toBe('Konyvelesi_sorszam');
      expect(headers[5]).toBe('Fokonyvi_szamlaszam');
      expect(headers[7]).toBe('TK');
      expect(headers[8]).toBe('Osszeg_HUF');
      expect(headers[13]).toBe('Partner_neve');
      expect(headers[19]).toBe('Rogzito_felhasznalo');

      // Check data row and semicolon escaping
      const dataRow = lines[1];
      expect(dataRow).toContain('VE;101;2025-06-15');
      expect(dataRow).toContain('"Szoftverfejlesztési szolgáltatás; havi díj"');
    });
  });

  describe('SHA-256 Checksum Calculator', () => {
    it('computes correct cryptographic SHA-256 hash', async () => {
      const hashEmpty = await computeSha256Hex('');
      // SHA-256 of empty string is e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      expect(hashEmpty).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

      const testContent = 'Visibill_Audit_2026';
      const hash = await computeSha256Hex(testContent);
      expect(hash).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
    });
  });

  describe('Excel (.xlsx) Workbook Generator', () => {
    it('creates formatted Excel workbook with 2 sheets for GL journal', async () => {
      const blob = await generateAuditorGlExcel(
        'Teszt Vállalkozás Zrt.',
        '12345678-2-41',
        { from: '2025-01-01', to: '2025-12-31' },
        [mockLine],
        mockSummary
      );

      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(1000);
      expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });

    it('creates formatted ISA 560 subsequent cash settlements Excel workbook', async () => {
      const mockSubReport: SubsequentSettlementsReport = {
        fiscal_year: 2025,
        year_end_date: '2025-12-31',
        cutoff_date: '2026-04-30',
        summary: {
          total_receivables_open_dec31: 5000000,
          settled_receivables_subsequent: 4500000,
          receivables_settlement_rate: 90.0,
          total_payables_open_dec31: 3000000,
          settled_payables_subsequent: 3000000,
          payables_settlement_rate: 100.0,
        },
        items: [
          {
            invoice_id: 'inv-1',
            invoice_number: 'SZ-2025/001',
            direction: 'AR',
            partner_name: 'Vevő Partner',
            partner_tax_number: '11111111-1-11',
            issue_date: '2025-12-10',
            due_date: '2025-12-30',
            fulfillment_date: '2025-12-10',
            open_amount_dec31: 5000000,
            currency: 'HUF',
            subsequent_settled_amount: 4500000,
            first_settlement_date: '2026-01-15',
            last_settlement_date: '2026-02-10',
            settlement_method: 'BANK',
            settlement_percentage: 90.0,
            settlement_status: 'PARTIALLY_SETTLED',
          },
        ],
      };

      const blob = await generateSubsequentSettlementsExcel('Teszt Vállalkozás Zrt.', 2025, mockSubReport);
      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(1000);
    });
  });

  describe('MKVK AuditXML Zero-Redundancy Integration', () => {
    it('generates standard MKVK file naming convention', () => {
      const fileName = getMkvkAuditXmlFileName('12345678-2-41', '2025-01-01', '2025-12-31', 'zip');
      expect(fileName).toBe('AuditXML_FK_12345678241_202501-202512.zip');
    });
  });
});
