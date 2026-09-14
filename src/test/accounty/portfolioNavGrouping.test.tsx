import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import PortfolioNav from '@/components/accounty/layout/PortfolioNav';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock AccountyShellContext
const mockToggleSection = vi.fn();
const mockToggleSubSection = vi.fn();
const mockHandlePrefetch = vi.fn();

let mockContextValue: any = {};

vi.mock('@/pages/Accounty/AccountyShellContext', () => ({
  useAccountyShell: () => mockContextValue,
}));

describe('PortfolioNav Navigation Redesign (Teendők, Portfólió, Segítség, Beállítások)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockContextValue = {
      isCollapsed: false,
      handlePrefetch: mockHandlePrefetch,
      isPathActive: (path: string) => path === '/eaisybooks',
      isActive: (path: string) => path === '/eaisybooks',
      kpis: { missingItems: 491 },
      unreadTicketCount: 3,
      canAccess: () => true,
      expandedSections: new Set(['admin']),
      toggleSection: mockToggleSection,
      expandedSubSections: new Set(['office']),
      toggleSubSection: mockToggleSubSection,
      subGroups: [
        {
          id: 'office',
          label: 'Iroda & Beállítások',
          icon: () => <span data-testid="office-icon" />,
          items: [
            { to: '/eaisybooks/settings', label: 'Beállítások', icon: () => <span /> },
          ],
        },
        {
          id: 'professional',
          label: 'Szakmai Törzsadatok',
          icon: () => <span data-testid="prof-icon" />,
          items: [
            { to: '/eaisybooks/admin/tax-parameters', label: 'Adómértékek', icon: () => <span /> },
          ],
        },
      ],
      hoveredHelpSection: null,
      allClients: [],
      expandedPayroll: new Set(),
      togglePayrollClient: vi.fn(),
      payrollSearch: '',
      setPayrollSearch: vi.fn(),
      showAllPayroll: false,
      setShowAllPayroll: vi.fn(),
    };
  });

  it('renders all 4 main category headers in expanded view', () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <PortfolioNav />
        </TooltipProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Teendők')).toBeInTheDocument();
    // Portfólió is both category header and main item
    const portfolioTexts = screen.getAllByText('Portfólió');
    expect(portfolioTexts.length).toBeGreaterThanOrEqual(2);
    // Segítség is both category header and item
    const segitsegTexts = screen.getAllByText('Segítség');
    expect(segitsegTexts.length).toBeGreaterThanOrEqual(2);
    // Beállítások header button
    const beallitasokElements = screen.getAllByText('Beállítások');
    expect(beallitasokElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Teendők group items with red badge on Hiányzó számlák', () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <PortfolioNav />
        </TooltipProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Hiányzó számlák')).toBeInTheDocument();
    expect(screen.getByText('491')).toBeInTheDocument();
    expect(screen.getByText('Jóváhagyási sor')).toBeInTheDocument();
    expect(screen.getByText('Riasztások')).toBeInTheDocument();
    expect(screen.getByText('Adónaptár & Határidők')).toBeInTheDocument();
  });

  it('renders Portfólió group items', () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <PortfolioNav />
        </TooltipProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Bérszámfejtés Ciklusok')).toBeInTheDocument();
    expect(screen.getByText('Irodai Riportok')).toBeInTheDocument();
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
  });

  it('renders Szakmai Törzsadatok under Portfólió as collapsible sub-menu and toggles on click', () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <PortfolioNav />
        </TooltipProvider>
      </MemoryRouter>
    );

    const profBtn = screen.getByText('Szakmai Törzsadatok');
    expect(profBtn).toBeInTheDocument();

    fireEvent.click(profBtn);
    expect(mockToggleSubSection).toHaveBeenCalledWith('professional');
  });

  it('renders Szakmai Törzsadatok child items when professional section is expanded', () => {
    mockContextValue.expandedSubSections = new Set(['professional']);

    render(
      <MemoryRouter>
        <TooltipProvider>
          <PortfolioNav />
        </TooltipProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Adómértékek')).toBeInTheDocument();
  });

  it('excludes Szakmai Törzsadatok from Beállítások group', () => {
    mockContextValue.expandedSections = new Set(['admin']);
    mockContextValue.expandedSubSections = new Set(['office', 'professional']);

    render(
      <MemoryRouter>
        <TooltipProvider>
          <PortfolioNav />
        </TooltipProvider>
      </MemoryRouter>
    );

    // Beállítások button exists
    const buttons = screen.getAllByRole('button');
    const beallitasokBtn = buttons.find(b => b.textContent?.includes('Beállítások'));
    expect(beallitasokBtn).toBeDefined();

    // Szakmai Törzsadatok only appears once on page (under Portfólió, not duplicated in Beállítások)
    const profOccurrences = screen.getAllByText('Szakmai Törzsadatok');
    expect(profOccurrences).toHaveLength(1);

    // Iroda & Beállítások appears in Beállítások
    expect(screen.getByText('Iroda & Beállítások')).toBeInTheDocument();
  });

  it('renders Segítség group items with AI Asszisztens and Hibajegyek badge', () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <PortfolioNav />
        </TooltipProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('AI Asszisztens')).toBeInTheDocument();
    expect(screen.getByText('Hibajegyek')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    const segitsegTexts = screen.getAllByText('Segítség');
    expect(segitsegTexts.length).toBeGreaterThanOrEqual(2);
  });

  it('renders Beállítások collapsible trigger and toggles on click', () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <PortfolioNav />
        </TooltipProvider>
      </MemoryRouter>
    );

    // Click the Beállítások section header button
    const buttons = screen.getAllByRole('button');
    const beallitasokBtn = buttons.find(b => b.textContent?.includes('Beállítások'));
    expect(beallitasokBtn).toBeDefined();

    fireEvent.click(beallitasokBtn!);
    expect(mockToggleSection).toHaveBeenCalledWith('admin');
  });

  it('renders collapsed view with icons and badges correctly', () => {
    mockContextValue.isCollapsed = true;

    render(
      <MemoryRouter>
        <TooltipProvider>
          <PortfolioNav />
        </TooltipProvider>
      </MemoryRouter>
    );

    // Categories are not text headers in collapsed mode
    expect(screen.queryByText('Teendők')).not.toBeInTheDocument();
    // Badges: > 9 is formatted as 9+
    expect(screen.getByText('9+')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
