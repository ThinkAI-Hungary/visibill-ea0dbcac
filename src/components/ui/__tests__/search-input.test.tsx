import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchInput } from '../search-input';

describe('SearchInput Component', () => {
  it('renders input with default placeholder and search icon', () => {
    render(<SearchInput placeholder="Keresés..." />);

    expect(screen.getByPlaceholderText('Keresés...')).toBeInTheDocument();
  });

  it('renders with borderless variant by default and applies correct wrapper styling', () => {
    const { container } = render(<SearchInput placeholder="Keresés..." variant="borderless" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('border-b');
    expect(wrapper).toHaveClass('bg-popover');
  });

  it('renders with boxed variant when specified', () => {
    const { container } = render(<SearchInput placeholder="Keresés..." variant="boxed" />);

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('rounded-md');
    expect(wrapper).toHaveClass('border');
  });

  it('shows clear button when value is present and clearable is true', () => {
    const onClear = vi.fn();
    render(<SearchInput value="test query" onChange={() => {}} onClear={onClear} clearable />);

    const clearBtn = screen.getByRole('button', { name: /Keresés törlése/i });
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('does not show clear button when input value is empty', () => {
    render(<SearchInput value="" onChange={() => {}} clearable />);

    expect(screen.queryByRole('button', { name: /Keresés törlése/i })).not.toBeInTheDocument();
  });

  it('clears on Escape key when value is present', () => {
    const onClear = vi.fn();
    render(<SearchInput value="test" onChange={() => {}} onClear={onClear} />);

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('renders rightElement badge or counter when passed', () => {
    render(<SearchInput placeholder="Search" rightElement={<span data-testid="counter">5 db</span>} />);

    expect(screen.getByTestId('counter')).toHaveTextContent('5 db');
  });
});
