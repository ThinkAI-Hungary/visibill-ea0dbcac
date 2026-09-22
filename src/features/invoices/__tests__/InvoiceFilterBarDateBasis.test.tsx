import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvoiceFilterBar } from '../components/filters/InvoiceFilterBar';

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
    },
    setFilters: mockSetFilters,
    setDateBasis: mockSetDateBasis,
    activeTab: 'OUTBOUND',
    isSubmittedTab: false,
    categories: [],
    projects: [],
    submittedInvoices: [],
    getPaymentMethodLabel: (val: string) => val,
    hasAnyActiveFilter: false,
    clearAllFilters: mockClearAllFilters,
  }),
}));

describe('InvoiceFilterBar Date Basis Segmented Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.dateBasis = 'teljesites';
  });

  it('renders Kibocsátás and Teljesítés toggle buttons with Teljesítés active when dateBasis is teljesites', () => {
    render(<InvoiceFilterBar />);

    const kibocsatasBtn = screen.getByRole('button', { name: /Kibocsátás/i });
    const teljesitesBtn = screen.getByRole('button', { name: /Teljesítés/i });

    expect(kibocsatasBtn).toBeInTheDocument();
    expect(teljesitesBtn).toBeInTheDocument();

    // Teljesítés is active
    expect(teljesitesBtn.className).toContain('text-primary');
    expect(kibocsatasBtn.className).toContain('text-muted-foreground');
  });

  it('calls setDateBasis("kibocsatas") when Kibocsátás button is clicked', () => {
    render(<InvoiceFilterBar />);

    const kibocsatasBtn = screen.getByRole('button', { name: /Kibocsátás/i });
    fireEvent.click(kibocsatasBtn);

    expect(mockSetDateBasis).toHaveBeenCalledWith('kibocsatas');
  });

  it('calls setDateBasis("teljesites") when Teljesítés button is clicked', () => {
    mockState.dateBasis = 'kibocsatas';
    render(<InvoiceFilterBar />);

    const teljesitesBtn = screen.getByRole('button', { name: /Teljesítés/i });
    fireEvent.click(teljesitesBtn);

    expect(mockSetDateBasis).toHaveBeenCalledWith('teljesites');
  });
});
