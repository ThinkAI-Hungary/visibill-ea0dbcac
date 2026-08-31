import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderHook } from '@testing-library/react';
import {
  InvoiceFilterProvider,
  useInvoiceFilterContext,
  InvoicePaginationProvider,
  useInvoicePaginationContext,
  InvoiceSelectionProvider,
  useInvoiceSelectionContext,
} from '../context';

describe('Invoice Sub-Contexts', () => {
  it('throws error when useInvoiceFilterContext is called outside provider', () => {
    expect(() => renderHook(() => useInvoiceFilterContext())).toThrow(
      'useInvoiceFilterContext must be used within an InvoiceFilterProvider or InvoiceProvider'
    );
  });

  it('throws error when useInvoicePaginationContext is called outside provider', () => {
    expect(() => renderHook(() => useInvoicePaginationContext())).toThrow(
      'useInvoicePaginationContext must be used within an InvoicePaginationProvider or InvoiceProvider'
    );
  });

  it('throws error when useInvoiceSelectionContext is called outside provider', () => {
    expect(() => renderHook(() => useInvoiceSelectionContext())).toThrow(
      'useInvoiceSelectionContext must be used within an InvoiceSelectionProvider or InvoiceProvider'
    );
  });

  it('provides filter context correctly when wrapped in InvoiceFilterProvider', () => {
    const mockFilterValue = {
      filters: {
        search: 'Teszt Kft',
        issueDateFrom: '',
        issueDateTo: '',
        amountMin: '',
        amountMax: '',
        currency: 'all',
        paid: 'all',
        submitted: 'all',
        project: 'all',
        category: 'all',
        paymentMethod: 'all',
        continuous: 'all',
      },
      setFilters: () => {},
      clearFilters: () => {},
      hasStandardFilters: true,
      hasAnyActiveFilter: true,
      clearAllFilters: () => {},
      kpiFilter: 'all' as const,
      setKpiFilter: () => {},
      toggleKpiFilter: () => {},
      invoiceKpis: null,
      isKpisLoading: false,
      sortField: 'invoice_issue_date',
      sortDirection: 'desc' as const,
      handleSort: () => {},
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <InvoiceFilterProvider value={mockFilterValue}>{children}</InvoiceFilterProvider>
    );

    const { result } = renderHook(() => useInvoiceFilterContext(), { wrapper });
    expect(result.current.filters.search).toBe('Teszt Kft');
    expect(result.current.hasStandardFilters).toBe(true);
    expect(result.current.sortDirection).toBe('desc');
  });

  it('provides selection context correctly when wrapped in InvoiceSelectionProvider', () => {
    const mockSelectionValue = {
      selectedInvoiceIds: new Set(['inv-1', 'inv-2']),
      setSelectedInvoiceIds: () => {},
      selectedSubmittedIds: new Set<string>(),
      setSelectedSubmittedIds: () => {},
      activeSelection: new Set(['inv-1', 'inv-2']),
      activeSetSelected: () => {},
      toggleSelectAll: () => {},
      toggleSelectRow: () => {},
      isRowSelected: (id: string) => id === 'inv-1',
      isAllSelected: false,
      expandedRowIds: new Set(['inv-1']),
      setExpandedRowIds: () => {},
      toggleRowExpanded: () => {},
      expandAllRows: () => {},
      collapseAllRows: () => {},
      isAllExpanded: false,
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <InvoiceSelectionProvider value={mockSelectionValue}>{children}</InvoiceSelectionProvider>
    );

    const { result } = renderHook(() => useInvoiceSelectionContext(), { wrapper });
    expect(result.current.selectedInvoiceIds.has('inv-1')).toBe(true);
    expect(result.current.isRowSelected('inv-1')).toBe(true);
    expect(result.current.isRowSelected('inv-3')).toBe(false);
    expect(result.current.expandedRowIds.has('inv-1')).toBe(true);
  });
});
