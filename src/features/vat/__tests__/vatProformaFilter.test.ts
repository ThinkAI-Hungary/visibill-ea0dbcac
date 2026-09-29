import { describe, it, expect } from 'vitest';
import {
  isProformaInvoice,
  PROFORMA_INVOICE_TYPES,
  isAamPartnerOrTaxNumber,
  isInsurancePartnerOrInvoice,
  shouldExcludeFromMLine,
} from '../types';

describe('VAT Proforma / Díjbekérő Exclusion Filter', () => {
  it('identifies explicit proforma invoice_type values correctly', () => {
    expect(isProformaInvoice({ invoice_type: 'dijbekero_proforma', bizonylatsorszam: 'D-THINK-137' })).toBe(true);
    expect(isProformaInvoice({ invoice_type: 'dijbekero', bizonylatsorszam: 'DIJB-001' })).toBe(true);
    expect(isProformaInvoice({ invoice_type: 'proforma', bizonylatsorszam: 'PROF-2026' })).toBe(true);
    expect(isProformaInvoice({ invoice_type: 'garanciajegy', bizonylatsorszam: 'GAR-123' })).toBe(true);
  });

  it('identifies proforma from bizonylatsorszam when invoice_type is generic or missing', () => {
    expect(isProformaInvoice({ bizonylatsorszam: 'PROFORMA/81329/1' })).toBe(true);
    expect(isProformaInvoice({ bizonylatsorszam: '1/PRED/1' })).toBe(true);
    expect(isProformaInvoice({ bizonylatsorszam: 'dijbekero-2026/01' })).toBe(true);
    expect(isProformaInvoice({ bizonylatsorszam: 'Díjbekérő_44' })).toBe(true);
  });

  it('does NOT filter out legitimate tax invoices', () => {
    expect(isProformaInvoice({ invoice_type: 'sima_szla', bizonylatsorszam: 'D-2026-285' })).toBe(false);
    expect(isProformaInvoice({ invoice_type: 'sima_szla', bizonylatsorszam: 'INV-2026-001' })).toBe(false);
    expect(isProformaInvoice({ invoice_type: 'vegszamla', bizonylatsorszam: 'V-2026-10' })).toBe(false);
    expect(isProformaInvoice({ invoice_type: 'elolegszamla', bizonylatsorszam: 'E-2026-05' })).toBe(false);
    expect(isProformaInvoice({ invoice_type: 'egyszerusitett_szla', bizonylatsorszam: 'ESZ-99' })).toBe(false);
    expect(isProformaInvoice({ invoice_type: 'sztorno_szla', bizonylatsorszam: 'ST-01' })).toBe(false);
  });

  it('handles edge cases: null, undefined, empty object', () => {
    expect(isProformaInvoice(null)).toBe(false);
    expect(isProformaInvoice(undefined)).toBe(false);
    expect(isProformaInvoice({})).toBe(false);
  });

  it('excludes D-THINK-137 from reconciliation dataset', () => {
    const mixedInvoices = [
      { id: '1', bizonylatsorszam: 'TR-2026-13', elado_nev: 'Tóth Mária', invoice_type: 'sima_szla' },
      { id: '2', bizonylatsorszam: 'D-THINK-137', elado_nev: 'Think AI Kft.', invoice_type: 'dijbekero_proforma' },
      { id: '3', bizonylatsorszam: 'AA/2026-037512', elado_nev: 'Adriana Automatik Kft.', invoice_type: 'sima_szla' },
      { id: '4', bizonylatsorszam: 'E-THINK-2026-89', elado_nev: 'Think AI Kft.', invoice_type: 'elolegszamla' },
    ];

    const vatEligible = mixedInvoices.filter((inv) => !isProformaInvoice(inv));

    expect(vatEligible).toHaveLength(3);
    expect(vatEligible.some((inv) => inv.bizonylatsorszam === 'D-THINK-137')).toBe(false);
    expect(vatEligible.map((inv) => inv.bizonylatsorszam)).toEqual([
      'TR-2026-13',
      'AA/2026-037512',
      'E-THINK-2026-89',
    ]);
  });
});

describe('VAT M-Line Exclusions: AAM, Proforma and Insurance', () => {
  it('correctly identifies AAM (alanyi adómentes) partners by 9th tax digit (VAT code 1)', () => {
    // 8 digits base, 1 digit vat code, 2 digits county
    expect(isAamPartnerOrTaxNumber('55862930-1-37')).toBe(true);
    expect(isAamPartnerOrTaxNumber('12345678142')).toBe(true);
    expect(isAamPartnerOrTaxNumber('HU55862930-1-37')).toBe(true);
    expect(isAamPartnerOrTaxNumber(null, 'Fazekas Attila EV (alanyi adómentes)')).toBe(true);

    // Standard 2-es áfa-kód (general VAT payer) must NOT be AAM
    expect(isAamPartnerOrTaxNumber('12345678-2-42')).toBe(false);
    expect(isAamPartnerOrTaxNumber('10308024-4-44')).toBe(false);
  });

  it('correctly identifies insurance companies and insurance lines', () => {
    expect(isInsurancePartnerOrInvoice('Generali Biztosító Zrt.')).toBe(true);
    expect(isInsurancePartnerOrInvoice('Allianz Hungária Zrt.')).toBe(true);
    expect(isInsurancePartnerOrInvoice('UNIQA BIZTOSÍTÓ ZRT.')).toBe(true);
    expect(isInsurancePartnerOrInvoice('Groupama Biztosító Zrt.')).toBe(true);
    expect(isInsurancePartnerOrInvoice('K&H Biztosító Zrt.')).toBe(true);
    expect(isInsurancePartnerOrInvoice('Posta Biztosító')).toBe(true);
    expect(isInsurancePartnerOrInvoice(undefined, 'Készülékbiztosítás havidíj')).toBe(true);
    expect(isInsurancePartnerOrInvoice(undefined, 'Gépjármű felelősségbiztosítás')).toBe(true);
    expect(isInsurancePartnerOrInvoice(undefined, 'KGFB díj')).toBe(true);

    // Regular IT / commercial company must NOT be insurance
    expect(isInsurancePartnerOrInvoice('Think AI Kft.', 'Szoftverfejlesztés')).toBe(false);
    expect(isInsurancePartnerOrInvoice('Consult-Union Győr Kft.', 'Tanácsadás')).toBe(false);
  });

  it('shouldExcludeFromMLine blocks AAM, Proforma and Insurance from 65M sheets', () => {
    // Proforma
    expect(shouldExcludeFromMLine({
      partner_name: 'Think AI Kft.',
      invoice_number: 'D-THINK-137',
      invoice_type: 'dijbekero_proforma',
      tax_amount: 27000,
    })).toBe(true);

    // AAM partner
    expect(shouldExcludeFromMLine({
      partner_name: 'Fazekas Attila EV',
      partner_tax_number: '55862930-1-37',
      tax_amount: 0,
    })).toBe(true);

    // Insurance partner
    expect(shouldExcludeFromMLine({
      partner_name: 'Generali Biztosító Zrt.',
      partner_tax_number: '10308024-4-44',
      tax_amount: 0,
    })).toBe(true);

    // Zero VAT non-FAD invoice
    expect(shouldExcludeFromMLine({
      partner_name: 'Random Cég Kft.',
      partner_tax_number: '99999999-2-42',
      tax_amount: 0,
      is_reverse_charge: false,
    })).toBe(true);

    // Legitimate inbound invoice with deductible VAT must PASS
    expect(shouldExcludeFromMLine({
      partner_name: 'Normál Beszállító Kft.',
      partner_tax_number: '12345678-2-42',
      tax_amount: 54000,
    })).toBe(false);

    // Legitimate FAD partner must PASS even if tax_amount on invoice is 0
    expect(shouldExcludeFromMLine({
      partner_name: 'Acélipari FAD Partner Kft.',
      partner_tax_number: '87654321-2-42',
      tax_amount: 0,
      is_reverse_charge: true,
    })).toBe(false);
  });
});

