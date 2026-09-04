import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CustomTooltip } from '../custom-tooltip';

describe('CustomTooltip', () => {
  it('renders children directly when content is empty or null', () => {
    render(
      <CustomTooltip content="">
        <button>Test Button</button>
      </CustomTooltip>
    );

    expect(screen.getByText('Test Button')).toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders trigger and shows tooltip content on hover/focus', async () => {
    render(
      <CustomTooltip content="Segítség szöveg">
        <button>Hover Me</button>
      </CustomTooltip>
    );

    const button = screen.getByText('Hover Me');
    expect(button).toBeInTheDocument();

    fireEvent.pointerEnter(button);
    fireEvent.focus(button);

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Segítség szöveg');
    });
  });

  it('handles non-element children by wrapping in span', () => {
    render(
      <CustomTooltip content="Szöveges tooltip">
        Csak egy egyszerű szöveg
      </CustomTooltip>
    );

    expect(screen.getByText('Csak egy egyszerű szöveg')).toBeInTheDocument();
  });
});
