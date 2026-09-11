import { describe, it, expect } from 'vitest';
import { differenceInDays, parseISO, format } from 'date-fns';
import { getCategory } from '@/lib/kintlevo-helpers';
import type { UnifiedInvoice } from '@/lib/kintlevo-helpers';

// Filter logic extracted from useKintlevoData rawInvoices useMemo
function processRawInvoices({
  navInvoices,
  manualInvoices,
  settledInvoiceIds,
  today = new Date('2026-09-11T00:00:00.000Z'),
}: {
  navInvoices: any[];
  manualInvoices: any[];
  settledInvoiceIds: Set<string>;
  today?: Date;
}): UnifiedInvoice[] {
  const result: UnifiedInvoice[] = [];

  for (const inv of navInvoices) {
    if (inv.paid === true) continue;
    if (inv.payment_method === 'CASH') continue;
    if (inv.is_manual_payment === true) continue;
    if (settledInvoiceIds.has(inv.id)) continue;

    let dueDate: Date;
    if (inv.payment_date) {
      dueDate = parseISO(inv.payment_date);
    } else if (inv.invoice_issue_date) {
      dueDate = parseISO(inv.invoice_issue_date);
      dueDate.setDate(dueDate.getDate() + 30);
    } else {
      dueDate = new Date(today);
    }
    dueDate.setHours(0, 0, 0, 0);
    const daysOverdue = differenceInDays(today, dueDate);
    result.push({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      issueDate: inv.invoice_issue_date,
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      amount: inv.invoice_gross_amount ?? 0,
      netAmount: inv.invoice_net_amount ?? 0,
      currency: inv.currency ?? 'HUF',
      companyName: inv.customer_name ?? 'Ismeretlen partner',
      taxNumber: inv.customer_tax_number,
      source: 'nav',
      attachmentUrl: null,
      daysOverdue,
      category: getCategory(daysOverdue),
    });
  }

  for (const inv of manualInvoices) {
    if (inv.fizetve === true) continue;
    const isCash =
      inv.fizetesi_mod &&
      (inv.fizetesi_mod.toLowerCase().includes('készpénz') ||
        inv.fizetesi_mod.toLowerCase() === 'cash');
    if (isCash) continue;
    if (inv.is_manual_payment === true) continue;
    if (settledInvoiceIds.has(inv.id)) continue;

    let dueDate: Date;
    if (inv.fizetesi_hatarido) {
      dueDate = parseISO(inv.fizetesi_hatarido);
    } else if (inv.kibocsatas_datuma) {
      dueDate = parseISO(inv.kibocsatas_datuma);
      dueDate.setDate(dueDate.getDate() + 30);
    } else {
      dueDate = new Date(today);
    }
    dueDate.setHours(0, 0, 0, 0);
    const daysOverdue = differenceInDays(today, dueDate);
    result.push({
      id: inv.id,
      invoiceNumber: inv.bizonylatsorszam,
      issueDate: inv.kibocsatas_datuma,
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      amount: inv.brutto_vegosszeg ?? 0,
      netAmount: inv.adoalap_osszesen ?? 0,
      currency: inv.penznem ?? 'HUF',
      companyName: inv.vevo_nev ?? 'Ismeretlen partner',
      taxNumber: inv.vevo_vat_id,
      source: 'manual',
      attachmentUrl: inv.melleklet_url ?? null,
      daysOverdue,
      category: getCategory(daysOverdue),
    });
  }

  return result;
}

describe('Kintlevo Exclusions Logic', () => {
  it('excludes cash invoices (BLX Films case)', () => {
    const navInvoices = [
      {
        id: 'nav-cash-1',
        invoice_number: 'VMusic00325/2026',
        invoice_issue_date: '2026-08-01',
        payment_date: '2026-08-10',
        customer_name: 'BLX Films Kft.',
        customer_tax_number: '12345678-2-41',
        invoice_gross_amount: 150000,
        invoice_net_amount: 118110,
        currency: 'HUF',
        paid: true,
        payment_method: 'CASH',
        is_manual_payment: false,
      },
      {
        id: 'nav-unpaid-1',
        invoice_number: 'VMusic00326/2026',
        invoice_issue_date: '2026-08-01',
        payment_date: '2026-08-15',
        customer_name: 'Unpaid Partner Kft.',
        customer_tax_number: '87654321-2-41',
        invoice_gross_amount: 200000,
        invoice_net_amount: 157480,
        currency: 'HUF',
        paid: false,
        payment_method: 'TRANSFER',
        is_manual_payment: false,
      },
    ];

    const result = processRawInvoices({
      navInvoices,
      manualInvoices: [],
      settledInvoiceIds: new Set(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('nav-unpaid-1');
    expect(result[0].companyName).toBe('Unpaid Partner Kft.');
  });

  it('excludes invoices settled by courier reports or multi-match', () => {
    const navInvoices = [
      {
        id: 'nav-courier-1',
        invoice_number: 'VMusic00100/2026',
        invoice_issue_date: '2026-07-20',
        payment_date: '2026-08-05',
        customer_name: 'Hadrik Partner',
        invoice_gross_amount: 78960,
        invoice_net_amount: 62173,
        currency: 'HUF',
        paid: false,
        payment_method: 'OTHER',
        is_manual_payment: false,
      },
      {
        id: 'nav-open-1',
        invoice_number: 'VMusic00101/2026',
        invoice_issue_date: '2026-07-20',
        payment_date: '2026-08-05',
        customer_name: 'Open Partner',
        invoice_gross_amount: 50000,
        invoice_net_amount: 39370,
        currency: 'HUF',
        paid: false,
        payment_method: 'TRANSFER',
        is_manual_payment: false,
      },
    ];

    const settledInvoiceIds = new Set(['nav-courier-1']);

    const result = processRawInvoices({
      navInvoices,
      manualInvoices: [],
      settledInvoiceIds,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('nav-open-1');
  });

  it('excludes manual invoices marked as cash or paid or manual payment', () => {
    const manualInvoices = [
      {
        id: 'man-cash-1',
        bizonylatsorszam: 'MAN-001',
        kibocsatas_datuma: '2026-08-01',
        fizetesi_hatarido: '2026-08-10',
        vevo_nev: 'Cash Manual Partner',
        brutto_vegosszeg: 30000,
        adoalap_osszesen: 23622,
        penznem: 'HUF',
        fizetve: false,
        fizetesi_mod: 'Készpénz',
        is_manual_payment: false,
      },
      {
        id: 'man-paid-1',
        bizonylatsorszam: 'MAN-002',
        kibocsatas_datuma: '2026-08-01',
        fizetesi_hatarido: '2026-08-10',
        vevo_nev: 'Paid Manual Partner',
        brutto_vegosszeg: 45000,
        adoalap_osszesen: 35433,
        penznem: 'HUF',
        fizetve: true,
        fizetesi_mod: 'Átutalás',
        is_manual_payment: false,
      },
      {
        id: 'man-open-1',
        bizonylatsorszam: 'MAN-003',
        kibocsatas_datuma: '2026-08-01',
        fizetesi_hatarido: '2026-08-10',
        vevo_nev: 'Open Manual Partner',
        brutto_vegosszeg: 90000,
        adoalap_osszesen: 70866,
        penznem: 'HUF',
        fizetve: false,
        fizetesi_mod: 'Átutalás',
        is_manual_payment: false,
      },
    ];

    const result = processRawInvoices({
      navInvoices: [],
      manualInvoices,
      settledInvoiceIds: new Set(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('man-open-1');
  });
});
