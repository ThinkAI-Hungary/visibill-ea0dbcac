import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PettyCashPage from '@/pages/PettyCashPage';

const mockNavigate = vi.fn();
let mockParams = { tab: undefined as string | undefined };
let mockPathname = '/demo/petty-cash';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => mockParams,
    useLocation: () => ({ pathname: mockPathname }),
  };
});

vi.mock('@/lib/navigation', () => ({
  useScopedNavigate: () => mockNavigate,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'usr-123' } }),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'comp-123', name: 'Teszt Kft.', slug: 'teszt-kft' },
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

vi.mock('@/services/opgService', () => ({
  OpgService: {
    getTurnoverKpis: vi.fn().mockResolvedValue({
      totalGrossAmount: 100000,
      totalVatAmount: 21000,
      cashGrossAmount: 60000,
      cardGrossAmount: 40000,
      otherGrossAmount: 0,
      totalReceiptCount: 15,
      stornoReceiptCount: 1,
      pendingCashBookingCount: 3,
    }),
  },
}));

// Mock heavy subcomponents
vi.mock('@/components/petty-cash/EntriesTab', () => ({ default: () => <div data-testid="entries-tab-content">Tételek Tartalom</div> }));
vi.mock('@/components/petty-cash/ApprovalTab', () => ({ default: () => <div data-testid="approvals-tab-content">Jóváhagyások Tartalom</div> }));
vi.mock('@/components/petty-cash/CashReportsTab', () => ({ default: () => <div data-testid="reports-tab-content">Jelentések Tartalom</div> }));
vi.mock('@/components/petty-cash/RegistersTab', () => ({ default: () => <div data-testid="registers-tab-content">Pénztárak Tartalom</div> }));
vi.mock('@/components/petty-cash/RoutingRulesTab', () => ({ default: () => <div data-testid="rules-tab-content">Szabályok Tartalom</div> }));
vi.mock('@/pages/OpgPage', () => ({ default: () => <div data-testid="opg-embedded-page">OPG Beágyazott Tartalom</div> }));

describe('Házipénztár / OPG Fejléc Kapcsoló és Fülek Elrendezés Teszt', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <PettyCashPage />
      </QueryClientProvider>
    );

  it('Házipénztár módban: Házipénztár aktív/fehér, OPG szürke, és pontosan az 5 eredeti fül jelenik meg (nincs OPG fül a sorban)', async () => {
    mockParams = { tab: undefined };
    mockPathname = '/demo/petty-cash';

    renderComponent();

    // 1. Fejléc kapcsoló ellenőrzése
    const hazipenzBtn = await screen.findByRole('button', { name: /^Házipénztár$/i });
    const opgBtn = await screen.findByRole('button', { name: /^OPG/i });

    expect(hazipenzBtn).toBeInTheDocument();
    expect(opgBtn).toBeInTheDocument();

    // Házipénztár aktív (text-foreground), OPG kiszürkítve (text-muted-foreground)
    expect(hazipenzBtn.className).toContain('text-foreground');
    expect(opgBtn.className).toContain('text-muted-foreground/40');

    // 2. Fülek ellenőrzése: pontosan az 5 eredeti fül szerepel
    expect(screen.getByRole('tab', { name: /Tételek/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Jóváhagyások/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Pénztárjelentések/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Pénztárak/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Routing szabályok/i })).toBeInTheDocument();

    // Szigorú elvárás: a fülek között NEM szerepel OPG fül
    expect(screen.queryByRole('tab', { name: /Online pénztárgép/i })).not.toBeInTheDocument();
  });

  it('Az OPG gombra kattintva meghívja a navigációt a petty-cash/opg útvonalra', async () => {
    mockParams = { tab: undefined };
    mockPathname = '/demo/petty-cash';
    mockNavigate.mockClear();

    renderComponent();

    const opgBtn = await screen.findByRole('button', { name: /^OPG/i });
    fireEvent.click(opgBtn);

    expect(mockNavigate).toHaveBeenCalledWith('petty-cash/opg');
  });

  it('OPG módban: OPG aktív/fehér, Házipénztár szürke, és az OpgPage modul jelenik meg', async () => {
    mockParams = { tab: 'opg' };
    mockPathname = '/demo/petty-cash/opg';
    mockNavigate.mockClear();

    renderComponent();

    const hazipenzBtn = await screen.findByRole('button', { name: /^Házipénztár$/i });
    const opgBtn = await screen.findByRole('button', { name: /^OPG/i });

    // OPG fehér/aktív, Házipénztár szürke
    expect(opgBtn.className).toContain('text-foreground');
    expect(hazipenzBtn.className).toContain('text-muted-foreground/40');

    // OPG beágyazott tartalom betöltődik
    expect(await screen.findByTestId('opg-embedded-page')).toBeInTheDocument();

    // Házipénztár fülek nincsenek a képernyőn
    expect(screen.queryByRole('tab', { name: /Tételek/i })).not.toBeInTheDocument();

    // Visszakattintás Házipénztárra
    fireEvent.click(hazipenzBtn);
    expect(mockNavigate).toHaveBeenCalledWith('petty-cash');
  });
});
