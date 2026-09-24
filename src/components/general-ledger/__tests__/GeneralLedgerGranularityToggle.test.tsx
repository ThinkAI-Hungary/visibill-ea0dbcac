import { describe, it, expect } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Unit test to verify Kontírok vs Tételes granularity toggle behavior
describe('GeneralLedger - Granularity Toggle', () => {
  it('toggles between kontirok and teteles correctly', () => {
    function GranularityToggle() {
      const [viewGranularity, setViewGranularity] = useState<'kontirok' | 'teteles'>('kontirok');

      return (
        <div>
          <button
            onClick={() => setViewGranularity('kontirok')}
            data-active={viewGranularity === 'kontirok'}
          >
            Kontírok
          </button>
          <button
            onClick={() => setViewGranularity('teteles')}
            data-active={viewGranularity === 'teteles'}
          >
            Tételes
          </button>
          <span data-testid="active-mode">{viewGranularity}</span>
        </div>
      );
    }

    render(<GranularityToggle />);

    // Default mode must be 'kontirok'
    expect(screen.getByTestId('active-mode').textContent).toBe('kontirok');
    expect(screen.getByText('Kontírok').getAttribute('data-active')).toBe('true');
    expect(screen.getByText('Tételes').getAttribute('data-active')).toBe('false');

    // Switch to 'teteles'
    fireEvent.click(screen.getByText('Tételes'));
    expect(screen.getByTestId('active-mode').textContent).toBe('teteles');
    expect(screen.getByText('Kontírok').getAttribute('data-active')).toBe('false');
    expect(screen.getByText('Tételes').getAttribute('data-active')).toBe('true');

    // Switch back to 'kontirok'
    fireEvent.click(screen.getByText('Kontírok'));
    expect(screen.getByTestId('active-mode').textContent).toBe('kontirok');
    expect(screen.getByText('Kontírok').getAttribute('data-active')).toBe('true');
    expect(screen.getByText('Tételes').getAttribute('data-active')).toBe('false');
  });
});
