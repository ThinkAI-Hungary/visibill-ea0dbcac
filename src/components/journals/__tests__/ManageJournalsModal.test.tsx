import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ManageJournalsModal, JournalItem } from '../ManageJournalsModal';

const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mockUpdate.mockReturnValue({
        eq: mockEq.mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      delete: mockDelete.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      select: mockSelect.mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ journal_id: 'j-1' }, { journal_id: 'j-1' }],
          count: 0,
          error: null,
        }),
      }),
    })),
  },
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
  useQuery: vi.fn(({ queryKey }) => {
    if (queryKey[0] === 'acc-journal-header-counts') {
      return {
        data: { 'j-1': 5, 'j-2': 0, 'j-core': 0 },
        isLoading: false,
        refetch: vi.fn(),
      };
    }
    return { data: undefined, isLoading: false };
  }),
}));

const mockJournals: JournalItem[] = [
  {
    id: 'j-1',
    company_id: 'comp-1',
    code: 'B1',
    name: 'K&H bank HUF',
    type: 'BANK',
    currency: 'HUF',
    connected_gl_account: '3841',
    is_active: true,
  },
  {
    id: 'j-2',
    company_id: 'comp-1',
    code: 'B2',
    name: 'K&H bank EUR',
    type: 'BANK',
    currency: 'EUR',
    connected_gl_account: '3861',
    is_active: true,
  },
  {
    id: 'j-core',
    company_id: 'comp-1',
    code: 'SZ',
    name: 'Szállító számlák',
    type: 'SUPPLIER',
    currency: 'HUF',
    connected_gl_account: '454',
    is_active: true,
  },
];

describe('ManageJournalsModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with journals table, counts, and action buttons', () => {
    render(
      <ManageJournalsModal
        open={true}
        onOpenChange={vi.fn()}
        companyId="comp-1"
        journals={mockJournals}
      />
    );

    expect(screen.getByText('Könyvelési Naplótörzs Kezelése')).toBeInTheDocument();
    expect(screen.getByText('B1')).toBeInTheDocument();
    expect(screen.getByText('K&H bank HUF')).toBeInTheDocument();
    expect(screen.getByText('5 db')).toBeInTheDocument();
    expect(screen.getByText('B2')).toBeInTheDocument();
    expect(screen.getAllByText('0 db').length).toBeGreaterThanOrEqual(1);
  });

  it('opens CreateJournalModal in Edit mode when clicking edit on a journal', async () => {
    render(
      <ManageJournalsModal
        open={true}
        onOpenChange={vi.fn()}
        companyId="comp-1"
        journals={mockJournals}
      />
    );

    const editButtons = screen.getAllByTitle('Szerkesztés');
    fireEvent.click(editButtons[0]);

    expect(screen.getByText(/Könyvelési Napló Módosítása/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('K&H bank HUF')).toBeInTheDocument();
    expect(screen.getByDisplayValue('B1')).toBeInTheDocument();
  });

  it('opens child CreateJournalModal when clicking Új Napló button', () => {
    render(
      <ManageJournalsModal
        open={true}
        onOpenChange={vi.fn()}
        companyId="comp-1"
        journals={mockJournals}
      />
    );

    const newBtn = screen.getByRole('button', { name: /Új Napló/i });
    fireEvent.click(newBtn);

    expect(screen.getByText('Új Könyvelési Napló Létrehozása')).toBeInTheDocument();
  });

  it('blocks deletion of core system journals with a toast notification', () => {
    render(
      <ManageJournalsModal
        open={true}
        onOpenChange={vi.fn()}
        companyId="comp-1"
        journals={mockJournals}
      />
    );

    // SZ is a core system journal (j-core, 3rd journal)
    const deleteButtons = screen.getAllByRole('button', { name: 'Törlés' });
    fireEvent.click(deleteButtons[2]);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Védett rendszer-napló',
        variant: 'destructive',
      })
    );
  });

  it('shows blocked dialog when trying to delete journal with recorded entries', () => {
    render(
      <ManageJournalsModal
        open={true}
        onOpenChange={vi.fn()}
        companyId="comp-1"
        journals={mockJournals}
      />
    );

    // B1 has 5 entries
    const deleteButtons = screen.getAllByRole('button', { name: 'Törlés' });
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByText('A napló nem törölhető')).toBeInTheDocument();
    expect(screen.getAllByText(/5 db/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Napló inaktiválása most')).toBeInTheDocument();
  });

  it('opens confirmation dialog when deleting a journal with 0 entries and executes delete', async () => {
    const onJournalDeletedMock = vi.fn();
    render(
      <ManageJournalsModal
        open={true}
        onOpenChange={vi.fn()}
        companyId="comp-1"
        journals={mockJournals}
        onJournalDeleted={onJournalDeletedMock}
      />
    );

    // B2 has 0 entries
    const deleteButtons = screen.getAllByRole('button', { name: 'Törlés' });
    fireEvent.click(deleteButtons[1]);

    expect(screen.getByText('Napló törlése')).toBeInTheDocument();
    expect(screen.getByText(/Biztosan törölni szeretné a\(z\)/)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Napló végleges törlése' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Napló sikeresen törölve',
        })
      );
      expect(onJournalDeletedMock).toHaveBeenCalledWith('j-2');
    });
  });
});
