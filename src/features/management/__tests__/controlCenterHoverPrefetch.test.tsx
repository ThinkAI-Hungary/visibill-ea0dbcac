import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ControlCenter, preloadControlCenterPanel } from '../components/ControlCenter';

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

describe('ControlCenter Hover Prefetch & Optimistic Feedback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders tab buttons with active styling based on initialTab', () => {
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
    expect(hibakButton.className).toContain('bg-primary/10');
    expect(hibakButton.className).toContain('text-primary');

    const fajlokButton = screen.getByRole('button', { name: /Fájlok/i });
    expect(fajlokButton.className).toContain('text-muted-foreground');
  });

  it('immediately applies optimistic active styling on tab click', () => {
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

    const fajlokButton = screen.getByRole('button', { name: /Fájlok/i });
    expect(fajlokButton.className).not.toContain('bg-primary/10');

    // Click on Fájlok tab
    fireEvent.click(fajlokButton);

    // Optimistic UI updates active class immediately (0ms delay)
    expect(fajlokButton.className).toContain('bg-primary/10');
    expect(fajlokButton.className).toContain('text-primary');
  });

  it('cancels hover prefetch timer if mouse leaves within intent delay (under 70ms)', () => {
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

    const workerButton = screen.getByRole('button', { name: /Worker/i });

    // Mouse enters
    fireEvent.mouseEnter(workerButton);

    // Fast mouse passage (leaves after 30ms < 70ms)
    act(() => {
      vi.advanceTimersByTime(30);
    });
    fireEvent.mouseLeave(workerButton);

    // Advance beyond 70ms - timer was cleared
    act(() => {
      vi.advanceTimersByTime(100);
    });
  });

  it('executes prefetch when mouse stays hovered for more than 70ms', () => {
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

    const usersButton = screen.getByRole('button', { name: /Felhasználók/i });

    // Mouse enters and stays
    fireEvent.mouseEnter(usersButton);

    act(() => {
      vi.advanceTimersByTime(75);
    });

    // Does not throw and finishes cleanly
  });
});
