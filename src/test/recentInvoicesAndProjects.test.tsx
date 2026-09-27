import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecentInvoices from '@/components/dashboard/RecentInvoices';
import ProjectBreakdown from '@/components/dashboard/ProjectBreakdown';
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown';
import InvoiceImageDialog from '@/components/InvoiceImageDialog';
import QuickActions from '@/components/dashboard/QuickActions';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/navigation', () => ({
  useScopedNavigate: () => vi.fn(),
}));

vi.mock('@/features/invoices/utils/invoiceChainFetch', () => ({
  fetchInvoiceChain: vi.fn().mockResolvedValue({
    currentDbInvoice: null,
    companionInvoices: [],
    currentRole: 'Számla',
  }),
  INVOICE_TYPE_LABELS: {},
}));

describe('RecentInvoices - Fintech Dense Split', () => {
  const sampleInvoices = [
    {
      id: 'inv-1',
      bizonylatsorszam: '9762E0F0-0205',
      elado_nev: 'Anthropic, PBC',
      vevo_nev: 'Think AI Kft',
      brutto_vegosszeg: 45,
      kibocsatas_datuma: '2026-09-26T10:00:00Z',
      statusz: 'jovahagyasra_var',
      penznem: 'USD',
      invoice_direction: 'INBOUND',
      melleklet_url: 'https://storage.example.com/inv-1.pdf',
    },
    {
      id: 'inv-2',
      bizonylatsorszam: 'A01902005/2146/00002',
      elado_nev: 'Think AI Kft',
      vevo_nev: 'Gál-Gók Kft',
      brutto_vegosszeg: 13590,
      kibocsatas_datuma: '2026-09-24T12:00:00Z',
      statusz: 'feldolgozva',
      penznem: 'HUF',
      invoice_direction: 'OUTBOUND',
      project_name: 'teszt projekt',
    },
  ];

  it('renders recent invoices with synchronized height and correct direction indicators', () => {
    const { container } = render(
      <MemoryRouter>
        <RecentInvoices invoices={sampleInvoices} />
      </MemoryRouter>
    );

    const card = container.querySelector('.h-\\[520px\\]');
    expect(card).toBeInTheDocument();

    expect(screen.getByText('9762E0F0-0205')).toBeInTheDocument();
    expect(screen.getByText('A01902005/2146/00002')).toBeInTheDocument();
    expect(screen.getByText('Anthropic, PBC → Think AI Kft')).toBeInTheDocument();
    expect(screen.getByText('teszt projekt')).toBeInTheDocument();

    // Check partner text truncation class and tooltip
    const partnerEl = screen.getByText('Anthropic, PBC → Think AI Kft').closest('p');
    expect(partnerEl).toHaveClass('truncate');
    expect(partnerEl).toHaveAttribute('title', expect.stringContaining('Anthropic, PBC → Think AI Kft'));
  });

  it('calls onRowClick when clicking the invoice row', () => {
    const handleRowClick = vi.fn();
    const handleViewInvoice = vi.fn();

    render(
      <MemoryRouter>
        <RecentInvoices
          invoices={sampleInvoices}
          onRowClick={handleRowClick}
          onViewInvoice={handleViewInvoice}
        />
      </MemoryRouter>
    );

    const invoiceRow = screen.getByText('9762E0F0-0205').closest('div[class*="cursor-pointer"]');
    expect(invoiceRow).toBeInTheDocument();
    fireEvent.click(invoiceRow!);

    expect(handleRowClick).toHaveBeenCalledTimes(1);
    expect(handleRowClick).toHaveBeenCalledWith(sampleInvoices[0]);
    expect(handleViewInvoice).not.toHaveBeenCalled();
  });

  it('calls onViewInvoice and stops propagation when clicking the eye button', () => {
    const handleRowClick = vi.fn();
    const handleViewInvoice = vi.fn();

    render(
      <MemoryRouter>
        <RecentInvoices
          invoices={sampleInvoices}
          onRowClick={handleRowClick}
          onViewInvoice={handleViewInvoice}
        />
      </MemoryRouter>
    );

    const eyeButtons = screen.getAllByRole('button', { name: /számlakép megtekintése/i });
    expect(eyeButtons.length).toBe(2);

    fireEvent.click(eyeButtons[0]);

    expect(handleViewInvoice).toHaveBeenCalledTimes(1);
    expect(handleViewInvoice).toHaveBeenCalledWith(sampleInvoices[0]);
    expect(handleRowClick).not.toHaveBeenCalled();
  });

  it('renders empty state when no invoices exist', () => {
    render(
      <MemoryRouter>
        <RecentInvoices invoices={[]} />
      </MemoryRouter>
    );

    expect(screen.getByText('Még nincsenek feldolgozott számlák')).toBeInTheDocument();
  });
});

describe('ProjectBreakdown - Fintech Dense Split', () => {
  const sampleProjects = [
    {
      id: 'proj-1',
      name: 'teszt projekt',
      description: 'Fő működési alprojekt',
      invoice_count: 1,
      total_amount: 425450,
      avg_amount: 425450,
      percentage: 100,
    },
  ];

  it('renders project list, progress bar, 2x2 mini KPIs, and new project CTA banner', () => {
    const { container } = render(
      <MemoryRouter>
        <ProjectBreakdown projects={sampleProjects} totalAmount={425450} />
      </MemoryRouter>
    );

    const card = container.querySelector('.h-\\[520px\\]');
    expect(card).toBeInTheDocument();

    expect(screen.getByText('teszt projekt')).toBeInTheDocument();
    expect(screen.getByText('Fő működési alprojekt')).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
    expect(screen.getByText('1 számla')).toBeInTheDocument();

    // 2x2 Mini KPI labels
    expect(screen.getByText('Átlag bizonylat')).toBeInTheDocument();
    expect(screen.getByText('Allokáció')).toBeInTheDocument();
    expect(screen.getByText('Aktív projektek')).toBeInTheDocument();
    expect(screen.getByText('Összes keret')).toBeInTheDocument();

    // CTA
    expect(screen.getByText('Új projekt indítása')).toBeInTheDocument();
    const newProjectBtn = screen.getByRole('button', { name: /Új projekt/i });
    expect(newProjectBtn).toHaveTextContent('Új projekt');
    expect(newProjectBtn.textContent?.trim()).toBe('Új projekt');
  });

  it('renders empty state when no projects exist', () => {
    render(
      <MemoryRouter>
        <ProjectBreakdown projects={[]} totalAmount={0} />
      </MemoryRouter>
    );

    expect(screen.getByText('Még nincsenek aktív projektek')).toBeInTheDocument();
  });
});

describe('InvoiceImageDialog - Dynamic Preview and Voucher Resolution', () => {
  it('renders preview modal when melleklet_url is provided', () => {
    render(
      <InvoiceImageDialog
        open={true}
        onClose={vi.fn()}
        invoice={{
          id: 'inv-upload-1',
          bizonylatsorszam: 'A15701858/0779/00006',
          elado_nev: 'Magyar Posta Zrt.',
          vevo_nev: 'Think AI Kft.',
          brutto_vegosszeg: 5790,
          adoalap_osszesen: 4559,
          kibocsatas_datuma: '2026-09-24',
          teljesites_datuma: '2026-09-24',
          penznem: 'HUF',
          melleklet_url: 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/storage/v1/object/public/invoice-uploads/sample.pdf',
        }}
      />
    );

    // FilePreviewModal should render with PDF title / iframe
    expect(document.querySelector('iframe')).toBeInTheDocument();
  });

  it('renders dynamic Beküldött Bizonylat fallback when invoice has no file but is a submitted invoice', () => {
    render(
      <InvoiceImageDialog
        open={true}
        onClose={vi.fn()}
        invoice={{
          id: 'inv-manual-1',
          bizonylatsorszam: 'MAN-2026-001',
          elado_nev: 'Partner Kft.',
          vevo_nev: 'Think AI Kft.',
          brutto_vegosszeg: 12700,
          adoalap_osszesen: 10000,
          kibocsatas_datuma: '2026-09-20',
          teljesites_datuma: '2026-09-18',
          penznem: 'HUF',
          statusz: 'feldolgozva',
        }}
      />
    );

    expect(screen.getByText('Beküldött Bizonylat')).toBeInTheDocument();
    expect(screen.getByText('Partner Kft.')).toBeInTheDocument();
    expect(screen.getByText('MAN-2026-001')).toBeInTheDocument();
    expect(screen.getByText('2026-09-18 (Kelt: 2026-09-20)')).toBeInTheDocument();
    expect(screen.getByText('12 700 Ft')).toBeInTheDocument();
    expect(screen.getByText('Nettó: 10 000 Ft')).toBeInTheDocument();
  });
});

describe('CategoryBreakdown - Dense Split', () => {
  const sampleCategories = [
    {
      id: 'cat-1',
      name: 'AI',
      description: 'Mesterséges intelligencia előfizetések',
      color: '#6366F1',
      icon: null,
      invoiceCount: 4,
      totalAmount: 24877500,
      currencyTotals: { HUF: 24877500, EUR: 264.25 },
      percentage: 60,
    },
    {
      id: 'cat-2',
      name: 'IT és szoftver',
      description: 'Szoftver licencek',
      color: '#A855F7',
      icon: null,
      invoiceCount: 2,
      totalAmount: 5158623,
      currencyTotals: { HUF: 5158623, EUR: 294 },
      percentage: 20,
    },
  ];

  it('renders category list with color dots, names, invoice counts, and amounts', () => {
    const { container } = render(
      <MemoryRouter>
        <CategoryBreakdown categories={sampleCategories} />
      </MemoryRouter>
    );

    const card = container.querySelector('.h-\\[520px\\]');
    expect(card).toBeInTheDocument();

    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText('IT és szoftver')).toBeInTheDocument();
    expect(screen.getByText('(4)')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();

    // CTA
    expect(screen.getByText('Új kategória')).toBeInTheDocument();
    const newCategoryBtn = screen.getByRole('button', { name: /Új kategória/i });
    expect(newCategoryBtn).toHaveTextContent('Új kategória');
    expect(newCategoryBtn.textContent?.trim()).toBe('Új kategória');
  });

  it('renders empty state when no categories exist', () => {
    render(
      <MemoryRouter>
        <CategoryBreakdown categories={[]} />
      </MemoryRouter>
    );

    expect(screen.getByText('Még nincsenek kategorizált számlák')).toBeInTheDocument();
  });
});

describe('QuickActions - Dashboard Bottom 3 Items', () => {
  it('renders Számlák áttekintése, Bizonylatfeltöltés, and Tranzakciók with navigation buttons', () => {
    render(
      <MemoryRouter>
        <QuickActions />
      </MemoryRouter>
    );

    expect(screen.getByText('Számlák áttekintése')).toBeInTheDocument();
    expect(screen.getByText('Bizonylatfeltöltés')).toBeInTheDocument();
    expect(screen.getByText('Tranzakciók')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Számlák megtekintése/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fájlok feltöltése/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tranzakciók megtekintése/i })).toBeInTheDocument();

    // Verify Projekt Kezelés is no longer present
    expect(screen.queryByText('Projekt Kezelés')).not.toBeInTheDocument();
  });
});

