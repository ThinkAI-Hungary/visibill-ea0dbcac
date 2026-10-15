import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvoiceBulkActionsBar } from '../components/actions/InvoiceBulkActionsBar';

const mockClearSelection = vi.fn();
const mockSetBulkDeleteDialogOpen = vi.fn();
const mockHandleBulkCategoryChange = vi.fn();
const mockHandleBulkProjectChange = vi.fn();

let mockActiveSelection = new Set(['inv-1', 'inv-2']);
let mockIsSubmittedTab = true;
let mockExportableInvoices: any[] = [
  { id: 'inv-1', currency: 'HUF', gross_amount: 10000 },
  { id: 'inv-2', currency: 'HUF', gross_amount: 25000 },
];
let mockItemProjectSummaries: Record<string, any> = {};
let mockIsFetching = false;

vi.mock('../hooks/useInvoiceItemProjectAllocations', () => ({
  useInvoiceItemProjectAllocations: () => ({
    data: mockItemProjectSummaries,
    isLoading: false,
    isFetching: mockIsFetching,
  }),
}));

vi.mock('../context/useInvoiceContext', () => ({
  useInvoiceContext: () => ({
    companyId: 'comp-1',
    activeSelection: mockActiveSelection,
    isSubmittedTab: mockIsSubmittedTab,
    categories: [
      { id: 'cat-1', name: 'Irodaszer' },
      { id: 'cat-2', name: 'Informatika' },
    ],
    projects: [
      { id: 'proj-1', name: 'Projekt Alfa' },
      { id: 'proj-2', name: 'Projekt Béta' },
    ],
    exportableInvoices: mockExportableInvoices,
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
    mockExportableInvoices = [
      { id: 'inv-1', currency: 'HUF', gross_amount: 10000 },
      { id: 'inv-2', currency: 'HUF', gross_amount: 25000 },
    ];
    mockItemProjectSummaries = {};
  });

  it('renders bar with count, sum, category, project, delete and cancel buttons', () => {
    render(<InvoiceBulkActionsBar />);

    expect(screen.getByText(/Kijelölt számlák:/i)).toBeInTheDocument();
    expect(screen.getByText(/2 db/i)).toBeInTheDocument();
    expect(screen.getByText(/35 000 Ft/i)).toBeInTheDocument();
    expect(screen.getByText('Kategória...')).toBeInTheDocument();
    expect(screen.getByText('Projekt...')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mentés/i })).not.toBeInTheDocument();
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

  it('renders Megosztás button and supports multi-project split', async () => {
    render(<InvoiceBulkActionsBar />);

    const splitBtn = screen.getByRole('button', { name: /Megosztás/i });
    expect(splitBtn).toBeInTheDocument();
  });

  it('inherits single project in dropdown when a selected invoice belongs to a project', () => {
    mockExportableInvoices = [
      { id: 'inv-1', currency: 'HUF', gross_amount: 10000, project_id: 'proj-1' },
      { id: 'inv-2', currency: 'HUF', gross_amount: 25000 },
    ];

    render(<InvoiceBulkActionsBar />);

    // Shows Projekt Alfa in the project dropdown
    expect(screen.getByText('Projekt Alfa')).toBeInTheDocument();
    // Megosztás button is present
    expect(screen.getByRole('button', { name: /Megosztás/i })).toBeInTheDocument();
  });

  it('inherits multi-project allocation from item summaries and displays split label', () => {
    mockItemProjectSummaries = {
      'inv-1': {
        invoiceId: 'inv-1',
        hasMultiProjects: true,
        totalProjectCount: 2,
        allocations: [
          { projectId: 'proj-1', percentage: 60 },
          { projectId: 'proj-2', percentage: 40 },
        ],
      },
    };

    render(<InvoiceBulkActionsBar />);

    // Dropdown shows custom split option
    expect(screen.getByText(/Több projekt \(% felosztás\)/i)).toBeInTheDocument();
    // Button shows 2 projekt (100%)
    expect(screen.getByRole('button', { name: /2 projekt \(100%\)/i })).toBeInTheDocument();
  });

  it('prioritizes multi-project allocation even if a single-project invoice appears first in selected list', () => {
    mockExportableInvoices = [
      { id: 'inv-1', currency: 'HUF', gross_amount: 10000, project_id: 'proj-1' },
      { id: 'inv-2', currency: 'HUF', gross_amount: 25000 },
    ];
    mockItemProjectSummaries = {
      'inv-2': {
        invoiceId: 'inv-2',
        hasMultiProjects: true,
        totalProjectCount: 3,
        allocations: [
          { projectId: 'proj-1', percentage: 50 },
          { projectId: 'proj-2', percentage: 50 },
        ],
      },
    };

    render(<InvoiceBulkActionsBar />);

    expect(screen.getByText(/Több projekt \(% felosztás\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2 projekt \(100%\)/i })).toBeInTheDocument();
  });

  it('retains previous multi-project display during in-flight fetch when a new row is selected (zero flicker)', () => {
    mockActiveSelection = new Set(['inv-1']);
    mockExportableInvoices = [
      { id: 'inv-1', currency: 'HUF', gross_amount: 10000 },
      { id: 'inv-2', currency: 'HUF', gross_amount: 25000 },
    ];
    mockItemProjectSummaries = {
      'inv-1': {
        invoiceId: 'inv-1',
        hasMultiProjects: true,
        totalProjectCount: 2,
        allocations: [
          { projectId: 'proj-1', percentage: 60 },
          { projectId: 'proj-2', percentage: 40 },
        ],
      },
    };
    mockIsFetching = false;

    const { rerender } = render(<InvoiceBulkActionsBar />);
    expect(screen.getByRole('button', { name: /2 projekt \(100%\)/i })).toBeInTheDocument();

    // User checks inv-2: inv-2 is added to selection and isFetching becomes true
    mockActiveSelection = new Set(['inv-1', 'inv-2']);
    mockIsFetching = true;

    rerender(<InvoiceBulkActionsBar />);

    // Zero-jitter: the bar MUST NOT flicker back to "Megosztás (%)" or "Projekt..."
    expect(screen.queryByText('Projekt...')).not.toBeInTheDocument();
    expect(screen.getByText(/Több projekt \(% felosztás\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2 projekt \(100%\)/i })).toBeInTheDocument();
  });

  it('updates bulk bar back to unassigned Projekt... when an invoice with projects is unchecked and only an unassigned invoice remains', () => {
    mockActiveSelection = new Set(['inv-1', 'inv-2']);
    mockExportableInvoices = [
      { id: 'inv-1', currency: 'HUF', gross_amount: 10000 },
      { id: 'inv-2', currency: 'HUF', gross_amount: 25000 },
    ];
    mockItemProjectSummaries = {
      'inv-1': {
        invoiceId: 'inv-1',
        hasMultiProjects: true,
        totalProjectCount: 2,
        allocations: [
          { projectId: 'proj-1', percentage: 60 },
          { projectId: 'proj-2', percentage: 40 },
        ],
      },
      // inv-2 has no project (unassigned)
    };

    const { rerender } = render(<InvoiceBulkActionsBar />);
    // Initially shows multi-project from inv-1
    expect(screen.getByRole('button', { name: /2 projekt \(100%\)/i })).toBeInTheDocument();

    // User unchecks inv-1: only inv-2 remains
    mockActiveSelection = new Set(['inv-2']);
    rerender(<InvoiceBulkActionsBar />);

    // Now it MUST immediately switch back to unassigned Projekt... and Megosztás (%)
    expect(screen.getByText('Projekt...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Megosztás/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /2 projekt \(100%\)/i })).not.toBeInTheDocument();
  });
});
