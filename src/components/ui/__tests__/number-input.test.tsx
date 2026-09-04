import { describe, it, expect, vi } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumberInput } from '../number-input';

describe('NumberInput', () => {
  it('renders input with custom stepper buttons by default', () => {
    render(<NumberInput placeholder="Összeg..." defaultValue={100} />);
    const input = screen.getByPlaceholderText('Összeg...');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'number');

    const upButton = screen.getByRole('button', { name: /érték növelése/i });
    const downButton = screen.getByRole('button', { name: /érték csökkentése/i });
    expect(upButton).toBeInTheDocument();
    expect(downButton).toBeInTheDocument();

    // Must be tabIndex -1 to protect fast keyboard navigation
    expect(upButton).toHaveAttribute('tabindex', '-1');
    expect(downButton).toHaveAttribute('tabindex', '-1');
    expect(upButton).toHaveAttribute('type', 'button');
    expect(downButton).toHaveAttribute('type', 'button');
  });

  it('increments value on up button click', () => {
    const handleChange = vi.fn();
    render(<NumberInput defaultValue={50} step={10} onChange={handleChange} />);

    const upButton = screen.getByRole('button', { name: /érték növelése/i });
    fireEvent.mouseDown(upButton);

    expect(handleChange).toHaveBeenCalled();
  });

  it('decrements value on down button click', () => {
    const handleChange = vi.fn();
    render(<NumberInput defaultValue={50} step={10} onChange={handleChange} />);

    const downButton = screen.getByRole('button', { name: /érték csökkentése/i });
    fireEvent.mouseDown(downButton);

    expect(handleChange).toHaveBeenCalled();
  });

  it('hides stepper buttons when showStepper={false}', () => {
    render(<NumberInput placeholder="Nincs léptető" showStepper={false} />);
    expect(screen.queryByRole('button', { name: /érték növelése/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /érték csökkentése/i })).not.toBeInTheDocument();
  });

  it('disables stepper buttons when disabled={true}', () => {
    render(<NumberInput disabled defaultValue={100} />);
    const upButton = screen.getByRole('button', { name: /érték növelése/i });
    const downButton = screen.getByRole('button', { name: /érték csökkentése/i });
    expect(upButton).toBeDisabled();
    expect(downButton).toBeDisabled();
  });

  it('works in controlled mode with state updates', () => {
    function ControlledTest() {
      const [val, setVal] = useState(100);
      return (
        <NumberInput
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          step={50}
        />
      );
    }

    render(<ControlledTest />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('100');

    const upButton = screen.getByRole('button', { name: /érték növelése/i });
    fireEvent.mouseDown(upButton);
    expect(input.value).toBe('150');

    const downButton = screen.getByRole('button', { name: /érték csökkentése/i });
    fireEvent.mouseDown(downButton);
    expect(input.value).toBe('100');
  });

  it('respects min and max bounds', () => {
    function BoundedTest() {
      const [val, setVal] = useState(10);
      return (
        <NumberInput
          value={val}
          onChange={(e) => setVal(Number(e.target.value))}
          step={5}
          min={5}
          max={15}
        />
      );
    }

    render(<BoundedTest />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    const upButton = screen.getByRole('button', { name: /érték növelése/i });
    const downButton = screen.getByRole('button', { name: /érték csökkentése/i });

    // Step up to 15 (max)
    fireEvent.mouseDown(upButton);
    expect(input.value).toBe('15');

    // Trying to step up again should not exceed max
    fireEvent.mouseDown(upButton);
    expect(input.value).toBe('15');

    // Step down to 10
    fireEvent.mouseDown(downButton);
    expect(input.value).toBe('10');

    // Step down to 5 (min)
    fireEvent.mouseDown(downButton);
    expect(input.value).toBe('5');

    // Trying to step down again should not go below min
    fireEvent.mouseDown(downButton);
    expect(input.value).toBe('5');
  });
});
