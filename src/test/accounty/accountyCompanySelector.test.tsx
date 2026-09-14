import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import AccountyCompanySelector from '@/components/accounty/layout/AccountyCompanySelector';
import { TooltipProvider } from '@/components/ui/tooltip';

const mockNavigate = vi.fn();
const mockHandleBackToPortfolio = vi.fn();

let mockShellContext: any = {};

vi.mock('@/pages/Accounty/AccountyShellContext', () => ({
  useAccountyShell: () => mockShellContext,
}));

describe('AccountyCompanySelector (Portfólió / Cégnézet Választó)', () => {
  const sampleClients = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      companyId: '11111111-1111-1111-1111-111111111111',
      name: 'Think Ai Kft',
      taxNumber: '32478620-2-43',
      entityType: 'kft',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      companyId: '22222222-2222-2222-2222-222222222222',
      name: 'Test Kft EV',
      taxNumber: '14160877-2-43',
      entityType: 'ev',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockShellContext = {
      selectedClientId: null,
      selectedClient: null,
      allClients: sampleClients,
      currentDateRange: '2026-01-01_2026-12-31',
      handleBackToPortfolio: mockHandleBackToPortfolio,
      navigate: mockNavigate,
    };
  });

  it('renders Portfólió nézet when in portfolio mode', () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <AccountyCompanySelector />
        </TooltipProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Portfólió nézet')).toBeInTheDocument();
    expect(screen.getByText('2 ügyfélcég')).toBeInTheDocument();
    expect(screen.getByText('Portfólió')).toBeInTheDocument();
  });

  it('opens popover and lists Teljes Portfólió and all clients on click', () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <AccountyCompanySelector />
        </TooltipProvider>
      </MemoryRouter>
    );

    const trigger = screen.getByTestId('accounty-company-selector');
    fireEvent.click(trigger);

    expect(screen.getByText('Teljes Portfólió')).toBeInTheDocument();
    expect(screen.getByText('Portfólió áttekintés és teendők')).toBeInTheDocument();
    expect(screen.getByText('Think Ai Kft')).toBeInTheDocument();
    expect(screen.getByText('Test Kft EV')).toBeInTheDocument();
  });

  it('navigates to client overview when a company is selected', () => {
    render(
      <MemoryRouter initialEntries={['/eaisybooks']}>
        <TooltipProvider>
          <AccountyCompanySelector />
        </TooltipProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('accounty-company-selector'));
    fireEvent.click(screen.getByText('Think Ai Kft'));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/eaisybooks/11111111-1111-1111-1111-111111111111/2026-01-01_2026-12-31/overview'
    );
  });

  it('renders selected company details when in client mode', () => {
    mockShellContext.selectedClientId = '22222222-2222-2222-2222-222222222222';
    mockShellContext.selectedClient = sampleClients[1];

    render(
      <MemoryRouter>
        <TooltipProvider>
          <AccountyCompanySelector isEv={true} />
        </TooltipProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Test Kft EV')).toBeInTheDocument();
    expect(screen.getByText('14160877-2-43')).toBeInTheDocument();
    expect(screen.getByText('EV')).toBeInTheDocument();
  });

  it('calls handleBackToPortfolio when clicking Teljes Portfólió in client mode', () => {
    mockShellContext.selectedClientId = '22222222-2222-2222-2222-222222222222';
    mockShellContext.selectedClient = sampleClients[1];

    render(
      <MemoryRouter>
        <TooltipProvider>
          <AccountyCompanySelector />
        </TooltipProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('accounty-company-selector'));
    fireEvent.click(screen.getByText('Teljes Portfólió'));

    expect(mockHandleBackToPortfolio).toHaveBeenCalledTimes(1);
  });

  it('filters clients list via search input', () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <AccountyCompanySelector />
        </TooltipProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('accounty-company-selector'));
    const searchInput = screen.getByPlaceholderText('Cég vagy adószám keresése...');

    fireEvent.change(searchInput, { target: { value: 'Think' } });
    expect(screen.getByText('Think Ai Kft')).toBeInTheDocument();
    expect(screen.queryByText('Test Kft EV')).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    expect(screen.getByText('Nincs találat')).toBeInTheDocument();
  });

  it('renders in collapsed mode with icon button and tooltip', () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <AccountyCompanySelector isCollapsed={true} />
        </TooltipProvider>
      </MemoryRouter>
    );

    const btn = screen.getByRole('button', { name: 'Portfólió nézet' });
    expect(btn).toBeInTheDocument();
  });
});
