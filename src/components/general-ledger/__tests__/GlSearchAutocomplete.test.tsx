import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlSearchAutocomplete } from '../GlSearchAutocomplete';
import * as glData from '@/lib/glData';

vi.mock('@/lib/glData', () => ({
  searchGlEntities: vi.fn(),
}));

describe('GlSearchAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders input with default or custom placeholder', () => {
    render(
      <GlSearchAutocomplete
        companyId="comp-1"
        presetId="preset-1"
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText('Keresés a főkönyvben (szám, név, partner)...')).toBeInTheDocument();
  });

  it('does not trigger search when query is less than 2 characters', async () => {
    render(
      <GlSearchAutocomplete
        companyId="comp-1"
        presetId="preset-1"
        onSelect={vi.fn()}
      />
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'a' } });

    await new Promise((r) => setTimeout(r, 350));
    expect(glData.searchGlEntities).not.toHaveBeenCalled();
  });

  it('triggers debounced search and displays account and item results', async () => {
    const mockResults: glData.GlSearchResult[] = [
      {
        entity_type: 'account',
        entity_id: '261',
        gl_number: '261',
        title: '261 - Kereskedelmi áruk',
        subtitle: 'Főkönyvi számla',
        account_id: 'acc-1',
        target_gl_number: '261',
        amount: null,
      },
      {
        entity_type: 'item',
        entity_id: 'item_123',
        gl_number: '2611',
        title: 'Fender Stratocaster',
        subtitle: 'Fender Europe • 450,000 Ft',
        account_id: 'acc-2',
        target_gl_number: '2611',
        amount: 450000,
      },
    ];
    (glData.searchGlEntities as any).mockResolvedValue(mockResults);

    const onSelectMock = vi.fn();
    render(
      <GlSearchAutocomplete
        companyId="comp-1"
        presetId="preset-1"
        onSelect={onSelectMock}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'fender' } });

    await waitFor(() => {
      expect(glData.searchGlEntities).toHaveBeenCalledWith({
        companyId: 'comp-1',
        presetId: 'preset-1',
        query: 'fender',
        limit: 14,
      });
    });

    expect(await screen.findByText('Főkönyvi számlák')).toBeInTheDocument();
    expect(screen.getByText('Tételek és bizonylatok')).toBeInTheDocument();
    expect(screen.getByText('Fender Stratocaster')).toBeInTheDocument();

    // Click item
    const itemButton = screen.getByText('Fender Stratocaster').closest('button');
    expect(itemButton).not.toBeNull();
    fireEvent.click(itemButton!);

    expect(onSelectMock).toHaveBeenCalledWith(mockResults[1]);
  });

  it('clears query and calls onClear when X button is clicked', async () => {
    const onClearMock = vi.fn();
    render(
      <GlSearchAutocomplete
        companyId="comp-1"
        presetId="preset-1"
        onSelect={vi.fn()}
        onClear={onClearMock}
      />
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'teszt' } });
    expect(input.value).toBe('teszt');

    const clearButton = screen.getByRole('button', { name: 'Keresés törlése' });
    fireEvent.click(clearButton);

    expect(input.value).toBe('');
    expect(onClearMock).toHaveBeenCalled();
  });

  it('notifies onQueryChange and onSearchResultsChange on input and results', async () => {
    const onQueryChangeMock = vi.fn();
    const onSearchResultsChangeMock = vi.fn();
    const mockResults: glData.GlSearchResult[] = [
      {
        entity_type: 'account',
        entity_id: '467',
        gl_number: '467',
        title: '467 - Fizetendő áfa',
        subtitle: 'Főkönyvi számla',
        account_id: 'acc-467',
        target_gl_number: '467',
        amount: null,
      },
    ];
    (glData.searchGlEntities as any).mockResolvedValue(mockResults);

    render(
      <GlSearchAutocomplete
        companyId="comp-1"
        presetId="preset-1"
        onSelect={vi.fn()}
        onQueryChange={onQueryChangeMock}
        onSearchResultsChange={onSearchResultsChangeMock}
      />
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '467' } });

    expect(onQueryChangeMock).toHaveBeenCalledWith('467');

    await waitFor(() => {
      expect(onSearchResultsChangeMock).toHaveBeenCalledWith(mockResults);
    });
  });
});
