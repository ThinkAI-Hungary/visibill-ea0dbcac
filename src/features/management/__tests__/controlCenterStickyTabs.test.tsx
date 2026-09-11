import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ControlCenter } from '../components/ControlCenter';

// Mock sub-panels so tests stay light
vi.mock('../components/errors/ErrorControlPanel', () => ({
  ErrorControlPanel: () => <div data-testid="errors-panel">Errors Panel</div>,
}));
vi.mock('../components/permissions/PermissionsPanel', () => ({
  PermissionsPanel: () => <div data-testid="permissions-panel">Permissions Panel</div>,
}));
vi.mock('../components/files/FilesPanel', () => ({
  FilesPanel: () => <div data-testid="files-panel">Files Panel</div>,
}));
vi.mock('../components/worker/WorkerPanel', () => ({
  WorkerPanel: () => <div data-testid="worker-panel">Worker Panel</div>,
}));
vi.mock('../components/user/UsersControlPanel', () => ({
  UsersControlPanel: () => <div data-testid="users-panel">Users Panel</div>,
}));

describe('ControlCenter Sticky Tab Bar', () => {
  it('renders tab bar inside a sticky container with backdrop blur and border', () => {
    render(
      <MemoryRouter>
        <ControlCenter
          initialTab="errors"
          onOpenCompany={vi.fn()}
          allUsers={[]}
          overviewLoading={false}
          companyCostMap={new Map()}
        />
      </MemoryRouter>
    );

    const hibakButton = screen.getByRole('button', { name: /Hibák/i });
    expect(hibakButton).toBeInTheDocument();

    // The sticky container surrounding or containing the tab buttons
    const stickyContainer = hibakButton.closest('div.sticky');
    expect(stickyContainer).not.toBeNull();
    expect(stickyContainer?.className).toContain('sticky');
    expect(stickyContainer?.className).toContain('top-0');
    expect(stickyContainer?.className).toContain('z-30');
    expect(stickyContainer?.className).toContain('backdrop-blur');

    // Root element should NOT have overflow-hidden (which breaks CSS sticky)
    const rootElement = stickyContainer?.parentElement;
    expect(rootElement?.className).not.toContain('overflow-hidden');
  });
});
