import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlInvoiceDocumentResolver } from '@/hooks/useGlInvoiceDocumentResolver';
import { supabase } from '@/integrations/supabase/client';

// Mock dependencies
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback: string) => fallback,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('useGlInvoiceDocumentResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default closed dialog states', () => {
    const { result } = renderHook(() => useGlInvoiceDocumentResolver('comp_123'));

    expect(result.current.resolvingItemId).toBeNull();
    expect(result.current.imageDialogProps.open).toBe(false);
    expect(result.current.imageDialogProps.invoice).toBeNull();
    expect(result.current.itemsDialogProps.open).toBe(false);
    expect(result.current.itemsDialogProps.invoiceId).toBe('');
  });

  it('notifies when item has neither invoiceId nor invoiceNumber', async () => {
    const { result } = renderHook(() => useGlInvoiceDocumentResolver('comp_123'));

    await act(async () => {
      await result.current.handleOpenDocument({
        id: 'item_1',
        partner: 'Alpha Kft.',
      });
    });

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Bizonylat nem található',
        description: 'A kiválasztott tételhez nem tartozik azonosítható számlaszám.',
      })
    );
    expect(result.current.imageDialogProps.open).toBe(false);
    expect(result.current.itemsDialogProps.open).toBe(false);
  });

  it('opens InvoiceImageDialog when submitted invoice has image_url or attachments', async () => {
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'sub_001',
        bizonylatsorszam: 'SZ-2026-001',
        image_url: 'https://storage.supabase.co/invoices/sz_001.pdf',
        melleklet_url: null,
        attachments: [],
        elado_nev: 'MOL Nyrt.',
        vevo_nev: 'Test Kft.',
        company_id: 'comp_123',
      },
      error: null,
    });

    (supabase.from as any).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
    });

    const { result } = renderHook(() => useGlInvoiceDocumentResolver('comp_123'));

    await act(async () => {
      await result.current.handleOpenDocument({
        id: 'item_sub_1',
        invoiceId: 'sub_001',
        invoiceNumber: 'SZ-2026-001',
        sourceTable: 'invoice_items',
        partner: 'MOL Nyrt.',
      });
    });

    expect(result.current.imageDialogProps.open).toBe(true);
    expect(result.current.imageDialogProps.invoice).toEqual(
      expect.objectContaining({
        id: 'sub_001',
        bizonylatsorszam: 'SZ-2026-001',
        image_url: 'https://storage.supabase.co/invoices/sz_001.pdf',
      })
    );
    expect(result.current.itemsDialogProps.open).toBe(false);
  });

  it('opens InvoiceItemsDialog (source=nav) when invoice only exists in NAV OSA without scanned image', async () => {
    const mockFrom = vi.fn((table: string) => {
      if (table === 'nav_invoices') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'nav_001',
              invoice_number: 'NAV-2026-999',
              currency: 'HUF',
              invoice_issue_date: '2026-05-10',
              supplier_name: 'Telekom Nyrt.',
              customer_name: 'Test Kft.',
              invoice_direction: 'INBOUND',
            },
            error: null,
          }),
        };
      }
      if (table === 'invoices') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null, // No uploaded submitted invoice found with an image
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useGlInvoiceDocumentResolver('comp_123'));

    await act(async () => {
      await result.current.handleOpenDocument({
        id: 'item_nav_1',
        invoiceId: 'nav_001',
        invoiceNumber: 'NAV-2026-999',
        sourceTable: 'nav_invoice_items',
        partner: 'Telekom Nyrt.',
        originalCurrency: 'HUF',
      });
    });

    expect(result.current.imageDialogProps.open).toBe(false);
    expect(result.current.itemsDialogProps.open).toBe(true);
    expect(result.current.itemsDialogProps.source).toBe('nav');
    expect(result.current.itemsDialogProps.invoiceId).toBe('nav_001');
    expect(result.current.itemsDialogProps.invoiceNumber).toBe('NAV-2026-999');
    expect(result.current.itemsDialogProps.supplierName).toBe('Telekom Nyrt.');
  });

  it('opens InvoiceImageDialog for NAV invoice when a matching submitted invoice has an uploaded image', async () => {
    const mockFrom = vi.fn((table: string) => {
      if (table === 'nav_invoices') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'nav_002',
              invoice_number: 'MOL-2026-777',
              currency: 'HUF',
              supplier_name: 'MOL Nyrt.',
            },
            error: null,
          }),
        };
      }
      if (table === 'invoices') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'sub_matched_002',
              bizonylatsorszam: 'MOL-2026-777',
              image_url: 'https://storage.supabase.co/invoices/mol_002.jpg',
              melleklet_url: null,
              attachments: [],
              elado_nev: 'MOL Nyrt.',
              vevo_nev: 'Test Kft.',
            },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    (supabase.from as any).mockImplementation(mockFrom);

    const { result } = renderHook(() => useGlInvoiceDocumentResolver('comp_123'));

    await act(async () => {
      await result.current.handleOpenDocument({
        id: 'item_nav_2',
        invoiceId: 'nav_002',
        invoiceNumber: 'MOL-2026-777',
        sourceTable: 'nav_invoice_items',
        partner: 'MOL Nyrt.',
      });
    });

    expect(result.current.imageDialogProps.open).toBe(true);
    expect(result.current.imageDialogProps.invoice).toEqual(
      expect.objectContaining({
        id: 'sub_matched_002',
        bizonylatsorszam: 'MOL-2026-777',
        image_url: 'https://storage.supabase.co/invoices/mol_002.jpg',
      })
    );
    expect(result.current.itemsDialogProps.open).toBe(false);
  });
});
