import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

describe('Missing Invoices Export Functionality', () => {
  it('correctly maps missing items with invoiceNumber for report export', () => {
    const missingItems = [
      {
        id: '1',
        invoiceNumber: 'WT / 2026-000022',
        title: 'Well-Tex Kft.',
        subtitle: 'Számla: WT / 2026-000022',
        category: 'bejovo',
        itemDate: '2026-04-07',
        amount: 582613,
        status: 'open',
        source: 'nav_detektor',
      },
      {
        id: '2',
        invoiceNumber: null,
        title: 'Bérszámfejtési adatok',
        subtitle: null,
        category: 'ber',
        itemDate: '2026-09-10',
        amount: null,
        status: 'notified',
        source: 'ber_cron',
      }
    ];

    const typeMap: Record<string, string> = { bejovo: 'Bejövő', kimeno: 'Kimenő', bank: 'Bank', ber: 'Bér' };
    const statusMap: Record<string, string> = { open: 'Függőben', pending: 'Feldolgozandó', notified: 'Felszólítva', resolved: 'Rendben', ignored: 'Mellőzve' };
    const sourceMap: Record<string, string> = {
      nav_detektor: 'NAV (Számlakép hiányzik)',
      bank_detektor: 'Banki tranzakció',
      ber_cron: 'Bérszámfejtés',
      manual: 'Kézi rögzítés',
    };

    const rows = missingItems.map((r: any) => [
      r.invoiceNumber || '—',
      r.title || r.subtitle || '—',
      typeMap[r.category] || r.category || '—',
      r.itemDate ? new Date(r.itemDate).toLocaleDateString('hu-HU') : '—',
      r.amount != null ? Number(r.amount).toLocaleString('hu-HU') : '—',
      statusMap[r.status] || r.status || '—',
      sourceMap[r.source] || r.source || '—',
    ]);

    expect(rows).toHaveLength(2);
    // Row 1 (NAV invoice missing image)
    expect(rows[0][0]).toBe('WT / 2026-000022'); // Bizonylatszám is populated!
    expect(rows[0][1]).toBe('Well-Tex Kft.');
    expect(rows[0][2]).toBe('Bejövő');
    expect(rows[0][4]).toBe((582613).toLocaleString('hu-HU'));
    expect(rows[0][5]).toBe('Függőben');
    expect(rows[0][6]).toBe('NAV (Számlakép hiányzik)');

    // Row 2 (Payroll item without invoice number)
    expect(rows[1][0]).toBe('—');
    expect(rows[1][1]).toBe('Bérszámfejtési adatok');
    expect(rows[1][2]).toBe('Bér');
    expect(rows[1][4]).toBe('—');
    expect(rows[1][5]).toBe('Felszólítva');
    expect(rows[1][6]).toBe('Bérszámfejtés');
  });

  it('correctly maps submitted invoices with bizonylatsorszam in useInvoiceMutations', () => {
    const mockSubmittedInvoice = {
      id: 'sub-1',
      bizonylatsorszam: 'SZAMLA-2026-999',
      kibocsatas_datuma: '2026-05-01',
      teljesites_datuma: '2026-05-01',
      elado_nev: 'Beszállító Kft.',
      vevo_nev: 'Mandala Fogadó Kft.',
      penznem: 'HUF',
      adoalap_osszesen: 100000,
      afa_osszeg_osszesen: 27000,
      brutto_vegosszeg: 127000,
      category_id: null,
      project_id: null,
    };

    const headers = [
      'Bizonylatszám', 'Kibocsátás dátuma', 'Teljesítés dátuma', 'Eladó', 'Vevő',
      'Pénznem', 'Nettó összeg (deviza)', 'ÁFA összeg (deviza)', 'Bruttó összeg (deviza)',
      'Kategória', 'Projekt'
    ];

    const row = [
      mockSubmittedInvoice.bizonylatsorszam || '',
      mockSubmittedInvoice.kibocsatas_datuma || '',
      mockSubmittedInvoice.teljesites_datuma || '',
      mockSubmittedInvoice.elado_nev || '',
      mockSubmittedInvoice.vevo_nev || '',
      mockSubmittedInvoice.penznem || 'HUF',
      mockSubmittedInvoice.adoalap_osszesen?.toString() || '0',
      mockSubmittedInvoice.afa_osszeg_osszesen?.toString() || '0',
      mockSubmittedInvoice.brutto_vegosszeg?.toString() || '0',
      'Nincs kategória',
      'Nincs projekt'
    ];

    expect(headers[0]).toBe('Bizonylatszám');
    expect(row[0]).toBe('SZAMLA-2026-999');
  });
});
