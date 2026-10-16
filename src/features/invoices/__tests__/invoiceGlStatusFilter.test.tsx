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
    glStatus: 'all',
    hasAnyActiveFilter: false,
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
      dateBasis: 'kibocsatas',
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
      vatRate: 'all',
      glStatus: mockState.glStatus,
    },
    setFilters: mockSetFilters,
    setDateBasis: mockSetDateBasis,
    activeTab: 'INBOUND',
    isSubmittedTab: false,
    categories: [],
    projects: [],
    submittedInvoices: [],
    getPaymentMethodLabel: (val: string) => val,
    hasAnyActiveFilter: mockState.hasAnyActiveFilter,
    clearAllFilters: mockClearAllFilters,
  }),
}));

describe('InvoiceFilterBar GL Status Checkbox Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.glStatus = 'all';
    mockState.hasAnyActiveFilter = false;
  });

  it('renders the "Csak kontírozott tételek" checkbox in default/unchecked state', () => {
    render(<InvoiceFilterBar />);

    const checkbox = screen.getByRole('checkbox', { name: /Csak kontírozott tételek/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();

    const label = checkbox.closest('label');
    expect(label?.className).toContain('text-muted-foreground');
    expect(label?.className).not.toContain('bg-emerald-500/10');
  });

  it('toggles glStatus to "classified" when checkbox is checked', () => {
    render(<InvoiceFilterBar />);

    const checkbox = screen.getByRole('checkbox', { name: /Csak kontírozott tételek/i });
    fireEvent.click(checkbox);

    expect(mockSetFilters).toHaveBeenCalledTimes(1);
    const updater = mockSetFilters.mock.calls[0][0];
    const nextState = updater({ glStatus: 'all' });
    expect(nextState.glStatus).toBe('classified');
  });

  it('toggles glStatus back to "all" when checkbox is unchecked', () => {
    mockState.glStatus = 'classified';
    render(<InvoiceFilterBar />);

    const checkbox = screen.getByRole('checkbox', { name: /Csak kontírozott tételek/i });
    expect(checkbox).toBeChecked();

    const label = checkbox.closest('label');
    expect(label?.className).toContain('bg-emerald-500/10');

    fireEvent.click(checkbox);

    expect(mockSetFilters).toHaveBeenCalledTimes(1);
    const updater = mockSetFilters.mock.calls[0][0];
    const nextState = updater({ glStatus: 'classified' });
    expect(nextState.glStatus).toBe('all');
  });

  it('displays the clear all filters button when hasAnyActiveFilter is true', () => {
    mockState.hasAnyActiveFilter = true;
    mockState.glStatus = 'classified';
    render(<InvoiceFilterBar />);

    const clearBtn = screen.getByRole('button', { name: /Szűrők törlése/i });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(mockClearAllFilters).toHaveBeenCalledTimes(1);
  });
});
