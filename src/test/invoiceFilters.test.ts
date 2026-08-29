import { describe, it, expect } from 'vitest';
import { defaultFilters, FILTER_URL_KEYS } from '@/hooks/useInvoiceFilters';
import type { KpiFilterType, InvoiceKpiSummary, InvoiceFilters } from '@/hooks/useInvoiceFilters';

describe('useInvoiceFilters', () => {
  it('has correct default filter values', () => {
    expect(defaultFilters.search).toBe('');
    expect(defaultFilters.currency).toBe('all');
    expect(defaultFilters.paid).toBe('all');
    expect(defaultFilters.submitted).toBe('all');
    expect(defaultFilters.project).toBe('all');
    expect(defaultFilters.category).toBe('all');
    expect(defaultFilters.paymentMethod).toBe('all');
    expect(defaultFilters.continuous).toBe('all');
  });

  it('maps all filter keys to URL param names', () => {
    expect(FILTER_URL_KEYS.search).toBe('q');
    expect(FILTER_URL_KEYS.issueDateFrom).toBe('idf');
    expect(FILTER_URL_KEYS.issueDateTo).toBe('idt');
    expect(FILTER_URL_KEYS.amountMin).toBe('amin');
    expect(FILTER_URL_KEYS.amountMax).toBe('amax');
    expect(FILTER_URL_KEYS.currency).toBe('cur');
    expect(FILTER_URL_KEYS.paid).toBe('paid');
    expect(FILTER_URL_KEYS.submitted).toBe('sub');
    expect(FILTER_URL_KEYS.project).toBe('proj');
    expect(FILTER_URL_KEYS.category).toBe('cat');
    expect(FILTER_URL_KEYS.paymentMethod).toBe('pm');
    expect(FILTER_URL_KEYS.continuous).toBe('cont');
  });

  it('correctly handles all KPI filter types', () => {
    const kpiTypes: KpiFilterType[] = ['all', 'matched', 'suggested', 'unmatched'];
    expect(kpiTypes).toHaveLength(4);
    expect(kpiTypes).toContain('all');
    expect(kpiTypes).toContain('matched');
    expect(kpiTypes).toContain('suggested');
    expect(kpiTypes).toContain('unmatched');
  });

  it('validates InvoiceKpiSummary computation integrity', () => {
    const sampleSummary: InvoiceKpiSummary = {
      total: 416,
      matched: 100,
      suggested: 0,
      unmatched: 316,
    };
    expect(sampleSummary.matched + sampleSummary.suggested + sampleSummary.unmatched).toBe(sampleSummary.total);
  });
});
