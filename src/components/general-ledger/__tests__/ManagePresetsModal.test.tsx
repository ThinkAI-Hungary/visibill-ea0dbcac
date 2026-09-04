import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ManagePresetsModal } from '../ManagePresetsModal';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/cache', () => ({
  invalidateGlQueries: vi.fn().mockResolvedValue(undefined),
}));

describe('ManagePresetsModal', () => {
  let queryClient: QueryClient;

  const mockPresets = [
    {
      id: 'preset-active',
      name: 'Jó számlatükör',
      type: 'custom',
      company_id: 'comp-1',
      is_active: true,
    },
    {
      id: 'preset-inactive',
      name: 'Régi számlatükör',
      type: 'custom',
      company_id: 'comp-1',
      is_active: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ManagePresetsModal
          open={true}
          onOpenChange={vi.fn()}
          presets={mockPresets}
          companyId="comp-1"
          {...props}
        />
      </QueryClientProvider>
    );
  };

  it('renders custom presets for the current company', () => {
    renderComponent();
    expect(screen.getByText('Jó számlatükör')).toBeInTheDocument();
    expect(screen.getByText('Régi számlatükör')).toBeInTheDocument();
    expect(screen.getByText('Aktiválva')).toBeInTheDocument();
  });

  it('disables delete button for active preset with tooltip', () => {
    renderComponent();
    const activeDeleteButton = screen.getByRole('button', { name: /Aktív sablon nem törölhető: Jó számlatükör/i });
    expect(activeDeleteButton).toBeInTheDocument();
    expect(activeDeleteButton).toBeDisabled();
  });

  it('checks usage and opens confirmation dialog when deleting inactive preset without references', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        preset_id: 'preset-inactive',
        preset_name: 'Régi számlatükör',
        is_active: false,
        accounts_count: 50,
        total_references: 0,
        journal_lines_count: 0,
        transactions_count: 0,
        invoices_count: 0,
        can_delete_directly: true,
        sample_used_accounts: [],
      },
      error: null,
    } as any);

    renderComponent();

    const deleteBtn = screen.getByRole('button', { name: /Sablon törlése: Régi számlatükör/i });
    expect(deleteBtn).not.toBeDisabled();

    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('check_chart_of_accounts_preset_usage', {
        p_preset_id: 'preset-inactive',
      });
    });

    expect(await screen.findByText(/Számlatükör Sablon Törlése/i)).toBeInTheDocument();
    expect(screen.getByText('Végleges törlés')).toBeInTheDocument();
  });

  it('prompts for remapping when deleting an inactive preset that has references', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        preset_id: 'preset-inactive',
        preset_name: 'Régi számlatükör',
        is_active: false,
        accounts_count: 100,
        total_references: 14,
        journal_lines_count: 14,
        transactions_count: 0,
        invoices_count: 0,
        can_delete_directly: false,
        sample_used_accounts: [{ gl_number: '311', short_name: 'Vevők' }],
      },
      error: null,
    } as any);

    renderComponent();

    const deleteBtn = screen.getByRole('button', { name: /Sablon törlése: Régi számlatükör/i });
    fireEvent.click(deleteBtn);

    expect(await screen.findByText(/Ez a számlatükör jelenleg használatban van:/i)).toBeInTheDocument();
    expect(screen.getByText(/14 db/i)).toBeInTheDocument();
    expect(screen.getByText(/Hová kössük át a hivatkozásokat a törlés előtt?/i)).toBeInTheDocument();
    expect(screen.getByText('Átkötés és törlés')).toBeInTheDocument();
  });

  it('submits remap and delete request when user confirms with selected target', async () => {
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({
        data: {
          preset_id: 'preset-inactive',
          preset_name: 'Régi számlatükör',
          is_active: false,
          accounts_count: 100,
          total_references: 14,
          journal_lines_count: 14,
          transactions_count: 0,
          invoices_count: 0,
          can_delete_directly: false,
          sample_used_accounts: [{ gl_number: '311', short_name: 'Vevők' }],
        },
        error: null,
      } as any)
      .mockResolvedValueOnce({
        data: {
          success: true,
          deleted_preset_id: 'preset-inactive',
          deleted_preset_name: 'Régi számlatükör',
          target_preset_id: 'preset-active',
          remapped_journal_lines: 14,
          remapped_transactions: 0,
          remapped_invoices: 0,
        },
        error: null,
      } as any);

    renderComponent();

    const deleteBtn = screen.getByRole('button', { name: /Sablon törlése: Régi számlatükör/i });
    fireEvent.click(deleteBtn);

    const confirmBtn = await screen.findByText('Átkötés és törlés');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('delete_chart_of_accounts_preset', {
        p_preset_id: 'preset-inactive',
        p_target_preset_id: 'preset-active',
      });
    });
  });
});
