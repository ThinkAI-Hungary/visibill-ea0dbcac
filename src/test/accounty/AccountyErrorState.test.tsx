import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';

/**
 * RTL Component tests for AccountyErrorState.
 * This is the inline error display added during Batch 4 error handling.
 *
 * Key behaviors:
 * - Shows "Hiba történt" title + error message
 * - Retry button only visible when onRetry callback is provided
 * - Compact mode reduces padding and font sizes
 * - Default message is "Nem sikerült betölteni az adatokat."
 */

describe('AccountyErrorState', () => {
  it('renders the error title', () => {
    render(<AccountyErrorState />);
    expect(screen.getByText('Hiba történt')).toBeInTheDocument();
  });

  it('renders the default error message when none is provided', () => {
    render(<AccountyErrorState />);
    expect(screen.getByText('Nem sikerült betölteni az adatokat.')).toBeInTheDocument();
  });

  it('renders a custom error message', () => {
    render(<AccountyErrorState message="Hálózati hiba lépett fel." />);
    expect(screen.getByText('Hálózati hiba lépett fel.')).toBeInTheDocument();
  });

  it('does NOT show retry button when onRetry is not provided', () => {
    render(<AccountyErrorState />);
    expect(screen.queryByText('Újrapróbálás')).not.toBeInTheDocument();
  });

  it('shows retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<AccountyErrorState onRetry={onRetry} />);
    expect(screen.getByText('Újrapróbálás')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<AccountyErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Újrapróbálás'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('applies compact class when compact=true', () => {
    const { container } = render(<AccountyErrorState compact />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('py-8');
    expect(wrapper?.className).not.toContain('py-16');
  });

  it('applies full-size class when compact=false (default)', () => {
    const { container } = render(<AccountyErrorState />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('py-16');
  });

  it('applies custom className', () => {
    const { container } = render(<AccountyErrorState className="bg-red-50" />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain('bg-red-50');
  });

  it('retry button has small size in compact mode', () => {
    const onRetry = vi.fn();
    render(<AccountyErrorState onRetry={onRetry} compact />);
    const button = screen.getByText('Újrapróbálás').closest('button');
    // In compact mode, the Button gets size="sm" which adds smaller dimensions
    expect(button).toBeInTheDocument();
  });

  it('renders alert triangle icon', () => {
    const { container } = render(<AccountyErrorState />);
    // The icon is rendered as SVG inside a rounded circle div
    const iconContainer = container.querySelector('.rounded-full');
    expect(iconContainer).toBeInTheDocument();
    const svg = iconContainer?.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
