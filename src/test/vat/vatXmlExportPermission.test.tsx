import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VatXmlExportModal } from '@/features/vat/components/VatXmlExportModal';

const caps = vi.hoisted(() => ({ canExportOfficialTaxReturn: false }));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;

vi.mock('@/hooks/useCompanyCapabilities', () => ({
  useCompanyCapabilities: () => ({ canExportOfficialTaxReturn: caps.canExportOfficialTaxReturn, isLoading: false }),
}));
vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({ refreshCompanies: vi.fn() }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'senior@example.com', user_metadata: {} } }),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('@/integrations/supabase/client', () => {
  const chain: any = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
      return () => chain;
    },
    apply: () => chain,
  });
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    supabase: { from: () => chain, rpc: () => chain, auth: { getSession: () => chain } },
  };
});

const company = { id: 'c1', name: 'Teszt Kft', tax_number: '12345678-1-42' };

function renderModal() {
  return render(
    <VatXmlExportModal
      open
      onOpenChange={() => {}}
      selectedCompany={company}
      year={2026}
      month={9}
      frequency="M"
    />,
  );
}

describe('VatXmlExportModal â€” D-4 official export guard (UI)', () => {
  beforeEach(() => {
    caps.canExportOfficialTaxReturn = false;
  });

  it('shows the permission warning for roles without export capability (kĂ¶nyvelĹ‘, asszisztens, ...)', () => {
    renderModal();
    expect(document.getElementById('vat-xml-export-permission-warning')).not.toBeNull();
  });

  it('hides the warning for roles with export capability (senior_kĂ¶nyvelĹ‘, iroda_admin, owner...)', () => {
    caps.canExportOfficialTaxReturn = true;
    renderModal();
    expect(document.getElementById('vat-xml-export-permission-warning')).toBeNull();
  });

  it('keeps the download button disabled without capability even if the form is filled', () => {
    renderModal();
    const buttons = screen.getAllByRole('button');
    const submit = buttons.find(b => /XML|Let\u00f6lt|Gener/i.test(b.textContent || '') && b.hasAttribute('disabled'));
    expect(submit).toBeDefined();
  });
});

describe('VatReturnViewTab - imperative export paths are capability-guarded (defense in depth)', () => {
  const src = readFileSync(
    resolve(process.cwd(), 'src/features/vat/components/VatReturnViewTab.tsx'),
    'utf8',
  );

  it.each(['executeXmlDownload', 'handleXmlDownloadClick'])('%s bails out without canExportOfficialTaxReturn', (fn) => {
    const m = new RegExp('const ' + fn + ' = \\(\\) => \\{\\r?\\n\\s*if \\(!canExportOfficialTaxReturn\\) return;').exec(src);
    expect(m).not.toBeNull();
  });
});
