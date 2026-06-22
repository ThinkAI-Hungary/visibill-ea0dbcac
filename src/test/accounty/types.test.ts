import { describe, it, expect } from 'vitest';
import { blockingCategoryMeta, type BlockingCategory, type BlockingItem, type ClientData } from '@/pages/Accounty/types';

/**
 * Tests for the shared Accounty type definitions and metadata objects.
 */

// ═══════════════════════════════════════════════════════════════
// blockingCategoryMeta tests
// ═══════════════════════════════════════════════════════════════

describe('blockingCategoryMeta', () => {
  const expectedCategories: BlockingCategory[] = ['bejovo', 'kimeno', 'bank', 'ber'];

  it('contains all 4 categories', () => {
    expect(Object.keys(blockingCategoryMeta)).toHaveLength(4);
    for (const cat of expectedCategories) {
      expect(blockingCategoryMeta).toHaveProperty(cat);
    }
  });

  it('bejovo has label "Bejövő"', () => {
    expect(blockingCategoryMeta.bejovo.label).toBe('Bejövő');
  });

  it('kimeno has label "Kimenő"', () => {
    expect(blockingCategoryMeta.kimeno.label).toBe('Kimenő');
  });

  it('bank has label "Bank"', () => {
    expect(blockingCategoryMeta.bank.label).toBe('Bank');
  });

  it('ber has label "Bér"', () => {
    expect(blockingCategoryMeta.ber.label).toBe('Bér');
  });

  it('all categories have string icon property', () => {
    for (const cat of expectedCategories) {
      expect(typeof blockingCategoryMeta[cat].icon).toBe('string');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// ClientData type validation tests
// ═══════════════════════════════════════════════════════════════

describe('ClientData type validation', () => {
  const validClient: ClientData = {
    id: 'client-1',
    name: 'Test Kft.',
    taxNumber: '12345678-2-42',
    status: 'Rendben',
    unprocessedCount: 0,
    missingCount: 0,
    deadline: '2024-03-15',
    deadlineDate: '2024-03-15',
    progress: 85,
    colorHex: '#10b981',
    assignedToMe: true,
    ownerId: 'user-1',
  };

  it('accepts a valid ClientData object', () => {
    expect(validClient.id).toBe('client-1');
    expect(validClient.name).toBe('Test Kft.');
    expect(validClient.taxNumber).toBe('12345678-2-42');
  });

  it('status can be "Rendben"', () => {
    expect(validClient.status).toBe('Rendben');
  });

  it('status can be "Feldolgozandó"', () => {
    const client: ClientData = { ...validClient, status: 'Feldolgozandó' };
    expect(client.status).toBe('Feldolgozandó');
  });

  it('status can be "Kritikus"', () => {
    const client: ClientData = { ...validClient, status: 'Kritikus' };
    expect(client.status).toBe('Kritikus');
  });

  it('progress is a number between 0 and 100', () => {
    expect(validClient.progress).toBeGreaterThanOrEqual(0);
    expect(validClient.progress).toBeLessThanOrEqual(100);
  });

  it('isMainAccountant is optional', () => {
    expect(validClient.isMainAccountant).toBeUndefined();
    const withMain: ClientData = { ...validClient, isMainAccountant: true };
    expect(withMain.isMainAccountant).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// BlockingItem type validation tests
// ═══════════════════════════════════════════════════════════════

describe('BlockingItem type validation', () => {
  const validItem: BlockingItem = {
    id: 'item-1',
    clientId: 'client-1',
    category: 'bejovo',
    title: 'Hiányzó számla',
    subtitle: 'Partner Kft. - 2024/001',
    source: 'NAV',
    priority: 'urgent',
    details: 'Ez a számla hiányzik a nyilvántartásból.',
  };

  it('accepts a valid BlockingItem', () => {
    expect(validItem.id).toBe('item-1');
    expect(validItem.category).toBe('bejovo');
    expect(validItem.priority).toBe('urgent');
  });

  it('priority can be "urgent"', () => {
    expect(validItem.priority).toBe('urgent');
  });

  it('priority can be "medium"', () => {
    const item: BlockingItem = { ...validItem, priority: 'medium' };
    expect(item.priority).toBe('medium');
  });

  it('priority can be "low"', () => {
    const item: BlockingItem = { ...validItem, priority: 'low' };
    expect(item.priority).toBe('low');
  });

  it('amount is optional', () => {
    expect(validItem.amount).toBeUndefined();
    const withAmount: BlockingItem = { ...validItem, amount: '1500000' };
    expect(withAmount.amount).toBe('1500000');
  });

  it('date is optional', () => {
    expect(validItem.date).toBeUndefined();
    const withDate: BlockingItem = { ...validItem, date: '2024-03-01' };
    expect(withDate.date).toBe('2024-03-01');
  });

  it('invoiceNumber is optional', () => {
    expect(validItem.invoiceNumber).toBeUndefined();
    const withInv: BlockingItem = { ...validItem, invoiceNumber: 'INV-2024-001' };
    expect(withInv.invoiceNumber).toBe('INV-2024-001');
  });

  it('resolveRoute is optional', () => {
    expect(validItem.resolveRoute).toBeUndefined();
    const withRoute: BlockingItem = { ...validItem, resolveRoute: '/invoices/upload' };
    expect(withRoute.resolveRoute).toBe('/invoices/upload');
  });

  it('all 4 category values are valid', () => {
    const categories: BlockingCategory[] = ['bejovo', 'kimeno', 'bank', 'ber'];
    for (const cat of categories) {
      const item: BlockingItem = { ...validItem, category: cat };
      expect(item.category).toBe(cat);
    }
  });
});
