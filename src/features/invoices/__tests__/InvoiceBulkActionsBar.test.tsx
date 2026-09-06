import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvoiceBulkActionsBar } from '../components/actions/InvoiceBulkActionsBar';

const mockClearSelection = vi.fn();
const mockSetBulkDeleteDialogOpen = vi.fn();
const mockHandleBulkCategoryChange = vi.fn();
const mockHandleBulkProjectChange = vi.fn();

let mockActiveSelection = new Set(['inv-1', 'inv-2']);
let mockIsSubmittedTab = true;

vi.mock('../context/useInvoiceContext', () => ({
  useInvoiceContext: () => ({
    activeSelection: mockActiveSelection,
    isSubmittedTab: mockIsSubmittedTab,
    categories: [
      { id: 'cat-1', name: 'Irodaszer' },
      { id: 'cat-2', name: 'Informatika' },
    ],
    projects: [
      { id: 'proj-1', name: 'Projekt Alfa' },
    ],
    exportableInvoices: [
      { id: 'inv-1', currency: 'HUF', gross_amount: 10000 },
      { id: 'inv-2', currency: 'HUF', gross_amount: 25000 },
    ],
    handleBulkCategoryChange: mockHandleBulkCategoryChange,
    handleBulkProjectChange: mockHandleBulkProjectChange,
    setBulkDeleteDialogOpen: mockSetBulkDeleteDialogOpen,
    clearSelection: mockClearSelection,
  }),
}));

describe('InvoiceBulkActionsBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveSelection = new Set(['inv-1', 'inv-2']);
    mockIsSubmittedTab = true;
  });

  it('renders bar with count, sum, category, project, delete and cancel buttons', () => {
    render(<InvoiceBulkActionsBar />);

    expect(screen.getByText(/Kijelölt számlák:/i)).toBeInTheDocument();
    expect(screen.getByText(/2 db/i)).toBeInTheDocument();
    expect(screen.getByText(/35 000 Ft/i)).toBeInTheDocument();
    expect(screen.getByText('Kategória...')).toBeInTheDocument();
    expect(screen.getByText('Projekt...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Törlés/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mégse/i })).toBeInTheDocument();
  });

  it('calls clearSelection when Mégse button is clicked', () => {
    render(<InvoiceBulkActionsBar />);

    const cancelBtn = screen.getByRole('button', { name: /Mégse/i });
    fireEvent.click(cancelBtn);

    expect(mockClearSelection).toHaveBeenCalledTimes(1);
  });

  it('calls setBulkDeleteDialogOpen(true) when Törlés button is clicked on submitted tab', () => {
    render(<InvoiceBulkActionsBar />);

    const deleteBtn = screen.getByRole('button', { name: /Törlés/i });
    fireEvent.click(deleteBtn);

    expect(mockSetBulkDeleteDialogOpen).toHaveBeenCalledWith(true);
  });
});
