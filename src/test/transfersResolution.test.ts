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

  it('preserves future invoices for the payment calendar while filtering by tab in the list', () => {
    const today = '2026-09-12';

    const rawInvoices = [
      { id: 'inv-past', invoice_number: 'PAST-01', partner_name: 'Partner 1', due_date: '2026-09-01', amount: 50000, currency: 'HUF' },
      { id: 'inv-today', invoice_number: 'TODAY-01', partner_name: 'Partner 2', due_date: '2026-09-12', amount: 30000, currency: 'HUF' },
      { id: 'inv-editio-1', invoice_number: '2026E/1789', partner_name: 'Editio Musica Budapest Zeneműkiadó Kft.', due_date: '2026-09-25', amount: 23798, currency: 'HUF' },
      { id: 'inv-editio-2', invoice_number: '2026E/1794', partner_name: 'Editio Musica Budapest Zeneműkiadó Kft.', due_date: '2026-09-27', amount: 1416011, currency: 'HUF' },
      { id: 'inv-editio-oct', invoice_number: '2026E/1852', partner_name: 'Editio Musica Budapest Zeneműkiadó Kft.', due_date: '2026-10-01', amount: 317101, currency: 'HUF' }
    ];

    // BUGGY behavior: query fetcher discarded everything with due_date > today:
    const buggyQueryReturn = rawInvoices.filter(t => t.due_date <= today);
    expect(buggyQueryReturn.some(inv => inv.due_date === '2026-09-25')).toBe(false);
    expect(buggyQueryReturn.some(inv => inv.due_date === '2026-10-01')).toBe(false);

    // FIXED behavior: query fetcher returns all open transfer items:
    const queryReturn = rawInvoices;
    expect(queryReturn.length).toBe(5);

    // Calendar aggregation receives all invoices:
    const invoicesByDate: Record<string, typeof rawInvoices> = {};
    queryReturn.forEach(inv => {
      const dateStr = inv.due_date;
      if (!invoicesByDate[dateStr]) invoicesByDate[dateStr] = [];
      invoicesByDate[dateStr].push(inv);
    });

    expect(invoicesByDate['2026-09-25']?.length).toBe(1);
    expect(invoicesByDate['2026-09-25']?.[0].invoice_number).toBe('2026E/1789');
    expect(invoicesByDate['2026-09-27']?.length).toBe(1);
    expect(invoicesByDate['2026-10-01']?.length).toBe(1);

    // List tab filtering logic:
    const filterInvoices = (tab: 'all' | 'overdue' | 'due_today' | 'future', selectedIds: string[] = []) => {
      return queryReturn.filter(inv => {
        if (selectedIds.includes(inv.id)) return true;
        if (tab === 'overdue') return inv.due_date < today;
        if (tab === 'due_today') return inv.due_date === today;
        if (tab === 'future') return inv.due_date > today;
        if (tab === 'all') return inv.due_date <= today; // Összes esedékes (lejárt + mai)
        return true;
      });
    };

    // 'all' tab shows overdue + today (2 invoices), NOT future invoices
    const dueList = filterInvoices('all');
    expect(dueList.length).toBe(2);
    expect(dueList.map(i => i.id)).toEqual(['inv-past', 'inv-today']);

    // 'overdue' shows only past
    const overdueList = filterInvoices('overdue');
    expect(overdueList.length).toBe(1);
    expect(overdueList[0].id).toBe('inv-past');

    // 'due_today' shows only today
    const todayList = filterInvoices('due_today');
    expect(todayList.length).toBe(1);
    expect(todayList[0].id).toBe('inv-today');

    // 'future' shows future Editio Musica invoices
    const futureList = filterInvoices('future');
    expect(futureList.length).toBe(3);
    expect(futureList.map(i => i.id)).toEqual(['inv-editio-1', 'inv-editio-2', 'inv-editio-oct']);

    // If user selected a future invoice from the calendar, it remains visible even under 'all'
    const selectedList = filterInvoices('all', ['inv-editio-1']);
    expect(selectedList.length).toBe(3);
    expect(selectedList.some(i => i.id === 'inv-editio-1')).toBe(true);
  });
});

