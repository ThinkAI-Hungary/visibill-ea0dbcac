import { describe, it, expect } from 'vitest';
import type {
  AccountyClient,
  AccountyMissingItem,
  AccountyDeadline,
  AccountyKpis,
  AccountyTaxProfile,
  AccountyCompanySummary,
} from '@/hooks/useAccountyData';

/**
 * Tests for Accounty data model type contracts.
 * Validates that the interfaces and data shapes are properly structured
 * for use throughout the eaisyBooks application.
 */

// ═══════════════════════════════════════════════════════════════
// AccountyClient interface tests
// ═══════════════════════════════════════════════════════════════

describe('AccountyClient data shape', () => {
  const validClient: AccountyClient = {
    id: 'uuid-123',
    companyId: 'uuid-456',
    name: 'Példa Bt.',
    taxNumber: '12345678-2-42',
    status: 'Rendben',
    unprocessedCount: 5,
    missingCount: 2,
    deadlineDate: '2024-03-15',
    progress: 75,
    assignedToMe: true,
    isPrimary: true,
    accountantRole: 'senior',
  };

  it('has all required fields', () => {
    expect(validClient.id).toBeDefined();
    expect(validClient.companyId).toBeDefined();
    expect(validClient.name).toBeDefined();
    expect(validClient.status).toBeDefined();
    expect(validClient.unprocessedCount).toBeDefined();
    expect(validClient.missingCount).toBeDefined();
    expect(validClient.progress).toBeDefined();
    expect(validClient.assignedToMe).toBeDefined();
    expect(validClient.isPrimary).toBeDefined();
    expect(validClient.accountantRole).toBeDefined();
  });

  it('status is one of the valid values', () => {
    const validStatuses = ['Rendben', 'Feldolgozandó', 'Kritikus'];
    expect(validStatuses).toContain(validClient.status);
  });

  it('accountantRole is "senior" or "junior"', () => {
    expect(['senior', 'junior']).toContain(validClient.accountantRole);
  });

  it('taxNumber can be null', () => {
    const clientNullTax: AccountyClient = { ...validClient, taxNumber: null };
    expect(clientNullTax.taxNumber).toBeNull();
  });

  it('deadlineDate can be null', () => {
    const clientNullDeadline: AccountyClient = { ...validClient, deadlineDate: null };
    expect(clientNullDeadline.deadlineDate).toBeNull();
  });

  it('ownerId is optional', () => {
    expect(validClient.ownerId).toBeUndefined();
    const withOwner: AccountyClient = { ...validClient, ownerId: 'user-1' };
    expect(withOwner.ownerId).toBe('user-1');
  });

  it('isMainAccountant is optional', () => {
    expect(validClient.isMainAccountant).toBeUndefined();
    const withMain: AccountyClient = { ...validClient, isMainAccountant: true };
    expect(withMain.isMainAccountant).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// AccountyMissingItem interface tests
// ═══════════════════════════════════════════════════════════════

describe('AccountyMissingItem data shape', () => {
  const validItem: AccountyMissingItem = {
    id: 'item-1',
    companyId: 'comp-1',
    category: 'bejovo',
    title: 'Hiányzó bejövő számla',
    subtitle: 'Partner Kft.',
    source: 'NAV',
    priority: 'urgent',
    status: 'open',
    details: 'Részletek...',
    amount: 150000,
    invoiceNumber: 'INV-001',
    itemDate: '2024-03-01',
    resolveRoute: '/invoices/upload',
    navInvoiceId: 'nav-001',
    transactionId: null,
    notificationCount: 2,
    lastNotifiedAt: '2024-03-10T10:00:00Z',
    escalationLevel: 1,
    isIgnored: false,
    createdAt: '2024-03-01T00:00:00Z',
    resolvedAt: null,
  };

  it('has all required fields', () => {
    expect(validItem.id).toBeDefined();
    expect(validItem.companyId).toBeDefined();
    expect(validItem.category).toBeDefined();
    expect(validItem.title).toBeDefined();
    expect(validItem.source).toBeDefined();
    expect(validItem.priority).toBeDefined();
    expect(validItem.status).toBeDefined();
    expect(validItem.notificationCount).toBeDefined();
    expect(validItem.escalationLevel).toBeDefined();
    expect(typeof validItem.isIgnored).toBe('boolean');
    expect(validItem.createdAt).toBeDefined();
  });

  it('category is one of bejovo | kimeno | bank | ber', () => {
    expect(['bejovo', 'kimeno', 'bank', 'ber']).toContain(validItem.category);
  });

  it('priority is one of urgent | medium | low', () => {
    expect(['urgent', 'medium', 'low']).toContain(validItem.priority);
  });

  it('status is one of open | notified | resolved | ignored', () => {
    expect(['open', 'notified', 'resolved', 'ignored']).toContain(validItem.status);
  });

  it('nullable fields can be null', () => {
    const itemWithNulls: AccountyMissingItem = {
      ...validItem,
      subtitle: null,
      details: null,
      amount: null,
      invoiceNumber: null,
      itemDate: null,
      resolveRoute: null,
      navInvoiceId: null,
      transactionId: null,
      lastNotifiedAt: null,
      resolvedAt: null,
    };
    expect(itemWithNulls.subtitle).toBeNull();
    expect(itemWithNulls.amount).toBeNull();
    expect(itemWithNulls.resolvedAt).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// AccountyDeadline interface tests
// ═══════════════════════════════════════════════════════════════

describe('AccountyDeadline data shape', () => {
  const validDeadline: AccountyDeadline = {
    id: 'dl-1',
    companyId: 'comp-1',
    companyName: 'Test Kft.',
    deadlineType: 'afa',
    title: 'ÁFA bevallás',
    dueDate: '2024-03-20',
    status: 'pending',
    isManualOverride: false,
    notes: null,
  };

  it('has all required fields', () => {
    expect(validDeadline.id).toBeDefined();
    expect(validDeadline.companyId).toBeDefined();
    expect(validDeadline.deadlineType).toBeDefined();
    expect(validDeadline.dueDate).toBeDefined();
    expect(validDeadline.status).toBeDefined();
    expect(typeof validDeadline.isManualOverride).toBe('boolean');
  });

  it('status is one of pending | in_progress | completed | overdue', () => {
    expect(['pending', 'in_progress', 'completed', 'overdue']).toContain(validDeadline.status);
  });

  it('companyName is optional', () => {
    const withoutName: AccountyDeadline = { ...validDeadline };
    delete (withoutName as any).companyName;
    expect(withoutName.companyName).toBeUndefined();
  });

  it('title can be null', () => {
    const nullTitle: AccountyDeadline = { ...validDeadline, title: null };
    expect(nullTitle.title).toBeNull();
  });

  it('notes can be null', () => {
    expect(validDeadline.notes).toBeNull();
    const withNotes: AccountyDeadline = { ...validDeadline, notes: 'Megjegyzés' };
    expect(withNotes.notes).toBe('Megjegyzés');
  });
});

// ═══════════════════════════════════════════════════════════════
// AccountyKpis interface tests
// ═══════════════════════════════════════════════════════════════

describe('AccountyKpis data shape', () => {
  const validKpis: AccountyKpis = {
    totalClients: 15,
    unprocessedInvoices: 42,
    missingItems: 7,
    upcomingDeadlines: 3,
    criticalClients: 2,
    todayDeadlines: 1,
  };

  it('has all 6 KPI fields', () => {
    expect(Object.keys(validKpis)).toHaveLength(6);
  });

  it('all values are numbers', () => {
    for (const value of Object.values(validKpis)) {
      expect(typeof value).toBe('number');
    }
  });

  it('all values are non-negative', () => {
    for (const value of Object.values(validKpis)) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('empty state has all zeros', () => {
    const emptyKpis: AccountyKpis = {
      totalClients: 0,
      unprocessedInvoices: 0,
      missingItems: 0,
      upcomingDeadlines: 0,
      criticalClients: 0,
      todayDeadlines: 0,
    };
    for (const value of Object.values(emptyKpis)) {
      expect(value).toBe(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// AccountyTaxProfile interface tests
// ═══════════════════════════════════════════════════════════════

describe('AccountyTaxProfile data shape', () => {
  const validProfile: AccountyTaxProfile = {
    id: 'tp-1',
    companyId: 'comp-1',
    vatFrequency: 'quarterly',
    contributionFrequency: 'monthly',
    isKata: false,
    isKiva: true,
    taxGroup: 'kisvállalkozás',
    navSynced: true,
  };

  it('has all required fields', () => {
    expect(validProfile.id).toBeDefined();
    expect(validProfile.companyId).toBeDefined();
    expect(validProfile.vatFrequency).toBeDefined();
    expect(validProfile.contributionFrequency).toBeDefined();
    expect(typeof validProfile.isKata).toBe('boolean');
    expect(typeof validProfile.isKiva).toBe('boolean');
    expect(typeof validProfile.navSynced).toBe('boolean');
  });

  it('vatFrequency is monthly | quarterly | yearly', () => {
    expect(['monthly', 'quarterly', 'yearly']).toContain(validProfile.vatFrequency);
  });

  it('contributionFrequency is monthly | quarterly | yearly', () => {
    expect(['monthly', 'quarterly', 'yearly']).toContain(validProfile.contributionFrequency);
  });

  it('taxGroup can be null', () => {
    const nullGroup: AccountyTaxProfile = { ...validProfile, taxGroup: null };
    expect(nullGroup.taxGroup).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// AccountyCompanySummary interface tests
// ═══════════════════════════════════════════════════════════════

describe('AccountyCompanySummary data shape', () => {
  const validSummary: AccountyCompanySummary = {
    companyId: 'comp-1',
    companyName: 'Teszt Zrt.',
    companyTaxNumber: '12345678-2-42',
    missingCount: 5,
    criticalCount: 1,
    lastNotifiedAt: '2024-03-10T10:00:00Z',
    maxNotificationCount: 3,
    totalNotified: 2,
  };

  it('has all required fields', () => {
    expect(validSummary.companyId).toBeDefined();
    expect(validSummary.companyName).toBeDefined();
    expect(validSummary.companyTaxNumber).toBeDefined();
    expect(typeof validSummary.missingCount).toBe('number');
    expect(typeof validSummary.criticalCount).toBe('number');
    expect(typeof validSummary.maxNotificationCount).toBe('number');
    expect(typeof validSummary.totalNotified).toBe('number');
  });

  it('lastNotifiedAt can be null', () => {
    const nullNotified: AccountyCompanySummary = { ...validSummary, lastNotifiedAt: null };
    expect(nullNotified.lastNotifiedAt).toBeNull();
  });

  it('criticalCount is always <= missingCount', () => {
    // This is a business invariant: critical items are a subset of missing items
    expect(validSummary.criticalCount).toBeLessThanOrEqual(validSummary.missingCount);
  });

  it('totalNotified is always <= maxNotificationCount × missingCount', () => {
    // Each missing item can be notified at most maxNotificationCount times
    expect(validSummary.totalNotified).toBeLessThanOrEqual(
      validSummary.maxNotificationCount * validSummary.missingCount
    );
  });
});
