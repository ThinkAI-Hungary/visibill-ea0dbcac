import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route, useSearchParams, useLocation } from 'react-router-dom';
import { useUrlTab } from '@/lib/navigation';

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'company-1', name: 'Test Kft' },
  }),
}));

vi.mock('@/contexts/DateRangeContext', () => ({
  useDateRange: () => ({
    dateFromFormatted: '2026-01-01',
    dateToFormatted: '2026-12-31',
  }),
}));

describe('useUrlTab with stripSearchParams', () => {
  it('strips configured search params (e.g. invoice and action) when switching tab', () => {
    const VALID_TABS = ['outbound_nav', 'inbound_nav', 'submitted_outbound'] as const;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/company-1/2026-01-01_2026-12-31/invoices/outbound_nav?invoice=inv-123&action=items&kpi=all']}>
        <Routes>
          <Route
            path="/:companyId/:dateRange/invoices/:tab"
            element={<>{children}</>}
          />
        </Routes>
      </MemoryRouter>
    );

    const { result } = renderHook(
      () => {
        const [tab, setTab] = useUrlTab('invoices', 'outbound_nav', VALID_TABS, {
          stripSearchParams: ['invoice', 'action'],
        });
        const location = useLocation();
        return { tab, setTab, search: location.search };
      },
      { wrapper }
    );

    expect(result.current.tab).toBe('outbound_nav');
    expect(result.current.search).toContain('invoice=inv-123');
    expect(result.current.search).toContain('action=items');
    expect(result.current.search).toContain('kpi=all');

    // Switch tab to inbound_nav without preserveParams
    act(() => {
      result.current.setTab('inbound_nav');
    });

    expect(result.current.tab).toBe('inbound_nav');
    expect(result.current.search).not.toContain('invoice=');
    expect(result.current.search).not.toContain('action=');
    expect(result.current.search).toContain('kpi=all');
  });

  it('preserves search params when navOptions.preserveParams is true (deep link routing)', () => {
    const VALID_TABS = ['outbound_nav', 'inbound_nav'] as const;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/company-1/2026-01-01_2026-12-31/invoices/outbound_nav?invoice=inv-123&action=items']}>
        <Routes>
          <Route
            path="/:companyId/:dateRange/invoices/:tab"
            element={<>{children}</>}
          />
        </Routes>
      </MemoryRouter>
    );

    const { result } = renderHook(
      () => {
        const [tab, setTab] = useUrlTab('invoices', 'outbound_nav', VALID_TABS, {
          stripSearchParams: ['invoice', 'action'],
        });
        const location = useLocation();
        return { tab, setTab, search: location.search };
      },
      { wrapper }
    );

    // Switch tab with preserveParams (used programmatically by deep-link router)
    act(() => {
      result.current.setTab('inbound_nav', { preserveParams: true });
    });

    expect(result.current.tab).toBe('inbound_nav');
    expect(result.current.search).toContain('invoice=inv-123');
    expect(result.current.search).toContain('action=items');
  });
});

describe('Invoice URL Parameter Cleanup on Dialog Close and Row Collapse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('setInvoiceParam(null) cleans action but preserves invoice in searchParams when dialog closes', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/invoices?invoice=inv-456&action=items&sf=date']}>
        {children}
      </MemoryRouter>
    );

    const { result } = renderHook(
      () => {
        const [searchParams, setSearchParams] = useSearchParams();
        const setInvoiceParam = (
          invoiceId: string | null,
          action: string = 'items',
          options?: { removeInvoice?: boolean }
        ) => {
          setSearchParams(
            prev => {
              const next = new URLSearchParams(prev);
              if (invoiceId) {
                next.set('invoice', invoiceId);
                next.set('action', action);
              } else {
                const hadAction = next.has('action');
                const hadInvoice = next.has('invoice');
                if (!hadAction && (!hadInvoice || !options?.removeInvoice)) return prev;
                next.delete('action');
                if (options?.removeInvoice) {
                  next.delete('invoice');
                }
              }
              return next;
            },
            { replace: true }
          );
        };
        return { searchParams, setInvoiceParam };
      },
      { wrapper }
    );

    expect(result.current.searchParams.get('invoice')).toBe('inv-456');
    expect(result.current.searchParams.get('action')).toBe('items');
    expect(result.current.searchParams.get('sf')).toBe('date');

    // Simulate closing items dialog (setInvoiceParam(null))
    act(() => {
      result.current.setInvoiceParam(null);
    });

    // action is removed, but invoice stays in the URL
    expect(result.current.searchParams.has('action')).toBe(false);
    expect(result.current.searchParams.get('invoice')).toBe('inv-456');
    expect(result.current.searchParams.get('sf')).toBe('date');

    // Explicit removeInvoice deletes invoice too
    act(() => {
      result.current.setInvoiceParam(null, undefined, { removeInvoice: true });
    });
    expect(result.current.searchParams.has('invoice')).toBe(false);
  });

  it('row collapse removes invoice from URL if it matches the collapsed row', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={['/invoices?invoice=inv-789']}>
        {children}
      </MemoryRouter>
    );

    const { result } = renderHook(
      () => {
        const [searchParams, setSearchParams] = useSearchParams();
        const [expandedRowIds, setExpandedRowIds] = React.useState<Set<string>>(new Set(['inv-789']));

        const toggleRowExpanded = (id: string) => {
          setExpandedRowIds(prev => {
            const isCurrentlyExpanded = prev.has(id);
            const next = new Set(prev);
            if (isCurrentlyExpanded) {
              next.delete(id);
              setSearchParams(urlPrev => {
                if (urlPrev.get('invoice') !== id) return urlPrev;
                const urlNext = new URLSearchParams(urlPrev);
                urlNext.delete('invoice');
                urlNext.delete('action');
                return urlNext;
              }, { replace: true });
            } else {
              next.add(id);
              setTimeout(() => {
                setSearchParams(urlPrev => {
                  const urlNext = new URLSearchParams(urlPrev);
                  urlNext.set('invoice', id);
                  urlNext.delete('action');
                  return urlNext;
                }, { replace: true });
              }, 180);
            }
            return next;
          });
        };

        return { searchParams, expandedRowIds, toggleRowExpanded };
      },
      { wrapper }
    );

    expect(result.current.searchParams.get('invoice')).toBe('inv-789');
    expect(result.current.expandedRowIds.has('inv-789')).toBe(true);

    // Collapse row inv-789
    act(() => {
      result.current.toggleRowExpanded('inv-789');
    });

    expect(result.current.expandedRowIds.has('inv-789')).toBe(false);
    expect(result.current.searchParams.has('invoice')).toBe(false);

    // Expand row inv-999
    act(() => {
      result.current.toggleRowExpanded('inv-999');
    });

    expect(result.current.expandedRowIds.has('inv-999')).toBe(true);
    // Before 180ms delay, URL does not have it yet (allowing 60fps CSS accordion)
    expect(result.current.searchParams.has('invoice')).toBe(false);

    // Fast-forward 180ms
    act(() => {
      vi.advanceTimersByTime(180);
    });

    // Now URL has invoice=inv-999
    expect(result.current.searchParams.get('invoice')).toBe('inv-999');
  });
});
