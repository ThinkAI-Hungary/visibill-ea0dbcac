import { describe, it, expect } from 'vitest';
import huCategories from '@/locales/hu/categories.json';
import hrCategories from '@/locales/hr/categories.json';

describe('Auto Categorize Invoices - Phase 2', () => {
  describe('Localization', () => {
    it('contains all required auto_categorize translation keys in HU locale', () => {
      expect(huCategories.auto_categorize).toBe('Automatikus kategorizálás');
      expect(huCategories.auto_categorize_in_progress).toBe('Kategorizálás folyamatban...');
      expect(huCategories.auto_categorize_success).toContain('{{count}}');
      expect(huCategories.auto_categorize_none).toBeDefined();
      expect(huCategories.auto_categorize_error).toBeDefined();
    });

    it('contains all required auto_categorize translation keys in HR locale', () => {
      expect(hrCategories.auto_categorize).toBe('Automatsko kategoriziranje');
      expect(hrCategories.auto_categorize_in_progress).toBe('Kategoriziranje u tijeku...');
      expect(hrCategories.auto_categorize_success).toContain('{{count}}');
      expect(hrCategories.auto_categorize_none).toBeDefined();
      expect(hrCategories.auto_categorize_error).toBeDefined();
    });
  });

  describe('Candidate Ingestion and Deduplication Logic', () => {
    interface Candidate {
      invoice_number: string;
      invoice_ids: string[];
      nav_invoice_ids: string[];
      supplier_name: string;
      direction: string;
      gross_amount: number | null;
      currency: string;
      issue_date: string;
      items_summary?: string;
    }

    it('filters strictly for INBOUND uncategorized invoices and deduplicates across tables', () => {
      // Mock raw rows from invoices and nav_invoices tables
      const mockUploaded = [
        // Valid INBOUND uncategorized
        { id: 'inv-1', bizonylatsorszam: 'VIZ-2024-001', invoice_direction: 'INBOUND', elado_nev: 'Dunántúli Regionális Vízmű Zrt.', brutto_vegosszeg: 15400, penznem: 'HUF', kibocsatas_datuma: '2024-05-10', category_id: null },
        // OUTBOUND - must be excluded
        { id: 'inv-2', bizonylatsorszam: 'OUT-2024-001', invoice_direction: 'OUTBOUND', elado_nev: 'Taxology Kft.', brutto_vegosszeg: 50000, penznem: 'HUF', kibocsatas_datuma: '2024-05-11', category_id: null },
        // Already categorized - must be excluded
        { id: 'inv-3', bizonylatsorszam: 'ALREADY-CAT', invoice_direction: 'INBOUND', elado_nev: 'Google Cloud', brutto_vegosszeg: 22000, penznem: 'HUF', kibocsatas_datuma: '2024-05-12', category_id: 'cat-it' },
      ];

      const mockNav = [
        // Same invoice as inv-1 in nav_invoices
        { id: 'nav-1', invoice_number: 'VIZ-2024-001', invoice_direction: 'INBOUND', supplier_name: 'Dunántúli Regionális Vízmű Zrt.', invoice_gross_amount: 15400, invoice_issue_date: '2024-05-10', category_id: null },
        // NAV only INBOUND uncategorized
        { id: 'nav-2', invoice_number: 'ELMU-2024-99', invoice_direction: 'INBOUND', supplier_name: 'MVM Next Energiakereskedelmi Zrt.', invoice_gross_amount: 43200, invoice_issue_date: '2024-05-15', category_id: null },
        // NAV OUTBOUND - must be excluded
        { id: 'nav-3', invoice_number: 'NAV-OUT-1', invoice_direction: 'OUTBOUND', supplier_name: 'Customer X', invoice_gross_amount: 100000, invoice_issue_date: '2024-05-16', category_id: null },
      ];

      // Simulate the deduplication and filtering algorithm of the Edge Function
      const candidatesMap = new Map<string, Candidate>();

      for (const inv of mockUploaded) {
        if (inv.category_id !== null) continue;
        if (inv.invoice_direction !== 'INBOUND') continue;
        const key = (inv.bizonylatsorszam || '').trim();
        if (!key) continue;

        candidatesMap.set(key, {
          invoice_number: key,
          invoice_ids: [inv.id],
          nav_invoice_ids: [],
          supplier_name: inv.elado_nev || '',
          direction: inv.invoice_direction,
          gross_amount: inv.brutto_vegosszeg,
          currency: inv.penznem || 'HUF',
          issue_date: inv.kibocsatas_datuma || '',
        });
      }

      for (const nav of mockNav) {
        if (nav.category_id !== null) continue;
        if (nav.invoice_direction !== 'INBOUND') continue;
        const key = (nav.invoice_number || '').trim();
        if (!key) continue;

        if (candidatesMap.has(key)) {
          candidatesMap.get(key)!.nav_invoice_ids.push(nav.id);
        } else {
          candidatesMap.set(key, {
            invoice_number: key,
            invoice_ids: [],
            nav_invoice_ids: [nav.id],
            supplier_name: nav.supplier_name || '',
            direction: nav.invoice_direction,
            gross_amount: nav.invoice_gross_amount,
            currency: 'HUF',
            issue_date: nav.invoice_issue_date || '',
          });
        }
      }

      const candidates = Array.from(candidatesMap.values());

      // Assertions
      expect(candidates).toHaveLength(2); // Only VIZ-2024-001 and ELMU-2024-99
      
      const vizCandidate = candidates.find(c => c.invoice_number === 'VIZ-2024-001');
      expect(vizCandidate).toBeDefined();
      expect(vizCandidate?.invoice_ids).toEqual(['inv-1']);
      expect(vizCandidate?.nav_invoice_ids).toEqual(['nav-1']);
      expect(vizCandidate?.supplier_name).toBe('Dunántúli Regionális Vízmű Zrt.');

      const mvmCandidate = candidates.find(c => c.invoice_number === 'ELMU-2024-99');
      expect(mvmCandidate).toBeDefined();
      expect(mvmCandidate?.invoice_ids).toEqual([]);
      expect(mvmCandidate?.nav_invoice_ids).toEqual(['nav-2']);

      // Ensure outbound or categorized were NOT included
      expect(candidates.some(c => c.invoice_number === 'OUT-2024-001')).toBe(false);
      expect(candidates.some(c => c.invoice_number === 'ALREADY-CAT')).toBe(false);
      expect(candidates.some(c => c.invoice_number === 'NAV-OUT-1')).toBe(false);
    });
  });

  describe('AI Classification Result Resolution', () => {
    it('correctly maps valid categories and ignores invalid or unknown category IDs', () => {
      const availableCategories = [
        { id: 'cat-kozugy', name: 'Közüzemi díjak' },
        { id: 'cat-it', name: 'IT és szoftver' },
        { id: 'cat-konyveles', name: 'Könyvelés' },
      ];
      const validCategoryIds = new Set(availableCategories.map(c => c.id));

      const aiResponse = [
        { invoice_number: 'VIZ-2024-001', category_id: 'cat-kozugy', confidence: 0.95 },
        { invoice_number: 'UNKNOWN-INV', category_id: 'non-existent-cat-id', confidence: 0.8 },
        { invoice_number: 'ELMU-2024-99', category_id: 'cat-kozugy', confidence: 0.99 },
      ];

      const validAssignments = aiResponse.filter(
        item => validCategoryIds.has(item.category_id)
      );

      expect(validAssignments).toHaveLength(2);
      expect(validAssignments.map(v => v.invoice_number)).toEqual(['VIZ-2024-001', 'ELMU-2024-99']);
      expect(validAssignments.every(v => v.category_id === 'cat-kozugy')).toBe(true);
    });
  });

  describe('Forced Recategorization (forceInvoiceIds / forceRecategorizeIds)', () => {
    it('includes already categorized invoices when their ID is in forcedIds and allows overwriting', () => {
      const mockInvoices = [
        { id: 'inv-already-cat', bizonylatsorszam: 'FORCE-001', invoice_direction: 'INBOUND', category_id: 'cat-old' },
        { id: 'inv-regular-uncat', bizonylatsorszam: 'REG-001', invoice_direction: 'INBOUND', category_id: null },
        { id: 'inv-protected-cat', bizonylatsorszam: 'KEEP-001', invoice_direction: 'INBOUND', category_id: 'cat-keep' },
      ];

      const forcedIds = ['inv-already-cat'];
      const forcedIdSet = new Set(forcedIds);

      // Filtering logic: uncat OR explicitly forced
      const candidates = mockInvoices.filter(inv => {
        if (forcedIdSet.has(inv.id)) return true;
        return inv.category_id === null;
      });

      expect(candidates).toHaveLength(2);
      expect(candidates.map(c => c.id)).toContain('inv-already-cat');
      expect(candidates.map(c => c.id)).toContain('inv-regular-uncat');
      expect(candidates.map(c => c.id)).not.toContain('inv-protected-cat');

      // Persistence logic: forced items omit .is('category_id', null) guard
      const updates = [
        { id: 'inv-already-cat', category_id: 'cat-new' },
        { id: 'inv-regular-uncat', category_id: 'cat-assigned' },
      ];

      const updateGuards = updates.map(u => ({
        id: u.id,
        protectNull: !forcedIdSet.has(u.id),
      }));

      const forcedUpdate = updateGuards.find(u => u.id === 'inv-already-cat');
      const regularUpdate = updateGuards.find(u => u.id === 'inv-regular-uncat');

      expect(forcedUpdate?.protectNull).toBe(false); // Can overwrite
      expect(regularUpdate?.protectNull).toBe(true);  // Protected by is('category_id', null)
    });
  });
});
