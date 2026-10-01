import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CreateJournalModal, suggestNextJournalCode } from '../CreateJournalModal';

// Mock Supabase
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert.mockReturnValue({
        select: mockSelect.mockReturnValue({
          single: mockSingle,
        }),
      }),
    })),
  },
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock react-query
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

describe('suggestNextJournalCode', () => {
  it('suggests B1 when no bank journals exist', () => {
    expect(suggestNextJournalCode('BANK', [])).toBe('B1');
  });

  it('suggests next bank code sequentially (B3 when B1 and B2 exist)', () => {
    const existing = [{ code: 'B1' }, { code: 'B2' }];
    expect(suggestNextJournalCode('BANK', existing)).toBe('B3');
  });

  it('suggests highest + 1 even if gaps exist', () => {
    const existing = [{ code: 'B1' }, { code: 'B4' }];
    expect(suggestNextJournalCode('BANK', existing)).toBe('B5');
  });

  it('suggests next petty cash code (P2 when P1 exists)', () => {
    const existing = [{ code: 'P1' }];
    expect(suggestNextJournalCode('PETTY_CASH', existing)).toBe('P2');
  });

  it('suggests VE when no mixed journal exists', () => {
    expect(suggestNextJournalCode('MIXED', [])).toBe('VE');
  });

  it('suggests VE2 when VE exists', () => {
    expect(suggestNextJournalCode('MIXED', [{ code: 'VE' }])).toBe('VE2');
  });
});

describe('CreateJournalModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal with prefilled suggested code and values when opened', () => {
    render(
      <CreateJournalModal
        open={true}
        onOpenChange={vi.fn()}
        companyId="test-company-123"
        initialType="BANK"
        initialName="OTP Bank HUF"
        initialCurrency="HUF"
        existingJournals={[{ id: '1', code: 'B1', type: 'BANK', name: 'K&H HUF' }, { id: '2', code: 'B2', type: 'BANK', name: 'K&H EUR' }]}
      />
    );

    expect(screen.getByText('Új Könyvelési Napló Létrehozása')).toBeInTheDocument();
    // Suggested code should be B3
    const codeInput = screen.getByLabelText(/Naplókód/);
    expect(codeInput).toHaveValue('B3');
    // Name should be OTP Bank HUF
    const nameInput = screen.getByLabelText(/Napló megnevezése/);
    expect(nameInput).toHaveValue('OTP Bank HUF');
  });

  it('prevents duplicate journal code and warns user', async () => {
    render(
      <CreateJournalModal
        open={true}
        onOpenChange={vi.fn()}
        companyId="test-company-123"
        existingJournals={[{ id: '1', code: 'B1', type: 'BANK', name: 'K&H HUF' }]}
      />
    );

    const codeInput = screen.getByLabelText(/Naplókód/);
    fireEvent.change(codeInput, { target: { value: 'B1' } });
    const nameInput = screen.getByLabelText(/Napló megnevezése/);
    fireEvent.change(nameInput, { target: { value: 'Duplikált napló' } });

    const submitBtn = screen.getByRole('button', { name: /Napló Létrehozása/ });
    fireEvent.click(submitBtn);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Már létező naplókód',
        variant: 'destructive',
      })
    );
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('successfully creates new journal and triggers callback', async () => {
    const onCreated = vi.fn();
    const onOpenChange = vi.fn();

    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'new-j-id',
        code: 'B3',
        name: 'OTP Bank HUF',
        type: 'BANK',
        currency: 'HUF',
        connected_gl_account: '3842',
      },
      error: null,
    });

    render(
      <CreateJournalModal
        open={true}
        onOpenChange={onOpenChange}
        companyId="test-company-123"
        initialName="OTP Bank HUF"
        existingJournals={[{ id: '1', code: 'B1', type: 'BANK', name: 'K&H HUF' }, { id: '2', code: 'B2', type: 'BANK', name: 'K&H EUR' }]}
        onJournalCreated={onCreated}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Napló Létrehozása/ });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith({
        company_id: 'test-company-123',
        code: 'B3',
        name: 'OTP Bank HUF',
        type: 'BANK',
        currency: 'HUF',
        connected_gl_account: null,
        is_active: true,
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['acc-journals', 'test-company-123'] });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['acc-bank-journals', 'test-company-123'] });
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-j-id', code: 'B3' }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
