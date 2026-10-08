import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ManageJournalsModal, JournalItem } from '../ManageJournalsModal';

const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mockUpdate.mockReturnValue({
        eq: mockEq.mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
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
];

describe('ManageJournalsModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with journals table and headers', () => {
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
    expect(screen.getByText('B2')).toBeInTheDocument();
    expect(screen.getByText('K&H bank EUR')).toBeInTheDocument();
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

    // Click edit on the first journal
    const editButtons = screen.getAllByTitle('Szerkesztés');
    fireEvent.click(editButtons[0]);

    // Full edit modal appears with journal details (EB-0257)
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
});
