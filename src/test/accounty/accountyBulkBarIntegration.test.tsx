import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MissingInvoicesBulkBar } from '@/pages/Accounty/missing-invoices/MissingInvoicesBulkBar';
import { FloatingBulkBar } from '@/components/ui/floating-bulk-bar';
import ClientListView from '@/components/accounty/dashboard/ClientListView';
import { BrowserRouter } from 'react-router-dom';

import { beforeAll } from 'vitest';

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

vi.mock('@/components/accounty/dashboard/DashboardShared', () => ({
  OwnerDropdown: () => <div data-testid="mock-owner-dropdown" />,
  StatusBadge: () => <div data-testid="mock-status-badge" />,
}));

describe('Accounty FloatingBulkBar Integration', () => {
  it('renders MissingInvoicesBulkBar using FloatingBulkBar when items are selected', () => {
    const handleSend = vi.fn();
    const handleDelete = vi.fn();
    const handleClear = vi.fn();

    const mockInvoices = [
      {
        id: 'inv-1',
        vendor: 'Test Szállító Kft.',
        amount: '120 000 Ft',
        dueDate: '2026-09-01',
        lastNotice: '2026-09-05',
        status: 'Felszólítva',
        category: 'warning',
      },
    ];

    const { rerender } = render(
      <MissingInvoicesBulkBar
        selectedIds={[]}
        invoices={mockInvoices as any}
        onSendToApprovalQueue={handleSend}
        onBulkDelete={handleDelete}
        onClearSelection={handleClear}
      />
    );

    // When no items selected, nothing renders
    expect(screen.queryByTestId('floating-bulk-bar')).not.toBeInTheDocument();

    // When items selected, FloatingBulkBar renders
    rerender(
      <MissingInvoicesBulkBar
        selectedIds={['inv-1']}
        invoices={mockInvoices as any}
        onSendToApprovalQueue={handleSend}
        onBulkDelete={handleDelete}
        onClearSelection={handleClear}
      />
    );

    const bar = screen.getByTestId('floating-bulk-bar');
    expect(bar).toBeInTheDocument();
    expect(screen.getByText(/Kijelölt számlák:/i)).toBeInTheDocument();
    expect(screen.getByText('1 db')).toBeInTheDocument();
    expect(screen.getByText('Felszólítás küldése')).toBeInTheDocument();
    expect(screen.getByText('Megérkezett')).toBeInTheDocument();
    expect(screen.getByText('Törlés')).toBeInTheDocument();
    expect(screen.getByText('Mégse')).toBeInTheDocument();

    // Click Mégse calls onClearSelection
    fireEvent.click(screen.getByText('Mégse'));
    expect(handleClear).toHaveBeenCalledTimes(1);

    // Click Felszólítás küldése calls onSendToApprovalQueue
    fireEvent.click(screen.getByText('Felszólítás küldése'));
    expect(handleSend).toHaveBeenCalledTimes(1);
    expect(handleSend).toHaveBeenCalledWith([mockInvoices[0]]);
  });

  it('renders FloatingBulkBar in ClientListView when clients are selected', () => {
    const mockClients = [
      {
        id: 'client-1',
        name: 'Alfa Kft.',
        taxNumber: '12345678-1-42',
        unprocessedCount: 5,
        missingCount: 2,
        deadline: '2026-09-20',
        responsible: 'Kovács János',
        status: 'Aktív',
        colorHex: 'bg-blue-500/10 text-blue-600',
      },
      {
        id: 'client-2',
        name: 'Béta Zrt.',
        taxNumber: '87654321-2-41',
        unprocessedCount: 0,
        missingCount: 0,
        deadline: '2026-09-25',
        responsible: 'Nagy Éva',
        status: 'Rendezett',
        colorHex: 'bg-emerald-500/10 text-emerald-600',
      },
    ];

    render(
      <BrowserRouter>
        <ClientListView
          filteredClients={mockClients as any}
          handleUpdateOwner={vi.fn()}
          searchQuery=""
          statusFilter="Minden"
        />
      </BrowserRouter>
    );

    // Initially no bulk bar
    expect(screen.queryByTestId('floating-bulk-bar')).not.toBeInTheDocument();

    // Select row by clicking checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox is header (all), second is client-1
    fireEvent.click(checkboxes[1]);

    // FloatingBulkBar should now appear
    expect(screen.getByTestId('floating-bulk-bar')).toBeInTheDocument();
    expect(screen.getByText(/Kijelölt ügyfelek:/i)).toBeInTheDocument();
    expect(screen.getByText('1 db')).toBeInTheDocument();
    expect(screen.getByText('Mind kijelölése')).toBeInTheDocument();
    expect(screen.getByText('Mégse')).toBeInTheDocument();

    // Clicking Mégse dismisses selection
    fireEvent.click(screen.getByText('Mégse'));
    expect(screen.queryByTestId('floating-bulk-bar')).not.toBeInTheDocument();
  });

  it('supports staged status selection with Save button', () => {
    const handleSave = vi.fn();
    const handleCancel = vi.fn();

    const TestStagedBar = () => {
      const [stagedStatus, setStagedStatus] = React.useState<string | null>(null);
      return (
        <FloatingBulkBar
          count={3}
          label="Kijelölt számlák:"
          onSave={handleSave}
          saveLabel="Mentés"
          isDirty={stagedStatus !== null}
          onCancel={handleCancel}
        >
          <FloatingBulkBar.Select
            value={stagedStatus}
            onValueChange={(val) => setStagedStatus(val)}
            placeholder="Státusz módosítása..."
            options={[
              { value: 'Új', label: 'Új' },
              { value: 'Kontírozott', label: 'Kontírozott' },
            ]}
          />
        </FloatingBulkBar>
      );
    };

    render(<TestStagedBar />);

    // Initially, Mentés button is not visible in dirty-only mode
    expect(screen.queryByText('Mentés')).not.toBeInTheDocument();

    // Open dropdown and select 'Kontírozott'
    fireEvent.click(screen.getByText('Státusz módosítása...'));
    fireEvent.click(screen.getByText('Kontírozott'));

    // Now 'Mentés' button appears because isDirty is true
    const saveBtn = screen.getByText('Mentés');
    expect(saveBtn).toBeInTheDocument();

    // Click Mentés calls handleSave
    fireEvent.click(saveBtn);
    expect(handleSave).toHaveBeenCalledTimes(1);
  });
});
