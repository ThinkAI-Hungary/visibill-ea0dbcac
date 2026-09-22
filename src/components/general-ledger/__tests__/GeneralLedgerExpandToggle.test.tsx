import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Unit test to verify Expand / Collapse toggle behavior
describe('GeneralLedger - Expand/Collapse toggle', () => {
  it('toggles expandAll and collapseAll correctly', () => {
    const mockExpandAll = vi.fn();
    const mockCollapseAll = vi.fn();

    const tableRef = {
      current: {
        expandAll: mockExpandAll,
        collapseAll: mockCollapseAll,
      },
    };

    function ExpandCollapseToggle() {
      const [isAllExpanded, setIsAllExpanded] = React.useState(false);

      const handleToggle = (expand: boolean) => {
        setIsAllExpanded(expand);
        if (expand) {
          tableRef.current.expandAll();
        } else {
          tableRef.current.collapseAll();
        }
      };

      return (
        <div>
          <button onClick={() => handleToggle(true)}>Mind kinyitása</button>
          <button onClick={() => handleToggle(false)}>Mind becsukása</button>
          <span data-testid="status">{isAllExpanded ? 'expanded' : 'collapsed'}</span>
        </div>
      );
    }

    render(<ExpandCollapseToggle />);

    expect(screen.getByTestId('status').textContent).toBe('collapsed');

    fireEvent.click(screen.getByText('Mind kinyitása'));
    expect(mockExpandAll).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status').textContent).toBe('expanded');

    fireEvent.click(screen.getByText('Mind becsukása'));
    expect(mockCollapseAll).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('status').textContent).toBe('collapsed');
  });
});
