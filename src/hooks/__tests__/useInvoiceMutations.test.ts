import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInvoiceMutations } from '../useInvoiceMutations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (typeof options === 'string') return options;
      if (options && typeof options === 'object' && options.defaultValue) {
        return options.defaultValue;
      }
      return key;
    },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/lib/errorReporter', () => ({
  reportError: vi.fn(),
}));

vi.mock('@/lib/exportUtils', () => ({
  exportToFile: vi.fn(),
}));

// Mock Supabase
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockRemove = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          in: mockIn.mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        in: mockIn.mockResolvedValue({ data: [], error: null }),
      }),
      update: mockUpdate.mockReturnValue({
        eq: mockEq.mockResolvedValue({ data: null, error: null }),
        in: mockIn.mockResolvedValue({ data: null, error: null }),
      }),
      delete: mockDelete.mockReturnValue({
        eq: mockEq.mockResolvedValue({ data: null, error: null }),
        in: mockIn.mockResolvedValue({ data: null, error: null }),
      }),
    })),
    storage: {
      from: vi.fn(() => ({
        remove: mockRemove.mockResolvedValue({ data: [], error: null }),
      })),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  );
}

describe('useInvoiceMutations', () => {
  const invalidateInvoiceData = vi.fn();
  const setSelectedInvoiceIds = vi.fn();
  const selectedCompany = { id: 'company-123', name: 'Test Kft.' };

  const defaultParams = {
    companyId: 'company-123',
    selectedCompany,
    invalidateInvoiceData,
    selectedInvoiceIds: new Set<string>(['inv-1', 'inv-2']),
    setSelectedInvoiceIds,
    filteredAndSortedNavInvoices: [
      { id: 'inv-1', invoice_number: 'SZLA-001', submitted: false } as any,
    ],
    filteredAndSortedSubmittedInvoices: [],
    getInvoicePartnerName: vi.fn(),
    getPartnerTaxNumber: vi.fn(),
    getCategoryName: vi.fn(),
    getProjectName: vi.fn(),
    isSubmittedTab: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatCooldown', () => {
    it('formats seconds into MM:SS format', () => {
      const { result } = renderHook(() => useInvoiceMutations(defaultParams), {
        wrapper: createWrapper(),
      });

      expect(result.current.formatCooldown(65)).toBe('1:05');
      expect(result.current.formatCooldown(0)).toBe('0:00');
      expect(result.current.formatCooldown(120)).toBe('2:00');
    });
  });

  describe('handleProjectChange', () => {
    it('updates nav_invoices and twin invoices table when invoiceNumber is provided', async () => {
      const { result } = renderHook(() => useInvoiceMutations(defaultParams), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.handleProjectChange('inv-1', 'proj-99', 'SZLA-001');
      });

      expect(supabase.from).toHaveBeenCalledWith('nav_invoices');
      expect(mockUpdate).toHaveBeenCalledWith({ project_id: 'proj-99' });
      expect(supabase.from).toHaveBeenCalledWith('invoices');
      expect(invalidateInvoiceData).toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith({ title: 'Projekt hozzárendelve' });
    });

    it('sets project_id to null when projectId is "none"', async () => {
      const { result } = renderHook(() => useInvoiceMutations(defaultParams), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.handleProjectChange('inv-1', 'none');
      });

      expect(mockUpdate).toHaveBeenCalledWith({ project_id: null });
      expect(invalidateInvoiceData).toHaveBeenCalled();
    });
  });

  describe('handleCategoryChange', () => {
    it('updates category in nav_invoices and twin invoices table', async () => {
      const { result } = renderHook(() => useInvoiceMutations(defaultParams), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.handleCategoryChange('inv-1', 'cat-88', 'SZLA-001');
      });

      expect(supabase.from).toHaveBeenCalledWith('nav_invoices');
      expect(mockUpdate).toHaveBeenCalledWith({ category_id: 'cat-88' });
      expect(invalidateInvoiceData).toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith({ title: 'Kategória hozzárendelve' });
    });
  });

  describe('handleToggleSubmitted', () => {
    it('flips submitted boolean status and triggers cache invalidation', async () => {
      const { result } = renderHook(() => useInvoiceMutations(defaultParams), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.handleToggleSubmitted({
          id: 'inv-1',
          submitted: false,
        } as any);
      });

      expect(supabase.from).toHaveBeenCalledWith('nav_invoices');
      expect(mockUpdate).toHaveBeenCalledWith({ submitted: true });
      expect(invalidateInvoiceData).toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith({ title: 'Beküldve megjelölve' });
    });
  });

  describe('handleBulkCategoryChange', () => {
    it('updates all selected invoices and clears selection', async () => {
      const { result } = renderHook(() => useInvoiceMutations(defaultParams), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.handleBulkCategoryChange('cat-bulk');
      });

      expect(supabase.from).toHaveBeenCalledWith('nav_invoices');
      expect(mockUpdate).toHaveBeenCalledWith({ category_id: 'cat-bulk' });
      expect(mockIn).toHaveBeenCalledWith('id', ['inv-1', 'inv-2']);
      expect(setSelectedInvoiceIds).toHaveBeenCalledWith(new Set());
      expect(invalidateInvoiceData).toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith({ title: '2 db számla kategóriája frissítve' });
    });

    it('shows destructive toast if no invoices are selected', async () => {
      const { result } = renderHook(
        () =>
          useInvoiceMutations({
            ...defaultParams,
            selectedInvoiceIds: new Set(),
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.handleBulkCategoryChange('cat-bulk');
      });

      expect(toast).toHaveBeenCalledWith({
        title: 'Nincs kijelölt számla',
        variant: 'destructive',
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleBulkDeleteSubmitted', () => {
    it('deletes rows from invoices table in row_only mode and invalidates cache', async () => {
      const { result } = renderHook(
        () =>
          useInvoiceMutations({
            ...defaultParams,
            isSubmittedTab: true,
          }),
        { wrapper: createWrapper() }
      );

      await act(async () => {
        await result.current.handleBulkDeleteSubmitted('row_only');
      });

      expect(supabase.from).toHaveBeenCalledWith('invoices');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockIn).toHaveBeenCalledWith('id', ['inv-1', 'inv-2']);
      expect(setSelectedInvoiceIds).toHaveBeenCalledWith(new Set());
      expect(invalidateInvoiceData).toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Sikeres törlés' })
      );
    });
  });
});
