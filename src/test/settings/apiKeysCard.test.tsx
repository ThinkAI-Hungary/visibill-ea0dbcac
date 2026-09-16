import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiKeysCard } from '@/components/settings/ApiKeysCard';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-marco-123', email: 'marco@mauroni.com' } }),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    companies: [
      { id: 'comp-1', name: 'RIOTER Sport Bt.' },
      { id: 'comp-2', name: 'Mauroni Events Kft.' },
    ],
  }),
}));

describe('ApiKeysCard Component Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ApiKeysCard />
      </QueryClientProvider>
    );
  };

  it('renders card title, description and API docs toggle button', async () => {
    const selectMock = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as any);

    renderComponent();

    expect(screen.getByText('Programozói Hozzáférés & API Kulcsok')).toBeInTheDocument();
    expect(screen.getByText('API Dokumentáció')).toBeInTheDocument();
    expect(screen.getByText('Új API kulcs')).toBeInTheDocument();
  });

  it('toggles cURL API documentation when clicking the docs button', async () => {
    const selectMock = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as any);

    renderComponent();

    const docBtn = screen.getByText('API Dokumentáció');
    fireEvent.click(docBtn);

    expect(screen.getByText(/customer-api\?action=companies/)).toBeInTheDocument();
    expect(screen.getByText('Dokumentáció elrejtése')).toBeInTheDocument();
  });

  it('renders list of existing API keys with prefix, scope and status badges', async () => {
    const mockKeys = [
      {
        id: 'key-1',
        name: 'ERP Sync Key',
        key_prefix: 'vb_ee51911a',
        scope: 'read_write',
        company_id: null,
        user_id: 'user-marco-123',
        is_active: true,
        last_used_at: '2026-09-16T11:49:00Z',
        created_at: '2026-09-16T10:00:00Z',
      },
      {
        id: 'key-2',
        name: 'Report Key',
        key_prefix: 'vb_aa112233',
        scope: 'read',
        company_id: 'comp-1',
        user_id: 'user-marco-123',
        is_active: false,
        last_used_at: null,
        created_at: '2026-09-15T10:00:00Z',
      },
    ];

    const selectMock = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: mockKeys, error: null }),
    });
    vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as any);

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('ERP Sync Key')).toBeInTheDocument();
      expect(screen.getByText('vb_ee51911a...')).toBeInTheDocument();
      expect(screen.getByText('Írás / Olvasás')).toBeInTheDocument();
      expect(screen.getByText('Aktív')).toBeInTheDocument();
      expect(screen.getByText('Report Key')).toBeInTheDocument();
      expect(screen.getByText('Csak Olvasás')).toBeInTheDocument();
      expect(screen.getByText('Visszavonva')).toBeInTheDocument();
    });
  });

  it('opens new key dialog when clicking Új API kulcs button', async () => {
    const selectMock = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as any);

    renderComponent();

    const addBtn = screen.getByText('Új API kulcs');
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Új Ügyfél API Kulcs Generálása')).toBeInTheDocument();
      expect(screen.getByLabelText('Kulcs Megnevezése')).toBeInTheDocument();
      expect(screen.getByText('Kulcs létrehozása')).toBeInTheDocument();
    });
  });
});
