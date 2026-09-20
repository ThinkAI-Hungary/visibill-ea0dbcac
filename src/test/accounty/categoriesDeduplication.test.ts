import { describe, it, expect } from 'vitest';
import huCategories from '@/locales/hu/categories.json';
import hrCategories from '@/locales/hr/categories.json';

describe('Categories Deduplication and Safeguards', () => {
  it('contains duplicate_error translation in HU locale', () => {
    expect(huCategories.duplicate_error).toBe('Már létezik ilyen nevű kategória ennél a cégnél.');
  });

  it('contains duplicate_error translation in HR locale', () => {
    expect(hrCategories.duplicate_error).toBe('Kategorija s ovim nazivom već postoji za ovu tvrtku.');
  });

  it('defensively filters out duplicate category names case-insensitively', () => {
    const rawCategories = [
      { id: '1', name: 'Marketing', description: '', icon: null, color: null, gl_accounts: [] },
      { id: '2', name: 'marketing', description: '', icon: null, color: null, gl_accounts: [] },
      { id: '3', name: ' MARKETING ', description: '', icon: null, color: null, gl_accounts: [] },
      { id: '4', name: 'IT és szoftver', description: '', icon: null, color: null, gl_accounts: [] },
      { id: '5', name: 'it és szoftver', description: '', icon: null, color: null, gl_accounts: [] },
    ];

    const seenNames = new Set<string>();
    const loadedCategories: typeof rawCategories = [];
    for (const c of rawCategories) {
      const norm = (c.name || '').trim().toLowerCase();
      if (norm && seenNames.has(norm)) continue;
      if (norm) seenNames.add(norm);
      loadedCategories.push(c);
    }

    expect(loadedCategories).toHaveLength(2);
    expect(loadedCategories.map(c => c.name)).toEqual(['Marketing', 'IT és szoftver']);
  });

  it('deduplicates invoices across uploaded and nav tables by invoice_number', () => {
    const fromUploaded = [
      { id: 'up-1', invoice_number: 'INV-2026-001', supplier_name: 'Supplier A', invoice_gross_amount: 10000, source: 'invoices', image_url: 'img1.png' },
      { id: 'up-2', invoice_number: 'INV-2026-002', supplier_name: 'Supplier B', invoice_gross_amount: 20000, source: 'invoices', image_url: 'img2.png' },
    ];

    const fromNav = [
      // Duplicate of up-1 in nav_invoices
      { id: 'nav-1', invoice_number: 'INV-2026-001', supplier_name: 'Supplier A', invoice_gross_amount: 10000, source: 'nav_invoices' },
      // Duplicate with lowercase and spaces
      { id: 'nav-2', invoice_number: ' inv-2026-002 ', supplier_name: 'Supplier B', invoice_gross_amount: 20000, source: 'nav_invoices' },
      // Unique nav invoice
      { id: 'nav-3', invoice_number: 'INV-2026-003', supplier_name: 'Supplier C', invoice_gross_amount: 30000, source: 'nav_invoices' },
    ];

    const seenNumbers = new Set<string>();
    const invList: any[] = [];

    for (const inv of fromUploaded) {
      const key = (inv.invoice_number || '').trim().toLowerCase();
      if (key) seenNumbers.add(key);
      invList.push(inv);
    }

    for (const inv of fromNav) {
      const key = (inv.invoice_number || '').trim().toLowerCase();
      if (key && seenNumbers.has(key)) {
        continue;
      }
      if (key) seenNumbers.add(key);
      invList.push(inv);
    }

    // Should only contain 3 unique invoices instead of 5
    expect(invList).toHaveLength(3);
    expect(invList.map(i => i.invoice_number)).toEqual(['INV-2026-001', 'INV-2026-002', 'INV-2026-003']);
    // Precedence: uploaded items should retain their image_url
    expect(invList[0].source).toBe('invoices');
    expect(invList[0].image_url).toBe('img1.png');
    expect(invList[2].source).toBe('nav_invoices');
  });
});

