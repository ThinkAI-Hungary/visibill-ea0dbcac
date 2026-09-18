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

  it('supports direct text typing when allowInput is true', () => {
    const handleChange = vi.fn();
    render(<DatePicker value="2026-05-31" allowInput={true} onChange={handleChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('2026-05-31');

    fireEvent.change(input, { target: { value: '2026.06.15' } });
    fireEvent.blur(input);

    expect(handleChange).toHaveBeenCalledWith('2026-06-15');
  });

  it('parses Hungarian dot-delimited and 8-digit dates correctly when typed', () => {
    const handleChange = vi.fn();
    render(<DatePicker allowInput={true} onChange={handleChange} />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '20260131' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(handleChange).toHaveBeenCalledWith('2026-01-31');
  });
});
