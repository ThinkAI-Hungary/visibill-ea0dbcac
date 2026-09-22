import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvoiceFilterBar } from '../components/filters/InvoiceFilterBar';
import { InvoiceDataExportDialog, type ExportableInvoice } from '@/components/invoices/InvoiceDataExportDialog';
import { exportMultiTableDocument } from '@/lib/documents/templates/tableExportTemplate';
import { DocumentEngine } from '@/lib/documents/core/DocumentEngine';

const {
  mockSetFilters,
  mockSetDateBasis,
  mockClearAllFilters,
  mockState,
} = vi.hoisted(() => ({
  mockSetFilters: vi.fn(),
  mockSetDateBasis: vi.fn(),
  mockClearAllFilters: vi.fn(),
  mockState: {
    vatRate: 'all',
    dateBasis: 'teljesites',
  },
}));

vi.mock('../context/useInvoiceContext', () => ({
  useInvoiceContext: () => ({
    filters: {
      search: '',
      issueDateFrom: '',
      issueDateTo: '',
      deliveryDateFrom: '',
      deliveryDateTo: '',
      dateBasis: mockState.dateBasis,
      amountMin: '',
      amountMax: '',
      currency: 'all',
      paid: 'all',
      submitted: 'all',
      project: 'all',
      category: 'all',
      paymentMethod: 'all',
      continuous: 'all',
      navStatus: 'all',
      vatRate: mockState.vatRate,
    },
    setFilters: mockSetFilters,
    setDateBasis: mockSetDateBasis,
    activeTab: 'INBOUND',
    isSubmittedTab: false,
    categories: [],
    projects: [],
    submittedInvoices: [],
    getPaymentMethodLabel: (val: string) => val,
    hasAnyActiveFilter: mockState.vatRate !== 'all',
    clearAllFilters: mockClearAllFilters,
  }),
}));

describe('VAT Rate Filtering and Multi-tab Export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.vatRate = 'all';
  });

  it('renders ÁFA-kulcs dropdown trigger in InvoiceFilterBar', () => {
    render(<InvoiceFilterBar />);
    expect(screen.getByText('ÁFA-kulcs')).toBeInTheDocument();
  });

  it('displays selected ÁFA-kulcs when filter is set to 27%', () => {
    mockState.vatRate = '27%';
    render(<InvoiceFilterBar />);
    expect(screen.getByText('ÁFA: 27%')).toBeInTheDocument();
  });

  it('renders Excel sheet layout selector in InvoiceDataExportDialog when format is xlsx', () => {
    const mockExport = vi.fn().mockResolvedValue(undefined);
    const mockInvoices: ExportableInvoice[] = [
      {
        id: '1',
        invoice_number: 'INV-001',
        direction: 'INBOUND',
        partner_name: 'Test Partner',
        issue_date: '2026-08-10',
        payment_method: 'Átutalás',
        net_amount: 10000,
        vat_amount: 2700,
        gross_amount: 12700,
        currency: 'HUF',
        source: 'nav',
      },
    ];

    render(
      <InvoiceDataExportDialog
        open={true}
        onClose={vi.fn()}
        invoices={mockInvoices}
        initialSelectedIds={new Set(['1'])}
        initialFormat="xlsx"
        onExport={mockExport}
      />
    );

    expect(screen.getByText('Excel Munkalapok Elrendezése')).toBeInTheDocument();
    expect(screen.getByText('Egyetlen munkalap')).toBeInTheDocument();
    expect(screen.getByText('Fizetési mód szerint bontva (3 fül)')).toBeInTheDocument();
  });

  it('exportMultiTableDocument passes multi-table sections to DocumentEngine', async () => {
    const spyExport = vi.spyOn(DocumentEngine, 'export').mockResolvedValue({
      filename: 'test.xlsx',
      format: 'xlsx',
      success: true,
      sizeBytes: 100,
    });

    await exportMultiTableDocument(
      {
        title: 'Számlák Exportálása',
        filename: 'szamlak_export',
        tables: [
          {
            title: 'Utalás és bankkártya',
            headers: ['Számlaszám', 'Összeg'],
            rows: [['INV-001', 12700]],
          },
          {
            title: 'Készpénz és házipénztár',
            headers: ['Számlaszám', 'Összeg'],
            rows: [['INV-002', 5000]],
          },
        ],
      },
      'xlsx'
    );

    expect(spyExport).toHaveBeenCalledTimes(1);
    const descriptor = spyExport.mock.calls[0][0];
    expect(descriptor.sections).toHaveLength(2);
    expect(descriptor.sections[0].title).toBe('Utalás és bankkártya');
    expect(descriptor.sections[1].title).toBe('Készpénz és házipénztár');

    spyExport.mockRestore();
  });
});
