import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ErrorControlPanel } from '../components/errors/ErrorControlPanel';
import { fetchManagementData } from '../api/managementApi';

vi.mock('../api/managementApi', () => ({
  fetchManagementData: vi.fn(),
  postManagementData: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/errorReporter', () => ({
  reportError: vi.fn(),
}));

const mockDedupErrorsData = {
  totalErrors: 1,
  last24hErrors: 1,
  mostAffectedCompany: { id: 'comp-1', name: 'Victoria Music Kft.', errorCount: 1 },
  mostAffectedUser: { id: 'user-1', name: 'Mailgun', errorCount: 1 },
  topErrorCategory: { category: 'Worker', label: 'Worker', count: 1 },
  totalRows: 1,
  errors: [
    {
      id: 'err-final',
      created_at: new Date().toISOString(),
      error_timestamp: new Date().toISOString(),
      source: 'transaction_uploads',
      source_label: 'Feltöltés',
      error_category: 'Worker',
      error_category_label: 'Worker',
      error_message: 'Incorrect pipeline. Redirected From: Report To: Transaction. Job process failed: Unknown error',
      file_name: 'Auszahlung .pdf',
      file_url: 'https://example.com/Auszahlung.pdf',
      company_id: 'comp-1',
      company_name: 'Victoria Music Kft.',
      user_id: 'user-1',
      user_name: 'Mailgun',
      context: null,
      retry_count: 3,
      fallback_chain: ['invoice_uploads', 'report_uploads', 'transaction_uploads'],
      history: [
        {
          id: 'err-1',
          source: 'invoice_uploads',
          error_message: 'Nem található számla fejléce',
          timestamp: new Date(Date.now() - 30000).toISOString(),
        },
        {
          id: 'err-2',
          source: 'report_uploads',
          error_message: 'Nem található GLS/MPL jelentés sor',
          timestamp: new Date(Date.now() - 15000).toISOString(),
        },
        {
          id: 'err-final',
          source: 'transaction_uploads',
          error_message: 'Incorrect pipeline. Redirected From: Report To: Transaction. Job process failed: Unknown error',
          timestamp: new Date().toISOString(),
        },
      ],
    },
  ],
};

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('ErrorControlPanel Deduplication & Fallback Chain', () => {
  it('renders deduplicated error with retry badge and reveals fallback chain upon row expansion', async () => {
    vi.mocked(fetchManagementData).mockResolvedValue(mockDedupErrorsData);

    renderWithProviders(<ErrorControlPanel onOpenCompany={vi.fn()} allUsers={[]} />);

    // Check single authoritative file name rendered
    expect(await screen.findByText('Auszahlung .pdf')).toBeInTheDocument();

    // Check retry count badge (3x)
    expect(screen.getByText('3x')).toBeInTheDocument();

    // Click on row to expand details
    const fileRow = screen.getByText('Auszahlung .pdf').closest('tr');
    expect(fileRow).not.toBeNull();
    fireEvent.click(fileRow!);

    // Verify fallback chain is displayed
    expect(await screen.findByText(/Fallback lánc \(3 próbálkozás\)/)).toBeInTheDocument();
    expect(screen.getAllByText('transaction_uploads').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('invoice_uploads')).toBeInTheDocument();
    expect(screen.getByText('report_uploads')).toBeInTheDocument();
  });

  it('renders Edge Function and Auth source badges with pastel styles and nowrap', async () => {
    vi.mocked(fetchManagementData).mockResolvedValue({
      totalErrors: 2,
      last24hErrors: 2,
      mostAffectedCompany: null,
      mostAffectedUser: null,
      topErrorCategory: null,
      totalRows: 2,
      errors: [
        {
          id: 'ef-1',
          created_at: new Date().toISOString(),
          error_timestamp: new Date().toISOString(),
          source: 'app_error_logs:edge_function',
          source_label: 'Edge Function',
          error_category: 'Application',
          error_category_label: 'Application',
          error_message: 'Edge Function timed out',
          file_name: null,
          file_url: null,
          company_id: null,
          company_name: null,
          user_id: null,
          user_name: null,
          context: null,
        },
        {
          id: 'auth-1',
          created_at: new Date().toISOString(),
          error_timestamp: new Date().toISOString(),
          source: 'app_error_logs:auth',
          source_label: 'Auth',
          error_category: 'Application',
          error_category_label: 'Application',
          error_message: 'Auth token invalid',
          file_name: null,
          file_url: null,
          company_id: null,
          company_name: null,
          user_id: null,
          user_name: null,
          context: null,
        },
      ],
    });

    renderWithProviders(<ErrorControlPanel onOpenCompany={vi.fn()} allUsers={[]} />);

    const edgeFunctionBadge = await screen.findByText('Edge Function');
    expect(edgeFunctionBadge).toBeInTheDocument();
    expect(edgeFunctionBadge.className).toContain('whitespace-nowrap');
    expect(edgeFunctionBadge.className).toContain('bg-violet-500/15');
    expect(edgeFunctionBadge.className).toContain('text-violet-700');

    const authBadge = screen.getByText('Auth');
    expect(authBadge).toBeInTheDocument();
    expect(authBadge.className).toContain('whitespace-nowrap');
    expect(authBadge.className).toContain('bg-rose-500/15');
  });
});
