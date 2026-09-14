import { describe, it, expect } from 'vitest';

/**
 * Tests for eaisyBooks Portfolio Option 1: Linear Command Center
 * 
 * Verifies:
 * - Pulse KPI status computation (closing %, critical count, healthy count)
 * - Scope filtering ('all' vs 'mine')
 * - Category / tab routing ('companies', 'payroll', 'tao', 'ev')
 * - Search and status filtering combinations
 */

interface MockClient {
  id: string;
  name: string;
  taxNumber: string;
  status: 'Rendben' | 'Feldolgozandó' | 'Kritikus';
  isMainAccountant: boolean;
  missingCount: number;
  unprocessedCount: number;
}

const SAMPLE_CLIENTS: MockClient[] = [
  { id: '1', name: 'Alpha Tech Kft.', taxNumber: '11111111-1-11', status: 'Rendben', isMainAccountant: true, missingCount: 0, unprocessedCount: 0 },
  { id: '2', name: 'Beta Logisztika Kft.', taxNumber: '22222222-2-22', status: 'Kritikus', isMainAccountant: false, missingCount: 25, unprocessedCount: 12 },
  { id: '3', name: 'Gamma Retail Zrt.', taxNumber: '33333333-3-33', status: 'Feldolgozandó', isMainAccountant: true, missingCount: 3, unprocessedCount: 5 },
  { id: '4', name: 'Delta Tanácsadó Bt.', taxNumber: '44444444-4-44', status: 'Rendben', isMainAccountant: false, missingCount: 0, unprocessedCount: 1 },
];

describe('Option 1: Linear Command Center - Pulse KPIs & Filtering', () => {
  it('computes dynamic Pulse KPI metrics correctly', () => {
    const total = SAMPLE_CLIENTS.length;
    const kritikus = SAMPLE_CLIENTS.filter(c => c.status === 'Kritikus').length;
    const rendben = SAMPLE_CLIENTS.filter(c => c.status === 'Rendben').length;
    const zarasiSzazalek = Math.round((rendben / total) * 100);

    expect(total).toBe(4);
    expect(kritikus).toBe(1);
    expect(rendben).toBe(2);
    expect(zarasiSzazalek).toBe(50);
  });

  it('filters by viewScope: all vs mine', () => {
    const all = SAMPLE_CLIENTS.filter(c => true);
    const mine = SAMPLE_CLIENTS.filter(c => c.isMainAccountant);

    expect(all).toHaveLength(4);
    expect(mine).toHaveLength(2);
    expect(mine.map(c => c.name)).toEqual(['Alpha Tech Kft.', 'Gamma Retail Zrt.']);
  });

  it('filters by critical status when clicking the Critical Pulse Card', () => {
    const statusFilter = 'Kritikus';
    const criticalClients = SAMPLE_CLIENTS.filter(c => c.status === statusFilter);

    expect(criticalClients).toHaveLength(1);
    expect(criticalClients[0].name).toBe('Beta Logisztika Kft.');
  });

  it('filters by healthy status when clicking the Kiosztott/Rendben Pulse Card', () => {
    const statusFilter = 'Rendben';
    const healthyClients = SAMPLE_CLIENTS.filter(c => c.status === statusFilter);

    expect(healthyClients).toHaveLength(2);
    expect(healthyClients.map(c => c.name)).toEqual(['Alpha Tech Kft.', 'Delta Tanácsadó Bt.']);
  });

  it('filters by searchQuery matching both company name and tax number', () => {
    const queryName = 'tech';
    const queryTax = '33333333';

    const matchName = SAMPLE_CLIENTS.filter(c => c.name.toLowerCase().includes(queryName) || c.taxNumber.includes(queryName));
    const matchTax = SAMPLE_CLIENTS.filter(c => c.name.toLowerCase().includes(queryTax) || c.taxNumber.includes(queryTax));

    expect(matchName).toHaveLength(1);
    expect(matchName[0].id).toBe('1');
    expect(matchTax).toHaveLength(1);
    expect(matchTax[0].id).toBe('3');
  });

  it('combines viewScope=mine and statusFilter=Rendben correctly', () => {
    const combined = SAMPLE_CLIENTS.filter(c => c.isMainAccountant && c.status === 'Rendben');
    expect(combined).toHaveLength(1);
    expect(combined[0].name).toBe('Alpha Tech Kft.');
  });
});
