import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatePicker } from '../date-picker';

describe('DatePicker', () => {
  it('renders with placeholder when no value is provided', () => {
    render(<DatePicker placeholder="Válassz dátumot" />);
    expect(screen.getByText('Válassz dátumot')).toBeInTheDocument();
  });

  it('renders formatted Hungarian date string for ISO date value', () => {
    render(<DatePicker value="2026-05-31" />);
    expect(screen.getByText('2026. 05. 31.')).toBeInTheDocument();
  });

  it('supports custom date formatting', () => {
    render(<DatePicker value="2026-05-31" formatStr="yyyy. MMMM d." />);
    expect(screen.getByText('2026. május 31.')).toBeInTheDocument();
  });

  it('opens calendar popover when clicked', () => {
    render(<DatePicker value="2026-05-31" />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    expect(document.querySelector('.rdp')).toBeInTheDocument();
  });
});
