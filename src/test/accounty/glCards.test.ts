import { describe, it, expect } from 'vitest';
import {
  generateGlAccountCardPdf,
  generateBalanceConfirmationPdf,
  GlAccountCardPdfData,
  BalanceConfirmationPdfData
} from '../../lib/ledgerCardPdfs';

describe('General Ledger & Analytic Cards PDF Generator', () => {
  it('generates a valid landscape G/L Account Card PDF for 3110 Vevők', () => {
    const cardData: GlAccountCardPdfData = {
      companyName: 'Test Könyvelő Kft.',
      companyTaxNumber: '12345678-2-42',
      glNumber: '3110',
      glShortName: 'Belföldi vevők követelései',
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
      openingBalance: 150000,
      totalDebit: 500000,
      totalCredit: 400000,
      closingBalance: 250000,
      items: [
        {
          posting_date: '2026-01-01',
          document_id: 'NYITÓ',
          journal_code: 'NY',
          contra_gl_number: '491',
          contra_gl_name: 'Nyitómérleg számla',
          partner_name: '-',
          description: 'Időszak eleji nyitó egyenleg',
          debit_amount: 150000,
          credit_amount: 0,
          running_balance: 150000,
        },
        {
          posting_date: '2026-03-15',
          document_id: 'INV-2026/001',
          journal_code: 'V',
          contra_gl_number: '9110',
          contra_gl_name: 'Belföldi értékesítés árbevétele',
          partner_name: 'Minta Vevő Kft.',
          description: 'Szoftverfejlesztési szolgáltatás',
          debit_amount: 500000,
          credit_amount: 0,
          running_balance: 650000,
        },
        {
          posting_date: '2026-03-20',
          document_id: 'TR-BANK01',
          journal_code: 'B1',
          contra_gl_number: '3841',
          contra_gl_name: 'Forint elszámolási számla',
          partner_name: 'Minta Vevő Kft.',
          description: 'Számla kiegyenlítés bankban',
          debit_amount: 0,
          credit_amount: 400000,
          running_balance: 250000,
        },
      ],
    };

    const doc = generateGlAccountCardPdf(cardData);
    expect(doc).toBeDefined();
    expect(doc.internal.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(doc.output('blob').size).toBeGreaterThan(1000);
  });

  it('generates a valid Balance Confirmation Letter (Egyenlegközlő levél) PDF', () => {
    const confirmData: BalanceConfirmationPdfData = {
      companyName: 'Test Könyvelő Kft.',
      companyAddress: '1051 Budapest, Fő tér 1.',
      companyTaxNumber: '12345678-2-42',
      partnerName: 'Partner Vevő Kft.',
      partnerAddress: '1111 Budapest, Váci út 12.',
      partnerTaxNumber: '87654321-2-41',
      statementDate: '2026-09-08',
      totalOpenBalance: 250000,
      invoices: [
        {
          document_id: 'INV-2026/088',
          issue_date: '2026-07-01',
          due_date: '2026-07-15',
          original_amount: 250000,
          open_amount: 250000,
          overdue_days: 55,
        },
      ],
    };

    const doc = generateBalanceConfirmationPdf(confirmData);
    expect(doc).toBeDefined();
    expect(doc.internal.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(doc.output('blob').size).toBeGreaterThan(1000);
  });
});
