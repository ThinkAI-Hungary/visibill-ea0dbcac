import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BulkDeleteDialog } from '../components/dialogs/BulkDeleteDialog';

const mockSetBulkDeleteDialogOpen = vi.fn();
const mockHandleBulkDeleteSubmitted = vi.fn();

let mockBulkDeleteDialogOpen = true;
let mockActiveSelection = new Set(['inv-1', 'inv-2', 'inv-3']);

vi.mock('../context/useInvoiceContext', () => ({
  useInvoiceContext: () => ({
    bulkDeleteDialogOpen: mockBulkDeleteDialogOpen,
    setBulkDeleteDialogOpen: mockSetBulkDeleteDialogOpen,
    activeSelection: mockActiveSelection,
    handleBulkDeleteSubmitted: mockHandleBulkDeleteSubmitted,
  }),
}));

describe('BulkDeleteDialog — Dual Choice Deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBulkDeleteDialogOpen = true;
    mockActiveSelection = new Set(['inv-1', 'inv-2', 'inv-3']);
  });

  it('renders dialog header, selected count, and two warning deletion options', () => {
    render(<BulkDeleteDialog />);

    expect(screen.getByText('Kijelölt bizonylatok törlése')).toBeInTheDocument();
    expect(screen.getByText(/3 db/i)).toBeInTheDocument();
    expect(screen.getByText('Csak a számlasorok törlése')).toBeInTheDocument();
    expect(screen.getByText('Számlasorok és feltöltött fájlok törlése')).toBeInTheDocument();
    expect(screen.getByText('Mégse')).toBeInTheDocument();
  });

  it('calls handleBulkDeleteSubmitted with "row_only" when Option 1 is clicked', async () => {
    mockHandleBulkDeleteSubmitted.mockResolvedValueOnce(undefined);

    render(<BulkDeleteDialog />);

    const option1Btn = screen.getByText('Csak a számlasorok törlése').closest('button')!;
    fireEvent.click(option1Btn);

    await waitFor(() => {
      expect(mockHandleBulkDeleteSubmitted).toHaveBeenCalledWith('row_only');
      expect(mockSetBulkDeleteDialogOpen).toHaveBeenCalledWith(false);
    });
  });

  it('calls handleBulkDeleteSubmitted with "row_and_file" when Option 2 is clicked', async () => {
    mockHandleBulkDeleteSubmitted.mockResolvedValueOnce(undefined);

    render(<BulkDeleteDialog />);

    const option2Btn = screen.getByText('Számlasorok és feltöltött fájlok törlése').closest('button')!;
    fireEvent.click(option2Btn);

    await waitFor(() => {
      expect(mockHandleBulkDeleteSubmitted).toHaveBeenCalledWith('row_and_file');
      expect(mockSetBulkDeleteDialogOpen).toHaveBeenCalledWith(false);
    });
  });

  it('closes dialog when cancel is clicked', () => {
    render(<BulkDeleteDialog />);

    const cancelBtn = screen.getByRole('button', { name: /Mégse/i });
    fireEvent.click(cancelBtn);

    expect(mockSetBulkDeleteDialogOpen).toHaveBeenCalledWith(false);
  });
});
