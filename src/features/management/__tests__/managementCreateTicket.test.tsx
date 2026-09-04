import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ManagementCreateTicketDialog, type ManagementUserOption } from '../components/tickets/ManagementCreateTicketDialog';
import * as managementApi from '../api/managementApi';

// Mock managementApi
vi.mock('../api/managementApi', () => ({
  createTicketOnBehalf: vi.fn(),
  fetchManagementData: vi.fn(),
  postManagementData: vi.fn(),
}));

// Mock useToast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock useSupportAgents
vi.mock('@/hooks/useTickets', () => ({
  useSupportAgents: () => ({
    data: [
      { user_id: 'agent-1', name: 'Support Admin János', email: 'janos@thinkai.hu' },
    ],
  }),
}));

// Mock RichTextEditor
vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: ({ onChange, placeholder, onSubmit }: any) => (
    <textarea
      data-testid="mock-rich-editor"
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          onSubmit?.();
        }
      }}
    />
  ),
}));

const mockUsers: ManagementUserOption[] = [
  {
    id: 'prof-1',
    user_id: 'user-uuid-1',
    name: 'Kovács Péter',
    email: 'peter.kovacs@example.com',
    companies: [
      { id: 'comp-1', name: 'Alpha Kft.', role: 'owner' },
      { id: 'comp-2', name: 'Beta Zrt.', role: 'member' },
    ],
  },
  {
    id: 'prof-2',
    user_id: 'user-uuid-2',
    name: 'Nagy Anna',
    email: 'anna.nagy@example.com',
    companies: [
      { id: 'comp-3', name: 'Gamma Bt.', role: 'owner' },
    ],
  },
];

describe('ManagementCreateTicketDialog', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  const renderDialog = (props?: Partial<React.ComponentProps<typeof ManagementCreateTicketDialog>>) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ManagementCreateTicketDialog
          open={true}
          onOpenChange={vi.fn()}
          users={mockUsers}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  it('renders dialog title and form fields correctly', () => {
    renderDialog();
    expect(screen.getByText('Új hibajegy nyitása ügyfél nevében')).toBeDefined();
    expect(screen.getByText('Érintett Felhasználó (User) *')).toBeDefined();
    expect(screen.getByText('Érintett Cég')).toBeDefined();
    expect(screen.getByText('Szolgáltatás')).toBeDefined();
    expect(screen.getByText('Típus')).toBeDefined();
    expect(screen.getByText('Prioritás')).toBeDefined();
    expect(screen.getByText('Hibajegy Létrehozása')).toBeDefined();
  });

  it('keeps submit button disabled until user and message are provided', () => {
    renderDialog();
    const submitBtn = screen.getByRole('button', { name: /Hibajegy Létrehozása/i });
    expect(submitBtn.hasAttribute('disabled')).toBe(true);
  });

  it('allows selecting a user from the combobox and updates form', async () => {
    renderDialog();

    // Open user popover combobox
    const userPickerBtn = screen.getByTestId('user-combobox-trigger');
    fireEvent.click(userPickerBtn);

    // Click on Kovács Péter
    const userOption = await screen.findByText('Kovács Péter');
    fireEvent.click(userOption);

    // Combobox now shows Kovács Péter
    expect(screen.getByText('Kovács Péter')).toBeDefined();

    // Fill message in RichTextEditor
    const editor = screen.getByTestId('mock-rich-editor');
    fireEvent.change(editor, { target: { value: 'Számla letöltési hiba lépett fel' } });

    // Submit button should now be enabled
    const submitBtn = screen.getByRole('button', { name: /Hibajegy Létrehozása/i });
    expect(submitBtn.hasAttribute('disabled')).toBe(false);
  });

  it('successfully submits ticket payload via createTicketOnBehalf', async () => {
    const mockOnTicketCreated = vi.fn();
    const mockOnOpenChange = vi.fn();
    (managementApi.createTicketOnBehalf as any).mockResolvedValueOnce({
      success: true,
      ticket: { id: 'ticket-123', ticket_number: 'EB-0042', user_name: 'Kovács Péter' },
    });

    renderDialog({
      onTicketCreated: mockOnTicketCreated,
      onOpenChange: mockOnOpenChange,
    });

    // Select user
    fireEvent.click(screen.getByTestId('user-combobox-trigger'));
    fireEvent.click(await screen.findByText('Kovács Péter'));

    // Type message
    const editor = screen.getByTestId('mock-rich-editor');
    fireEvent.change(editor, { target: { value: 'Nem érkezett meg a NAV szinkron' } });

    // Click submit
    const submitBtn = screen.getByRole('button', { name: /Hibajegy Létrehozása/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(managementApi.createTicketOnBehalf).toHaveBeenCalledWith(
        expect.objectContaining({
          targetUserId: 'user-uuid-1',
          companyId: 'comp-1',
          message: 'Nem érkezett meg a NAV szinkron',
          service: 'eaisybill',
          type: 'bug',
          priority: 'medium',
        })
      );
      expect(mockOnTicketCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'ticket-123', ticket_number: 'EB-0042' })
      );
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
