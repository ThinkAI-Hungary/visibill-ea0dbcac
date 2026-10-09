import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TicketPriorityBadge } from '@/components/tickets/TicketPriorityBadge';

describe('TicketPriorityBadge', () => {
  it('renders standard text badge by default', () => {
    render(<TicketPriorityBadge priority="critical" />);
    expect(screen.getByText('Kritikus')).toBeInTheDocument();
  });

  it('renders dotOnly indicator with custom tooltip content and no native title attribute', () => {
    render(<TicketPriorityBadge priority="critical" dotOnly />);

    // Text label should NOT be rendered in the DOM as a visible text badge
    expect(screen.queryByText('Kritikus')).not.toBeInTheDocument();

    // The dot container should exist with aria-label and WITHOUT native title to prevent double tooltips
    const dotTrigger = screen.getByTestId('priority-dot');
    expect(dotTrigger).toBeInTheDocument();
    expect(dotTrigger).not.toHaveAttribute('title');
    expect(dotTrigger).toHaveAttribute('aria-label', expect.stringContaining('Kritikus'));

    // Inner dot has the red dot class for critical
    const innerDot = dotTrigger.querySelector('.bg-red-500');
    expect(innerDot).toBeInTheDocument();
  });

  it('applies corresponding color classes for different priorities in dotOnly mode', () => {
    const { rerender } = render(<TicketPriorityBadge priority="high" dotOnly />);
    expect(screen.getByTestId('priority-dot')).toHaveAttribute('aria-label', expect.stringContaining('Magas'));
    expect(screen.getByTestId('priority-dot').querySelector('.bg-orange-500')).toBeInTheDocument();

    rerender(<TicketPriorityBadge priority="medium" dotOnly />);
    expect(screen.getByTestId('priority-dot')).toHaveAttribute('aria-label', expect.stringContaining('Közepes'));
    expect(screen.getByTestId('priority-dot').querySelector('.bg-amber-500')).toBeInTheDocument();

    rerender(<TicketPriorityBadge priority="low" dotOnly />);
    expect(screen.getByTestId('priority-dot')).toHaveAttribute('aria-label', expect.stringContaining('Alacsony'));
    expect(screen.getByTestId('priority-dot').querySelector('.bg-slate-400')).toBeInTheDocument();
  });
});
