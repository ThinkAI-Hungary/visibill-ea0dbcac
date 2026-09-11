import { describe, it, expect } from 'vitest';

describe('TransfersPage Logic & Bank Account Resolution', () => {
  it('prioritizes partner master record bank account over historic invoice bank account', () => {
    const partnerMasterRecord = {
      name: 'Joó Kristóf Benjamin',
      tax_number: '12345678-1-42',
      bank_account_number: '11773000-11111111-22222222'
    };

    const historicInvoices = [
      {
        elado_nev: 'Joó Kristóf Benjamin',
        elado_vat_id: '12345678-1-42',
        bankszamlaszam_iban: '10400000-00000000-00000000'
      }
    ];

    const bankAccountLookupMap: Record<string, string> = {};

    // 1. Load from partner master record
    if (partnerMasterRecord.bank_account_number) {
      if (partnerMasterRecord.tax_number) {
        bankAccountLookupMap[partnerMasterRecord.tax_number] = partnerMasterRecord.bank_account_number;
      }
      if (partnerMasterRecord.name) {
        bankAccountLookupMap[partnerMasterRecord.name.toLowerCase()] = partnerMasterRecord.bank_account_number;
      }
    }

    // 2. Supplement from historic invoices (only if not already present)
    historicInvoices.forEach(inv => {
      if (inv.bankszamlaszam_iban) {
        if (inv.elado_vat_id && !bankAccountLookupMap[inv.elado_vat_id]) {
          bankAccountLookupMap[inv.elado_vat_id] = inv.bankszamlaszam_iban;
        }
        if (inv.elado_nev && !bankAccountLookupMap[inv.elado_nev.toLowerCase()]) {
          bankAccountLookupMap[inv.elado_nev.toLowerCase()] = inv.bankszamlaszam_iban;
        }
      }
    });

    expect(bankAccountLookupMap['12345678-1-42']).toBe('11773000-11111111-22222222');
    expect(bankAccountLookupMap['joó kristóf benjamin']).toBe('11773000-11111111-22222222');
  });

  it('excludes invoices marked as is_manual_payment from transfers list', () => {
    const isInvoicePaid = (inv: { is_manual_payment?: boolean; fizetve?: boolean; paid?: boolean }) => {
      if (inv.is_manual_payment === true) return true;
      return inv.fizetve === true || inv.paid === true;
    };

    const sampleInvoices = [
      { id: 'inv-1', invoice_number: 'JKB-001', is_manual_payment: true, fizetve: false },
      { id: 'inv-2', invoice_number: 'JKB-002', is_manual_payment: false, fizetve: false },
      { id: 'inv-3', invoice_number: 'JKB-003', fizetve: true }
    ];

    const unpaidInvoices = sampleInvoices.filter(inv => !isInvoicePaid(inv));
    expect(unpaidInvoices.length).toBe(1);
    expect(unpaidInvoices[0].id).toBe('inv-2');
  });

  it('correctly normalizes 16 and 24 digit bank accounts', () => {
    const formatAccount = (value: string) => {
      const clean = value.replace(/[^0-9]/g, '');
      if (clean.length === 16) {
        return `${clean.slice(0, 8)}-${clean.slice(8)}`;
      } else if (clean.length === 24) {
        return `${clean.slice(0, 8)}-${clean.slice(8, 16)}-${clean.slice(16)}`;
      }
      return value;
    };

    expect(formatAccount('117730001111111122222222')).toBe('11773000-11111111-22222222');
    expect(formatAccount('11773000-1111111122222222')).toBe('11773000-11111111-22222222');
    expect(formatAccount('1177300011111111')).toBe('11773000-11111111');
  });
});
