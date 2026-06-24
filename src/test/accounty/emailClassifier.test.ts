import { describe, it, expect } from 'vitest';

/**
 * Pure-logic tests for the email attachment classifier and bank hint detector.
 * These functions are defined inline in the edge function; we replicate them here
 * so the classification logic can be tested without a Deno / Edge Function runtime.
 */

// ── Replicated from process-mailgun-webhook/index.ts ──

const TRANSACTION_FILENAME_KEYWORDS = [
  'tranzakci', 'bankszámlakivonat', 'számlakivonat', 'kivonat',
  'forgalmi', 'statement', 'account_statement', 'bank_statement',
];
const TRANSACTION_SUBJECT_KEYWORDS = [
  'tranzakció', 'tranzakciós', 'kivonat', 'számlakivonat',
  'forgalmi', 'bank statement', 'account statement',
];

function classifyAttachment(attachmentName: string, emailSubject: string | null): 'invoice' | 'transaction' {
  const fn = attachmentName.toLowerCase();
  const ext = fn.substring(fn.lastIndexOf('.'));

  // 1. Extension-based (100% certain)
  if (['.xlsx', '.xls', '.csv', '.mt940', '.sta'].includes(ext)) {
    return 'transaction';
  }

  // Only apply heuristics to PDFs
  if (ext !== '.pdf') return 'invoice';

  // 2. Filename keywords (normalized — remove diacritics for matching)
  const fnNorm = fn.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (TRANSACTION_FILENAME_KEYWORDS.some(kw => {
    const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return fnNorm.includes(kwNorm);
  })) {
    return 'transaction';
  }

  // 3. IBAN pattern in filename (HU + 24-26 digits)
  if (/hu\d{24,26}/i.test(fn.replace(/[^a-z0-9]/gi, ''))) {
    return 'transaction';
  }

  // 4. OTP numeric pattern: long digits + __NNN-YYYY
  if (/^\d{10,}.*__\d{3}-\d{4}/.test(fn)) {
    return 'transaction';
  }

  // 5. Email subject keywords (fallback for PDFs)
  if (emailSubject) {
    const subj = emailSubject.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (TRANSACTION_SUBJECT_KEYWORDS.some(kw => {
      const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return subj.includes(kwNorm);
    })) {
      return 'transaction';
    }
  }

  // 6. Default
  return 'invoice';
}

function detectBankHint(attachmentName: string): string | null {
  const fn = attachmentName.toLowerCase();
  if (fn.includes('otp')) return 'otp';
  if (fn.includes('cib')) return 'cib';
  if (fn.includes('k&h') || fn.includes('kh_') || fn.includes('k_h')) return 'kh';
  if (fn.includes('raiffeisen')) return 'raiffeisen';
  if (fn.includes('erste')) return 'erste';
  if (fn.includes('mkb')) return 'mkb';
  if (fn.includes('unicredit')) return 'unicredit';
  if (fn.includes('gránit') || fn.includes('granit')) return 'granit';
  if (fn.includes('budapest bank') || fn.includes('bb_')) return 'budapest_bank';
  // OTP-specific pattern: long numeric filename with __NNN-YYYY
  if (/^\d{10,}.*__\d{3}-\d{4}/.test(fn)) return 'otp';
  return null;
}

// ── Tests ──

describe('classifyAttachment', () => {
  describe('Extension-based classification (always transaction)', () => {
    it('.xlsx → transaction', () => {
      expect(classifyAttachment('Szepkartya - 05 Május (1).xlsx', null)).toBe('transaction');
    });

    it('.xls → transaction', () => {
      expect(classifyAttachment('otp_tranzakciok_2026.xls', null)).toBe('transaction');
    });

    it('.csv → transaction', () => {
      expect(classifyAttachment('bank_export_2026.csv', null)).toBe('transaction');
    });

    it('.mt940 → transaction', () => {
      expect(classifyAttachment('MT940_2026_06.mt940', null)).toBe('transaction');
    });

    it('.sta → transaction', () => {
      expect(classifyAttachment('statement_june.sta', null)).toBe('transaction');
    });
  });

  describe('PDF filename keyword heuristics', () => {
    it('"Tranzakciós jelentés_HU47...pdf" → transaction (tranzakci keyword)', () => {
      expect(classifyAttachment('Tranzakciós jelentés_HU47107015207486773851100005-9.pdf', null)).toBe('transaction');
    });

    it('"CIB_Bankszámlakivonat-6.pdf" → transaction (bankszámlakivonat keyword)', () => {
      expect(classifyAttachment('CIB_Bankszámlakivonat-6.pdf', null)).toBe('transaction');
    });

    it('"Forgalmi_kimutatás_2026_05.pdf" → transaction (forgalmi keyword)', () => {
      expect(classifyAttachment('Forgalmi_kimutatás_2026_05.pdf', null)).toBe('transaction');
    });

    it('"account_statement_june.pdf" → transaction (account_statement keyword)', () => {
      expect(classifyAttachment('account_statement_june_2026.pdf', null)).toBe('transaction');
    });

    it('"Számlakivonat_2026.pdf" → transaction (számlakivonat keyword)', () => {
      expect(classifyAttachment('Számlakivonat_2026.pdf', null)).toBe('transaction');
    });

    it('"Kivonat_OTP_junius.pdf" → transaction (kivonat keyword)', () => {
      expect(classifyAttachment('Kivonat_OTP_junius.pdf', null)).toBe('transaction');
    });
  });

  describe('PDF IBAN pattern detection', () => {
    it('"Tranzakciós jelentés_HU47107015207486773851100005 (1).pdf" → transaction (IBAN)', () => {
      expect(classifyAttachment('Tranzakciós jelentés_HU47107015207486773851100005 (1).pdf', null)).toBe('transaction');
    });
  });

  describe('PDF OTP numeric pattern', () => {
    it('"1780480774894-1171301221452251__004-2026_.pdf" → transaction (OTP pattern)', () => {
      expect(classifyAttachment('1780480774894-1171301221452251__004-2026_.pdf', null)).toBe('transaction');
    });
  });

  describe('Email subject fallback (for generic PDF filenames)', () => {
    it('generic.pdf + subject "Tranzakciós lista" → transaction', () => {
      expect(classifyAttachment('document_2026_06.pdf', 'Tranzakciós lista - OTP Bank')).toBe('transaction');
    });

    it('generic.pdf + subject "Számlakivonat - CIB" → transaction', () => {
      expect(classifyAttachment('doc123.pdf', 'Számlakivonat - CIB Bank')).toBe('transaction');
    });

    it('generic.pdf + subject "Bank statement June 2026" → transaction', () => {
      expect(classifyAttachment('report.pdf', 'Bank statement June 2026')).toBe('transaction');
    });

    it('generic.pdf + subject "Forgalmi kimutatás" → transaction', () => {
      expect(classifyAttachment('export.pdf', 'Forgalmi kimutatás - MKB')).toBe('transaction');
    });

    it('generic.pdf + no matching subject → invoice', () => {
      expect(classifyAttachment('document.pdf', 'Kedves Ügyfél! Mellékelem a számlát.')).toBe('invoice');
    });

    it('generic.pdf + null subject → invoice', () => {
      expect(classifyAttachment('doc.pdf', null)).toBe('invoice');
    });
  });

  describe('Default → invoice', () => {
    it('"szamla_2026_0543.pdf" → invoice', () => {
      expect(classifyAttachment('szamla_2026_0543.pdf', null)).toBe('invoice');
    });

    it('"ÁFA_bevallás_minta_2665 02.hó.pdf" → invoice', () => {
      expect(classifyAttachment('ÁFA_bevallás_minta_2665 02.hó.pdf', null)).toBe('invoice');
    });

    it('"invoice_2026_06_123.pdf" → invoice', () => {
      expect(classifyAttachment('invoice_2026_06_123.pdf', null)).toBe('invoice');
    });

    it('"SZÁMLA_ABC_Kft_2026.pdf" → invoice', () => {
      expect(classifyAttachment('SZÁMLA_ABC_Kft_2026.pdf', null)).toBe('invoice');
    });

    it('"foto_bonnebon.jpg" → invoice (non-PDF, non-spreadsheet)', () => {
      expect(classifyAttachment('foto_bonnebon.jpg', null)).toBe('invoice');
    });

    it('"screenshot.png" → invoice', () => {
      expect(classifyAttachment('screenshot.png', null)).toBe('invoice');
    });
  });
});

describe('detectBankHint', () => {
  it('"CIB_Bankszámlakivonat-6.pdf" → cib', () => {
    expect(detectBankHint('CIB_Bankszámlakivonat-6.pdf')).toBe('cib');
  });

  it('"OTP_tranzakciok_2026_06.xlsx" → otp', () => {
    expect(detectBankHint('OTP_tranzakciok_2026_06.xlsx')).toBe('otp');
  });

  it('"1780480774894-1171301221452251__004-2026_.pdf" → otp (numeric pattern)', () => {
    expect(detectBankHint('1780480774894-1171301221452251__004-2026_.pdf')).toBe('otp');
  });

  it('"K&H_kivonat_2026.pdf" → kh', () => {
    expect(detectBankHint('K&H_kivonat_2026.pdf')).toBe('kh');
  });

  it('"KH_statement.csv" → kh', () => {
    expect(detectBankHint('KH_statement.csv')).toBe('kh');
  });

  it('"Raiffeisen_forgalom_2026.pdf" → raiffeisen', () => {
    expect(detectBankHint('Raiffeisen_forgalom_2026.pdf')).toBe('raiffeisen');
  });

  it('"Erste_bank_kivonat.pdf" → erste', () => {
    expect(detectBankHint('Erste_bank_kivonat.pdf')).toBe('erste');
  });

  it('"MKB_tranzakciok.xlsx" → mkb', () => {
    expect(detectBankHint('MKB_tranzakciok.xlsx')).toBe('mkb');
  });

  it('"UniCredit_statement.pdf" → unicredit', () => {
    expect(detectBankHint('UniCredit_statement.pdf')).toBe('unicredit');
  });

  it('"Gránit_bank_kivonat.pdf" → granit', () => {
    expect(detectBankHint('Gránit_bank_kivonat.pdf')).toBe('granit');
  });

  it('"BB_tranzakciok_2026.xlsx" → budapest_bank', () => {
    expect(detectBankHint('BB_tranzakciok_2026.xlsx')).toBe('budapest_bank');
  });

  it('"szamla_2026.pdf" → null (no bank detected)', () => {
    expect(detectBankHint('szamla_2026.pdf')).toBeNull();
  });

  it('"Tranzakciós jelentés_HU47107015207486773851100005-9.pdf" → null (no bank name)', () => {
    expect(detectBankHint('Tranzakciós jelentés_HU47107015207486773851100005-9.pdf')).toBeNull();
  });
});
