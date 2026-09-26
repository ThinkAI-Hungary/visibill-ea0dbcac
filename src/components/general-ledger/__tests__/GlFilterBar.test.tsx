import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GlFilterBar } from '../GlFilterBar';

vi.mock('@/components/general-ledger/GlSearchAutocomplete', () => ({
  GlSearchAutocomplete: () => <div data-testid="search-autocomplete">Search</div>,
}));

describe('GlFilterBar', () => {
  const defaultProps = {
    selectedCompanyId: 'comp-1',
    activePresetId: 'preset-1',
    dateFrom: '2026-01-01',
    dateTo: '2026-12-31',
    dateBasis: 'teljesites' as const,
    postingStatus: 'all' as const,
    hideZeroBalances: false,
    viewLayout: 'summary' as const,
    viewGranularity: 'kontirok' as const,
    itemGrouping: 'by_invoice' as const,
    isAllExpanded: false,
    onDateBasisChange: vi.fn(),
    onPostingStatusChange: vi.fn(),
    onHideZeroChange: vi.fn(),
    onViewLayoutChange: vi.fn(),
    onGranularityChange: vi.fn(),
    onItemGroupingChange: vi.fn(),
    onToggleExpandAll: vi.fn(),
    onSearchQueryChange: vi.fn(),
    onSearchResultsChange: vi.fn(),
    onSelectSearchResult: vi.fn(),
    onClearSearch: vi.fn(),
  };

  it('renders filter bar with search, date range, and standard filters', () => {
    render(<GlFilterBar {...defaultProps} />);

    expect(screen.getByTestId('search-autocomplete')).toBeInTheDocument();
    expect(screen.getByText('2026.01.01 – 2026.12.31')).toBeInTheDocument();
    expect(screen.getByText('Kibocsátás')).toBeInTheDocument();
    expect(screen.getByText('Teljesítés')).toBeInTheDocument();
    expect(screen.getByText('Összes tétel')).toBeInTheDocument();
    expect(screen.getByText('Csak lekönyvelt')).toBeInTheDocument();
    expect(screen.getByText('Kontírok')).toBeInTheDocument();
    expect(screen.getByText('Tételes')).toBeInTheDocument();
  });

  it('handles date basis change', () => {
    render(<GlFilterBar {...defaultProps} />);

    fireEvent.click(screen.getByText('Kibocsátás'));
    expect(defaultProps.onDateBasisChange).toHaveBeenCalledWith('kibocsatas');
  });

  it('handles posting status change', () => {
    render(<GlFilterBar {...defaultProps} />);

    fireEvent.click(screen.getByText('Csak lekönyvelt'));
    expect(defaultProps.onPostingStatusChange).toHaveBeenCalledWith('posted_only');
  });

  it('handles hide zero balances change', () => {
    render(<GlFilterBar {...defaultProps} />);

    fireEvent.click(screen.getByText('Csak forgalom'));
    expect(defaultProps.onHideZeroChange).toHaveBeenCalledWith(true);
  });

  it('handles view layout change', () => {
    render(<GlFilterBar {...defaultProps} />);

    fireEvent.click(screen.getByText('Klasszikus'));
    expect(defaultProps.onViewLayoutChange).toHaveBeenCalledWith('classic');
  });

  it('handles expand and collapse all actions', () => {
    render(<GlFilterBar {...defaultProps} />);

    fireEvent.click(screen.getByText('Mind kinyitása'));
    expect(defaultProps.onToggleExpandAll).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText('Mind összecsukása'));
    expect(defaultProps.onToggleExpandAll).toHaveBeenCalledWith(false);
  });

  it('progressive disclosure: hides item grouping pills when granularity is kontirok', () => {
    render(<GlFilterBar {...defaultProps} viewGranularity="kontirok" />);

    expect(screen.queryByText('Számlánként')).not.toBeInTheDocument();
    expect(screen.queryByText('Tételenként')).not.toBeInTheDocument();
  });

  it('progressive disclosure: displays item grouping pills when granularity is teteles', () => {
    render(<GlFilterBar {...defaultProps} viewGranularity="teteles" />);

    expect(screen.getByText('Számlánként')).toBeInTheDocument();
    expect(screen.getByText('Tételenként')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Tételenként'));
    expect(defaultProps.onItemGroupingChange).toHaveBeenCalledWith('detailed');
  });
});
