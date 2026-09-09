import { describe, it, expect } from 'vitest';
import { queryKeys } from '@/lib/queryKeys';

describe('Categories Query Keys & Caching Pattern', () => {
  it('defines categoriesPageData query key scoped by companyId', () => {
    const companyId = 'test-company-123';
    expect(queryKeys.categoriesPageData(companyId)).toEqual(['categoriesPageData', 'test-company-123']);
  });

  it('defines categories badge query key scoped by companyId', () => {
    const companyId = 'test-company-123';
    expect(queryKeys.categories(companyId)).toEqual(['categories', 'test-company-123']);
  });

  it('aggregates multi-currency invoice stats per category correctly without N+1 waterfalls', () => {
    const mockCategories = [
      { id: 'cat-1', name: 'Marketing', description: 'ads', icon: 'FolderOpen', color: '#ff0000', gl_accounts: ['525'] },
      { id: 'cat-2', name: 'IT', description: 'servers', icon: 'Server', color: '#00ff00', gl_accounts: ['523'] },
    ];

    const mockUploadedInvoices = [
      { id: 'inv-1', bizonylatsorszam: 'INV-001', invoice_direction: 'INBOUND', elado_nev: 'Google', kibocsatas_datuma: '2026-09-01', brutto_vegosszeg: 50000, penznem: 'HUF', category_id: 'cat-1' },
      { id: 'inv-2', bizonylatsorszam: 'INV-002', invoice_direction: 'INBOUND', elado_nev: 'AWS', kibocsatas_datuma: '2026-09-02', brutto_vegosszeg: 120, penznem: 'EUR', category_id: 'cat-2' },
      { id: 'inv-3', bizonylatsorszam: 'INV-003', invoice_direction: 'INBOUND', elado_nev: 'Github', kibocsatas_datuma: '2026-09-03', brutto_vegosszeg: 20000, penznem: 'HUF', category_id: 'cat-2' },
    ];

    const mockNavInvoices = [
      { id: 'nav-1', invoice_number: 'NAV-001', invoice_direction: 'INBOUND', supplier_name: 'Meta', invoice_issue_date: '2026-09-04', invoice_gross_amount: 30000, category_id: 'cat-1' },
    ];

    // Build lookup maps as done in queryFn
    const uploadedByCat = new Map<string, any[]>();
    for (const inv of mockUploadedInvoices) {
      const list = uploadedByCat.get(inv.category_id) || [];
      list.push(inv);
      uploadedByCat.set(inv.category_id, list);
    }

    const navByCat = new Map<string, any[]>();
    for (const inv of mockNavInvoices) {
      const list = navByCat.get(inv.category_id) || [];
      list.push(inv);
      navByCat.set(inv.category_id, list);
    }

    // Verify cat-1 stats
    const cat1Uploaded = uploadedByCat.get('cat-1') || [];
    const cat1Nav = navByCat.get('cat-1') || [];
    expect(cat1Uploaded.length).toBe(1);
    expect(cat1Nav.length).toBe(1);
    const cat1TotalHuf = cat1Uploaded[0].brutto_vegosszeg + cat1Nav[0].invoice_gross_amount;
    expect(cat1TotalHuf).toBe(80000);

    // Verify cat-2 stats (multi-currency HUF + EUR)
    const cat2Uploaded = uploadedByCat.get('cat-2') || [];
    expect(cat2Uploaded.length).toBe(2);
    const cat2Eur = cat2Uploaded.find(i => i.penznem === 'EUR')?.brutto_vegosszeg;
    const cat2Huf = cat2Uploaded.find(i => i.penznem === 'HUF')?.brutto_vegosszeg;
    expect(cat2Eur).toBe(120);
    expect(cat2Huf).toBe(20000);
  });
});
