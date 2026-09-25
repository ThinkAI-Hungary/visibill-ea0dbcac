import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { 
  InvoiceGlAccountSelector, 
  ALLOWED_CUSTOMER_GL_OPTIONS,
  ALLOWED_SUPPLIER_GL_OPTIONS 
} from '@/components/invoices/InvoiceGlAccountSelector';
import { TAccountLedger } from '@/components/accounty/invoices/TAccountLedger';
import { generateRLB60Content, generateNovitaxCsv, generateKulcsSoftXml } from '@/lib/bookkeepingExports';
import type { CompanyInvoice } from '@/hooks/accounty/useAccountyClients';

// Mock TanStack Query & Supabase
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: vi.fn(() => ({
    selectedCompany: { id: 'comp-123', name: 'Test Kft' },
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

describe('Brief Requirement: Customer Account Selection & Fixed VAT Account', () => {
  describe('ALLOWED_CUSTOMER_GL_OPTIONS', () => {
    it('contains strictly and only the 5 required customer accounts: 311, 312, 315, 316, 317', () => {
      const codes = ALLOWED_CUSTOMER_GL_OPTIONS.map(opt => opt.code);
      expect(codes).toHaveLength(5);
      expect(codes).toEqual(['311', '312', '315', '316', '317']);
    });
  });

  describe('ALLOWED_SUPPLIER_GL_OPTIONS & ALLOWED_INBOUND_VAT_GL_OPTIONS', () => {
    it('contains 4541, 4542, 4543 for supplier accounts', () => {
      const codes = ALLOWED_SUPPLIER_GL_OPTIONS.map(opt => opt.code);
      expect(codes).toContain('4541');
      expect(codes).toContain('4542');
      expect(codes).toContain('4543');
    });

    it('renders 4668 VAT option correctly when passed as currentVatGlNumber', () => {
      render(
        <InvoiceGlAccountSelector
          invoiceId="inv-vat-4668"
          direction="INBOUND"
          currency="HUF"
          currentPartnerGlNumber="4543"
          currentVatGlNumber="4668"
        />
      );

      expect(screen.getByText('Szállítói számla:')).toBeInTheDocument();
      expect(screen.getByText('4668 - Levonható ÁFA (4668)')).toBeInTheDocument();
      expect(screen.getByText('4543 - Belföldi szolgáltatók')).toBeInTheDocument();
    });
  });

  describe('InvoiceGlAccountSelector Component', () => {
    it('renders customer account selector and fixed 467 VAT badge for OUTBOUND invoice', () => {
      render(
        <InvoiceGlAccountSelector
          invoiceId="inv-1"
          direction="OUTBOUND"
          currency="HUF"
          currentPartnerGlNumber="311"
        />
      );

      // Verify label and fixed VAT account
      expect(screen.getByText('Vevői számla:')).toBeInTheDocument();
      expect(screen.getByText('467 - Fizetendő ÁFA')).toBeInTheDocument();
    });

    it('renders supplier account selector and fixed 466 VAT badge for INBOUND invoice', () => {
      render(
        <InvoiceGlAccountSelector
          invoiceId="inv-2"
          direction="INBOUND"
          currency="HUF"
          currentPartnerGlNumber="4541"
        />
      );

      expect(screen.getByText('Szállítói számla:')).toBeInTheDocument();
      expect(screen.getByText('466 - Levonható ÁFA')).toBeInTheDocument();
    });
  });

  describe('TAccountLedger Dynamic Account Display', () => {
    const baseInvoice: CompanyInvoice = {
      id: 'inv-out-1',
      invoiceNumber: 'SZ-2026/001',
      partnerName: 'Kapcsolt Partner Kft',
      date: '2026-03-15',
      rawDate: '2026-03-15',
      grossAmount: 127000,
      vatAmount: 27000,
      status: 'Új',
      type: 'kimeno',
      currency: 'HUF',
      isNav: false,
    };

    it('correctly displays customer account 315 for related companies', () => {
      const invoiceWith315: CompanyInvoice = {
        ...baseInvoice,
        partnerGlNumber: '315',
        vatGlNumber: '467',
      };

      const { getByText } = render(<TAccountLedger invoice={invoiceWith315} />);
      expect(getByText('315')).toBeInTheDocument();
      expect(getByText('Vevők (Kapcsolt vállalkozás)')).toBeInTheDocument();
      expect(getByText('467')).toBeInTheDocument();
      expect(getByText('Fizetendő ÁFA')).toBeInTheDocument();
    });

    it('correctly displays foreign customer account 312 for export invoices', () => {
      const invoiceWith312: CompanyInvoice = {
        ...baseInvoice,
        partnerGlNumber: '312',
        vatGlNumber: '467',
      };

      const { getByText } = render(<TAccountLedger invoice={invoiceWith312} />);
      expect(getByText('312')).toBeInTheDocument();
      expect(getByText('Külföldi vevők (Export)')).toBeInTheDocument();
    });
  });

  describe('Bookkeeping Exports (RLB60, Novitax, Kulcs-Soft)', () => {
    const testInvoices: CompanyInvoice[] = [
      {
        id: 'inv-exp-1',
        invoiceNumber: 'KIM-2026-001',
        partnerName: 'Anyavállalat Zrt',
        partnerTaxNumber: '11111111-2-41',
        date: '2026-03-01',
        rawDate: '2026-03-01',
        grossAmount: 127000,
        vatAmount: 27000,
        status: 'Kontírozott',
        type: 'kimeno',
        currency: 'HUF',
        isNav: false,
        partnerGlNumber: '315',
        vatGlNumber: '467',
        glNumber: '9111',
      },
    ];

    it('exports 315 in RLB60 CSV for related company sales', () => {
      const csv = generateRLB60Content(testInvoices);
      expect(csv).toContain('KIM-2026-001');
      // Line format: ... ; 315 ; 9111
      expect(csv).toContain(';315;9111');
    });

    it('exports 315 and 467 in Novitax CSV', () => {
      const csv = generateNovitaxCsv(testInvoices);
      expect(csv).toContain('KIM-2026-001');
      expect(csv).toContain(';315;9111;467');
    });

    it('exports 315 and 467 in Kulcs-Soft XML', () => {
      const xml = generateKulcsSoftXml(testInvoices);
      expect(xml).toContain('<Bizonylatszam>KIM-2026-001</Bizonylatszam>');
      expect(xml).toContain('<TartozikFokonyv>315</TartozikFokonyv>');
      expect(xml).toContain('<KovetelFokonyv>9111</KovetelFokonyv>');
      expect(xml).toContain('<AfaFokonyv>467</AfaFokonyv>');
    });
  });
});
