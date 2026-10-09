import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JournalFilterModal } from '../JournalFilterModal';
import { DEFAULT_JOURNAL_FILTER_CRITERIA } from '../journalFilterUtils';

describe('JournalFilterModal', () => {
  it('renders RLB filter fields when open', () => {
    render(
      <JournalFilterModal
        open={true}
        onOpenChange={vi.fn()}
        criteria={DEFAULT_JOURNAL_FILTER_CRITERIA}
        onApplyCriteria={vi.fn()}
        onResetCriteria={vi.fn()}
        journals={[{ id: 'j-1', code: 'V', name: 'Vevő napló' }]}
        currentJournalName="Vevő napló"
      />
    );

    expect(screen.getByText('Szűkítés')).toBeInTheDocument();
    expect(screen.queryByText('RLB minta')).not.toBeInTheDocument();
    expect(screen.getByText('Vevő számlák (311)')).toBeInTheDocument();
    expect(screen.getByText('Szállító számlák (454)')).toBeInTheDocument();
    expect(screen.getByText('Főkönyvi szám')).toBeInTheDocument();
    expect(screen.getByText('Bizonylatszám')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Szűkít/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alaphelyzet/i })).toBeInTheDocument();
  });

  it('calls onApplyCriteria when Szűkít button is clicked', () => {
    const handleApply = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <JournalFilterModal
        open={true}
        onOpenChange={handleOpenChange}
        criteria={DEFAULT_JOURNAL_FILTER_CRITERIA}
        onApplyCriteria={handleApply}
        onResetCriteria={vi.fn()}
      />
    );

    const applyButton = screen.getByRole('button', { name: /Szűkít/i });
    fireEvent.click(applyButton);

    expect(handleApply).toHaveBeenCalledWith(DEFAULT_JOURNAL_FILTER_CRITERIA);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it('updates draft input values and applies modified criteria', () => {
    const handleApply = vi.fn();

    render(
      <JournalFilterModal
        open={true}
        onOpenChange={vi.fn()}
        criteria={DEFAULT_JOURNAL_FILTER_CRITERIA}
        onApplyCriteria={handleApply}
        onResetCriteria={vi.fn()}
      />
    );

    const glInput = screen.getByPlaceholderText('pl. 311, 4541, 911');
    fireEvent.change(glInput, { target: { value: '3111' } });

    const applyButton = screen.getByRole('button', { name: /Szűkít/i });
    fireEvent.click(applyButton);

    expect(handleApply).toHaveBeenCalledWith(
      expect.objectContaining({
        fokonyviSzam: '3111',
      })
    );
  });
});
