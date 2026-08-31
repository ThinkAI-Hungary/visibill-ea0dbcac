import { describe, it, expect } from 'vitest';
import {
  TAB_SLUGS,
  SLUG_TO_TAB,
  TAB_TO_SLUG,
  type InvoiceTab,
  type NavInvoice,
  type SubmittedInvoice,
} from '../types';
import {
  buildNavToSubmittedMap,
  buildSubmittedToNavMap,
  buildLinkedInvoicesMap,
  resolveLinkedInvoices,
} from '../utils/invoiceRelations';

describe('Invoices Feature Domain Layer', () => {
  describe('Tab Slugs & URL Mapping', () => {
    it('should correctly map all 4 tabs to their URL slugs', () => {
      expect(TAB_TO_SLUG['OUTBOUND']).toBe('outbound_nav');
      expect(TAB_TO_SLUG['INBOUND']).toBe('inbound_nav');
      expect(TAB_TO_SLUG['SUBMITTED_OUTBOUND']).toBe('submitted_outbound');
      expect(TAB_TO_SLUG['SUBMITTED_INBOUND']).toBe('submitted_inbound');
    });

    it('should correctly map URL slugs back to domain tabs', () => {
      expect(SLUG_TO_TAB['outbound_nav']).toBe('OUTBOUND');
      expect(SLUG_TO_TAB['inbound_nav']).toBe('INBOUND');
      expect(SLUG_TO_TAB['submitted_outbound']).toBe('SUBMITTED_OUTBOUND');
      expect(SLUG_TO_TAB['submitted_inbound']).toBe('SUBMITTED_INBOUND');
    });

    it('should maintain bidirectional 1:1 mapping consistency', () => {
      const tabs: InvoiceTab[] = ['OUTBOUND', 'INBOUND', 'SUBMITTED_OUTBOUND', 'SUBMITTED_INBOUND'];
      tabs.forEach((tab) => {
        const slug = TAB_TO_SLUG[tab];
        expect(SLUG_TO_TAB[slug]).toBe(tab);
      });
    });
  });

  describe('Invoice Relations & Matching Map Builder', () => {
    const mockNavInvoices: NavInvoice[] = [
      {
        id: 'nav-1',
        company_id: 'comp-1',
        invoice_number: 'INV-2026-001',
        supplier_name: 'Test Supplier Kft.',
        supplier_tax_number: '12345678-2-42',
        customer_name: 'Our Company Kft.',
        customer_tax_number: '87654321-2-42',
        invoice_issue_date: '2026-01-10',
        invoice_delivery_date: '2026-01-10',
        payment_date: '2026-01-20',
        invoice_net_amount: 100000,
        invoice_gross_amount: 127000,
        invoice_vat_amount: 27000,
        currency: 'HUF',
        invoice_direction: 'INBOUND',
        paid: true,
        payment_method: null,
        invoice_operation: null,
        submitted: null,
        details_fetched: null,
        user_id: null,
        created_at: null,
        fetched_at: null,
        project_id: null,
        category_id: null,
        transaction_id: null,
        supplier_address: null,
        customer_address: null,
      },
    ];

    const mockSubmittedInvoices: SubmittedInvoice[] = [
      {
        id: 'sub-1',
        bizonylatsorszam: 'INV-2026-001',
        elado_nev: 'Test Supplier Kft.',
        vevo_nev: 'Our Company Kft.',
        kibocsatas_datuma: '2026-01-10',
        teljesites_datuma: '2026-01-10',
        adoalap_osszesen: 100000,
        brutto_vegosszeg: 127000,
        afa_osszeg_osszesen: 27000,
        penznem: 'HUF',
        category_id: null,
        project_id: null,
        image_url: null,
        melleklet_url: null,
        invoice_direction: 'INBOUND',
        reference_number: null,
        fizetesi_mod: 'Átutalás',
        invoice_type: 'NORMAL',
      },
    ];

    it('should build accurate navToSubmittedMap when invoice numbers match', () => {
      const map = buildNavToSubmittedMap(mockSubmittedInvoices, mockNavInvoices);
      const matches = map.get('INV-2026-001');
      expect(matches).toBeDefined();
      expect(matches?.length).toBe(1);
      expect(matches?.[0].id).toBe('sub-1');
    });

    it('should build accurate submittedToNavMap when invoice numbers match', () => {
      const map = buildSubmittedToNavMap(mockSubmittedInvoices, mockNavInvoices);
      const matches = map.get('INV-2026-001');
      expect(matches).toBeDefined();
      expect(matches?.length).toBe(1);
      expect(matches?.[0].id).toBe('nav-1');
    });

    it('should resolve hierarchical parent/child linked invoices (advance / storno chains)', () => {
      const advanceInvoice: SubmittedInvoice = {
        id: 'adv-1',
        bizonylatsorszam: 'ELOLEG-001',
        kibocsatas_datuma: '2026-01-05',
        teljesites_datuma: '2026-01-05',
        elado_nev: 'Test Supplier Kft.',
        vevo_nev: 'Our Company Kft.',
        adoalap_osszesen: 50000,
        brutto_vegosszeg: 63500,
        afa_osszeg_osszesen: 13500,
        penznem: 'HUF',
        category_id: null,
        project_id: null,
        image_url: null,
        melleklet_url: null,
        invoice_direction: 'INBOUND',
        reference_number: null,
        fizetesi_mod: null,
        invoice_type: 'ADVANCE',
      };

      const finalInvoice: SubmittedInvoice = {
        id: 'fin-1',
        bizonylatsorszam: 'VEGSZAMLA-001',
        elolegszamla_hivatkozas: 'ELOLEG-001',
        kibocsatas_datuma: '2026-01-20',
        teljesites_datuma: '2026-01-20',
        elado_nev: 'Test Supplier Kft.',
        vevo_nev: 'Our Company Kft.',
        adoalap_osszesen: 50000,
        brutto_vegosszeg: 63500,
        afa_osszeg_osszesen: 13500,
        penznem: 'HUF',
        category_id: null,
        project_id: null,
        image_url: null,
        melleklet_url: null,
        invoice_direction: 'INBOUND',
        reference_number: null,
        fizetesi_mod: null,
        invoice_type: 'FINAL',
      };

      const linkedMap = buildLinkedInvoicesMap([advanceInvoice, finalInvoice], []);
      const linked = resolveLinkedInvoices(finalInvoice, linkedMap);

      expect(linked.length).toBe(1);
      expect(linked[0].id).toBe('adv-1');
      expect(linked[0].relationDirection).toBe('parent');
    });
  });
});
