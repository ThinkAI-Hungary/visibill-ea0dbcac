import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InvoiceRuleQuickSaveDialog } from '../InvoiceRuleQuickSaveDialog';

const mockToast = vi.fn();
const mockInvalidateQueries = vi.fn();
const mockInsert = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
    rpc: (...args: any[]) => mockRpc(...args),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'test-user-123' } } }),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'company-uuid-1', name: 'Test Kft.' },
  }),
  useOptionalCompany: () => ({
    selectedCompany: { id: 'company-uuid-1', name: 'Test Kft.' },
  }),
}));

vi.mock('@/hooks/useActivePreset', () => ({
  useActivePreset: () => ({ activePresetId: 'preset-uuid-1' }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

describe('InvoiceRuleQuickSaveDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    item: {
      id: 'item-1',
      line_description: '1 db Üzemanyag 95 Oktán',
      direction: 'INBOUND' as const,
      partner_tax_number: '12345678-2-42',
      partner_name: 'MOL Nyrt.',
      company_id: 'company-uuid-1',
    },
    glAccount: {
      id: 'gl-1',
      gl_number: '5120',
      short_name: 'Üzemanyagköltség',
    },
    vatCode: {
      id: 'vat-1',
      code: '27%',
    },
    onRuleCreated: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockInsert.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ data: { total_updated: 3 }, error: null });
  });

  it('renders cleaned pattern from line_description, removing noise like "1 db"', () => {
    render(<InvoiceRuleQuickSaveDialog {...defaultProps} />);

    expect(screen.getByText(/Szeretnél könyvelési szabályt létrehozni a jövőbeli tételekhez\?/i)).toBeInTheDocument();
    expect(screen.getAllByText('5120').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('27%')).toBeInTheDocument();

    const patternInput = screen.getByPlaceholderText(/pl. Üzemanyag, Könyvelési díj/i) as HTMLInputElement;
    expect(patternInput.value).toBe('Üzemanyag 95 Oktán');
  });

  it('toggles partner specific filter correctly', () => {
    render(<InvoiceRuleQuickSaveDialog {...defaultProps} />);

    const partnerCheckbox = screen.getByLabelText(/Csak ennél a partnernél érvényesüljön/i);
    expect(partnerCheckbox).not.toBeChecked();

    fireEvent.click(partnerCheckbox);
    expect(partnerCheckbox).toBeChecked();
  });

  it('saves rule and executes bulk apply RPC when "Szabály mentése" is clicked', async () => {
    render(<InvoiceRuleQuickSaveDialog {...defaultProps} />);

    const saveButton = screen.getByRole('button', { name: /Szabály mentése/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledTimes(1);
      const inserted = mockInsert.mock.calls[0][0][0];
      expect(inserted.description_pattern).toBe('Üzemanyag 95 Oktán');
      expect(inserted.target_gl_number).toBe('5120');
      expect(inserted.target_vat_code).toBe('27%');
      expect(inserted.scope).toBe('company');
      expect(inserted.company_id).toBe('company-uuid-1');

      // RPC call check
      expect(mockRpc).toHaveBeenCalledWith('apply_invoice_item_rules', {
        p_company_id: 'company-uuid-1',
        p_preset_id: 'preset-uuid-1',
        p_user_id: 'test-user-123',
        p_only_unclassified: true,
      });

      expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
      expect(defaultProps.onRuleCreated).toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Szabály elmentve és tétel besorolva',
      }));
    });
  });

  it('handles "Nem kérek szabályt (csak tétel mentése)" button and session suppression', async () => {
    render(<InvoiceRuleQuickSaveDialog {...defaultProps} />);

    // Check dontAskAgain checkbox
    const suppressCheckbox = screen.getByLabelText(/Ne kérdezzen rá automatikusan a szabálymentésre/i);
    fireEvent.click(suppressCheckbox);

    const dismissBtn = screen.getByRole('button', { name: /Nem kérek szabályt \(csak tétel mentése\)/i });
    fireEvent.click(dismissBtn);

    expect(sessionStorage.getItem('suppress_invoice_rule_prompt')).toBe('true');
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Tétel besorolása frissítve',
      description: expect.stringContaining('szabály létrehozása nélkül'),
    }));
  });
});
