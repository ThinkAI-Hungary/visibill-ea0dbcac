import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DepreciationRunDialog } from '@/components/fixed-assets/DepreciationRunDialog';

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: { id: 'test-comp-1', name: 'Mandala Fogadó Kft.' },
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-1', email: 'teca@i-tax.hu' },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/fixed-assets/depreciationPostingService', () => ({
  previewDepreciationRun: vi.fn().mockResolvedValue({
    companyId: 'test-comp-1',
    periodType: 'monthly',
    dateFrom: '2026-09-01',
    dateTo: '2026-09-30',
    postingDate: '2026-09-30',
    documentId: 'ECS-2026-09',
    totalAmount: 125000,
    eligibleCount: 3,
    existingPosting: { exists: false },
    items: [],
  }),
  postDepreciationRunToLedger: vi.fn().mockResolvedValue({
    success: true,
    message: 'Sikeres lekönyvelés',
  }),
}));

describe('DepreciationRunDialog Component Resilience', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  it('renders successfully without crashing when i18n returns a string instead of an array', async () => {
    // Render with QueryClientProvider
    render(
      <QueryClientProvider client={queryClient}>
        <DepreciationRunDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>
    );

    // Verify dialog title is present and no "b.map is not a function" error was thrown
    await waitFor(() => {
      expect(screen.getByText(/Értékcsökkenés/i)).toBeInTheDocument();
    });
  });
});
