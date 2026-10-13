import { describe, it, expect } from 'vitest';
import { validateAndResolveItemVat } from '@/lib/invoiceItemVatValidation';

describe('invoiceItemVatValidation - Mathematical Reverse Validation', () => {
  it('detects and auto-corrects truncated OCR VAT amount (Fakov Kft. line 2: 386 Ft -> 4 386 Ft)', () => {
    // Exact data from Fakov Kft. invoice MV00307592 Line 2
    const item = {
      net_amount: 16245,
      gross_amount: 20631,
      vat_amount: 386, // Missing leading '4' due to OCR truncation
      vat_rate: '27%',
    };

    const result = validateAndResolveItemVat(item);

    expect(result.vatAmount).toBe(4386);
    expect(result.grossAmount).toBe(20631);
    expect(result.isAutoCorrected).toBe(true);
    expect(result.hasOcrVatDiscrepancy).toBe(true);
    expect(result.originalVatAmount).toBe(386);
    expect(result.expectedVatAmount).toBe(4386);
    expect(result.reason).toContain('OCR áfa hiba javítva');
  });

  it('keeps accurate items untouched without flagging discrepancies', () => {
    // Normal 27% item (Fakov Kft. line 1)
    const item = {
      net_amount: 4400,
      gross_amount: 5588,
      vat_amount: 1188,
      vat_rate: '27%',
    };

    const result = validateAndResolveItemVat(item);

    expect(result.vatAmount).toBe(1188);
    expect(result.grossAmount).toBe(5588);
    expect(result.isAutoCorrected).toBe(false);
    expect(result.hasOcrVatDiscrepancy).toBe(false);
  });

  it('calculates missing VAT and Gross for utility invoices with only Net and Rate (A-113)', () => {
    const item = {
      net_amount: 10000,
      gross_amount: 0,
      vat_amount: 0,
      vat_rate: '0.27',
    };

    const result = validateAndResolveItemVat(item);

    expect(result.vatAmount).toBe(2700);
    expect(result.grossAmount).toBe(12700);
    expect(result.isAutoCorrected).toBe(true);
    expect(result.hasOcrVatDiscrepancy).toBe(false);
  });

  it('tolerates ±1 Ft rounding differences without false positives', () => {
    // Net: 100 Ft, 27% = 27 Ft, Gross: 127 Ft
    const item = {
      net_amount: 100,
      gross_amount: 127,
      vat_amount: 27,
      vat_rate: '27%',
    };

    const result = validateAndResolveItemVat(item);

    expect(result.vatAmount).toBe(27);
    expect(result.isAutoCorrected).toBe(false);
    expect(result.hasOcrVatDiscrepancy).toBe(false);
  });

  it('handles domestic reverse charge and tax-exempt items correctly', () => {
    const item = {
      net_amount: 50000,
      gross_amount: 50000,
      vat_amount: 0,
      vat_rate: 'FAD',
    };

    const result = validateAndResolveItemVat(item);

    expect(result.vatAmount).toBe(0);
    expect(result.grossAmount).toBe(50000);
    expect(result.hasOcrVatDiscrepancy).toBe(false);
  });

  it('strictly enforces 0 Ft invoice VAT on reverse charge steel items even if OCR misread 27% (Fakov Kft. MV00290684 Line 4)', () => {
    // Exact data from Fakov Kft. invoice MV00290684 Line 4
    const steelItem = {
      line_description: '8mm KORACÉL 6M/SZAL',
      net_amount: 6188,
      gross_amount: 7758, // OCR falsely added 27% VAT
      vat_amount: 1670,   // OCR falsely extracted 27% VAT
      vat_rate: '27%',    // OCR falsely read 27% instead of FAD
      is_reverse_charge: true,
    };

    const result = validateAndResolveItemVat(steelItem);

    // Domestic reverse charge under Áfa tv. 142. § strictly has 0 Ft VAT charged on invoice
    expect(result.vatAmount).toBe(0);
    expect(result.grossAmount).toBe(6188); // Gross must equal Net
    expect(result.isAutoCorrected).toBe(true);
    expect(result.hasOcrVatDiscrepancy).toBe(true);
    expect(result.originalVatAmount).toBe(1670);
    expect(result.expectedVatAmount).toBe(0);
    expect(result.reason).toContain('Fordított adózású tétel (FAD / Acél)');
  });

  it('recovers correct VAT on normal 27% items on a mixed invoice (Fakov Kft. MV00290684 Line 2 OCR 4774 -> 4794)', () => {
    // Line 2: Net 17 755 Ft, Gross 22 549 Ft, OCR read 4774 Ft (should be 4794 Ft)
    const normalItem = {
      line_description: 'PVT 1530 AK 12-NAF CSP21.11/14',
      net_amount: 17755,
      gross_amount: 22549,
      vat_amount: 4774,
      vat_rate: '27%',
      is_reverse_charge: true, // Parent invoice has reverse charge due to steel item
    };

    const result = validateAndResolveItemVat(normalItem);

    // 22 549 - 17 755 = 4 794 Ft
    expect(result.vatAmount).toBe(4794);
    expect(result.grossAmount).toBe(22549);
    expect(result.isAutoCorrected).toBe(true);
    expect(result.hasOcrVatDiscrepancy).toBe(true);
    expect(result.expectedVatAmount).toBe(4794);
  });
});
