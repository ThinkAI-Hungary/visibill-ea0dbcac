import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { 
  InvoiceGlAccountSelector, 
  ALLOWED_CUSTOMER_GL_OPTIONS 
} from '@/components/invoices/InvoiceGlAccountSelector';
import { PettyCashRegisterSelect } from '@/components/petty-cash/PettyCashRegisterSelect';
import { PettyCashRuleQuickSaveDialog } from '@/components/invoices/PettyCashRuleQuickSaveDialog';
import { useQuery } from '@tanstack/react-query';

// Mock TanStack Query & Supabase
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn((opts) => ({
    mutate: vi.fn((args) => opts?.mutationFn?.(args)),
    isPending: false,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: mockInvalidateQueries,
  })),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: mockToast,
  })),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: vi.fn(() => ({
    selectedCompany: { id: 'comp-test-123', name: 'Test Kft' },
  })),
}));

const mockRpc = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'reg-1', name: 'Főpénztár', is_default: true, gl_account: '381', currencies: ['HUF'] },
                { id: 'reg-2', name: 'Bolti kassza', is_default: false, gl_account: '381', currencies: ['HUF'] },
              ],
              error: null,
            }),
          })),
        })),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

describe('Készpénzes számlák & Házipénztár integráció', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Kimenő készpénzes számlák 381-es kontírozása', () => {
    it('az ALLOWED_CUSTOMER_GL_OPTIONS tartalmazza a 381-es készpénz opciót', () => {
      const gl381 = ALLOWED_CUSTOMER_GL_OPTIONS.find(o => o.code === '381');
      expect(gl381).toBeDefined();
      expect(gl381?.label).toContain('381');
    });

    it('kimenő készpénzes számlánál (isCash=true) a partneri számla 381-re defaultol', () => {
      vi.mocked(useQuery).mockReturnValue({ data: null } as any);

      render(
        <InvoiceGlAccountSelector
          invoiceId="inv-out-cash-1"
          direction="OUTBOUND"
          currency="HUF"
          isCash={true}
        />
      );

      // A 381-es címkének kell megjelennie
      expect(screen.getByText(/381/)).toBeInTheDocument();
    });

    it('kimenő átutalásos számlánál (isCash=false) a vevői számla a megszokott 311-re defaultol', () => {
      vi.mocked(useQuery).mockReturnValue({ data: null } as any);

      render(
        <InvoiceGlAccountSelector
          invoiceId="inv-out-transfer-1"
          direction="OUTBOUND"
          currency="HUF"
          isCash={false}
        />
      );

      expect(screen.getByText(/311/)).toBeInTheDocument();
    });
  });

  describe('2. PettyCashRegisterSelect komponens', () => {
    it('rendereli a kiválasztott pénztár nevét vagy a fallback szöveget', () => {
      vi.mocked(useQuery).mockReturnValue({
        data: [
          { id: 'reg-1', name: 'Főpénztár', is_default: true, gl_account: '381', currencies: ['HUF'] },
          { id: 'reg-2', name: 'Bolti kassza', is_default: false, gl_account: '381', currencies: ['HUF'] },
        ],
        isLoading: false,
      } as any);

      const handleChange = vi.fn();
      const { rerender } = render(
        <PettyCashRegisterSelect
          companyId="comp-test-123"
          value="reg-1"
          onChange={handleChange}
        />
      );

      expect(screen.getByText(/Főpénztár/)).toBeInTheDocument();

      // Ha nincs érték rendelve
      rerender(
        <PettyCashRegisterSelect
          companyId="comp-test-123"
          value={null}
          onChange={handleChange}
        />
      );

      expect(screen.getByText(/Nincs pénztár rendelve/)).toBeInTheDocument();
    });
  });

  describe('3. PettyCashRuleQuickSaveDialog szabálymentés', () => {
    it('megjeleníti a partnert, célpénztárt és gombnyomásra meghívja a create_petty_cash_routing_rule RPC-t', async () => {
      const handleOpenChange = vi.fn();
      const handleRuleCreated = vi.fn();

      render(
        <PettyCashRuleQuickSaveDialog
          open={true}
          onOpenChange={handleOpenChange}
          companyId="comp-test-123"
          partnerName="Minta Partner Kft."
          targetRegisterId="reg-1"
          targetRegisterName="Főpénztár"
          direction="INBOUND"
          onRuleCreated={handleRuleCreated}
        />
      );

      expect(screen.getByText('Automatikus pénztár szabály mentése')).toBeInTheDocument();
      expect(screen.getByText('Főpénztár')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Minta Partner Kft.')).toBeInTheDocument();

      // Mentés gomb kattintás
      const saveBtn = screen.getByRole('button', { name: /Szabály mentése/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(mockRpc).toHaveBeenCalledWith('create_petty_cash_routing_rule', {
          p_company_id: 'comp-test-123',
          p_target_register_id: 'reg-1',
          p_partner_pattern: 'Minta Partner Kft.',
          p_source_type: 'invoice',
          p_priority: 10,
        });
      });

      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenCalledWith(false);
        expect(handleRuleCreated).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expect.stringContaining('Pénztár szabály létrehozva'),
          })
        );
      });
    });
  });
});
