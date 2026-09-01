import { describe, it, expect, vi } from 'vitest';
import { validateFileType } from '../core/documentUploadService';
import { CHANNEL_CONFIGS, BANK_HINT_OPTIONS, COURIER_OPTIONS } from '../config/channelConfigs';

describe('DocumentUploadService & ChannelConfigs', () => {
  describe('validateFileType', () => {
    it('accepts valid PDF for invoice channel', () => {
      const file = new File(['dummy content'], 'invoice_123.pdf', { type: 'application/pdf' });
      expect(validateFileType(file, CHANNEL_CONFIGS.invoices)).toBe(true);
    });

    it('accepts valid images (PNG, JPG, WEBP) for invoice channel', () => {
      const pngFile = new File(['dummy'], 'scan.png', { type: 'image/png' });
      const jpgFile = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
      const webpFile = new File(['dummy'], 'doc.webp', { type: 'image/webp' });

      expect(validateFileType(pngFile, CHANNEL_CONFIGS.invoices)).toBe(true);
      expect(validateFileType(jpgFile, CHANNEL_CONFIGS.invoices)).toBe(true);
      expect(validateFileType(webpFile, CHANNEL_CONFIGS.invoices)).toBe(true);
    });

    it('rejects unsupported file extensions for invoice channel', () => {
      const exeFile = new File(['dummy'], 'invoice.exe', { type: 'application/x-msdownload' });
      const zipFile = new File(['dummy'], 'invoice.zip', { type: 'application/zip' });

      expect(validateFileType(exeFile, CHANNEL_CONFIGS.invoices)).toBe(false);
      expect(validateFileType(zipFile, CHANNEL_CONFIGS.invoices)).toBe(false);
    });

    it('validates transaction files (PDF, CSV, XLS, XLSX)', () => {
      const pdfFile = new File(['dummy'], 'kivonat.pdf', { type: 'application/pdf' });
      const csvFile = new File(['dummy'], 'kivonat.csv', { type: 'text/csv' });
      const xlsxFile = new File(['dummy'], 'kivonat.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      expect(validateFileType(pdfFile, CHANNEL_CONFIGS.transactions)).toBe(true);
      expect(validateFileType(csvFile, CHANNEL_CONFIGS.transactions)).toBe(true);
      expect(validateFileType(xlsxFile, CHANNEL_CONFIGS.transactions)).toBe(true);
    });

    it('validates courier reports (XLS, XLSX, CSV, PDF, DOC, DOCX)', () => {
      const docxFile = new File(['dummy'], 'gls_report.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const xlsFile = new File(['dummy'], 'mpl_report.xls', {
        type: 'application/vnd.ms-excel',
      });

      expect(validateFileType(docxFile, CHANNEL_CONFIGS.reports)).toBe(true);
      expect(validateFileType(xlsFile, CHANNEL_CONFIGS.reports)).toBe(true);
    });
  });

  describe('CHANNEL_CONFIGS Integrity', () => {
    it('defines all 5 expected upload channels', () => {
      const channelKeys = Object.keys(CHANNEL_CONFIGS);
      expect(channelKeys).toEqual([
        'invoices',
        'vouchers',
        'transactions',
        'salaries',
        'reports',
      ]);
    });

    it('maps channels to correct target database tables and storage buckets', () => {
      expect(CHANNEL_CONFIGS.invoices.targetTable).toBe('invoice_uploads');
      expect(CHANNEL_CONFIGS.invoices.storageBucket).toBe('invoice-uploads');
      expect(CHANNEL_CONFIGS.invoices.documentCategory).toBe('invoice');

      expect(CHANNEL_CONFIGS.vouchers.targetTable).toBe('invoice_uploads');
      expect(CHANNEL_CONFIGS.vouchers.storageBucket).toBe('invoice-uploads');
      expect(CHANNEL_CONFIGS.vouchers.documentCategory).toBe('penztarbizonylat');
      expect(CHANNEL_CONFIGS.vouchers.defaultMetadata).toEqual({
        source: 'manual_voucher_upload',
        document_type: 'cash_voucher',
      });

      expect(CHANNEL_CONFIGS.transactions.targetTable).toBe('transaction_uploads');
      expect(CHANNEL_CONFIGS.transactions.storageBucket).toBe('transactions');
      expect(CHANNEL_CONFIGS.transactions.documentCategory).toBeUndefined();

      expect(CHANNEL_CONFIGS.salaries.targetTable).toBe('invoice_uploads');
      expect(CHANNEL_CONFIGS.salaries.storageBucket).toBe('invoice-uploads');
      expect(CHANNEL_CONFIGS.salaries.documentCategory).toBe('payroll');
      expect(CHANNEL_CONFIGS.salaries.defaultMetadata).toEqual({
        source: 'manual_salary_upload',
        document_type: 'payroll_report',
      });

      expect(CHANNEL_CONFIGS.reports.targetTable).toBe('report_uploads');
      expect(CHANNEL_CONFIGS.reports.storageBucket).toBe('report-uploads');
      expect(CHANNEL_CONFIGS.reports.documentCategory).toBeUndefined();
    });

    it('provides options for bank hints and couriers', () => {
      expect(BANK_HINT_OPTIONS.length).toBeGreaterThanOrEqual(10);
      expect(COURIER_OPTIONS.map(c => c.value)).toEqual(['gls', 'mpl', 'mixpack']);
    });
  });
});
