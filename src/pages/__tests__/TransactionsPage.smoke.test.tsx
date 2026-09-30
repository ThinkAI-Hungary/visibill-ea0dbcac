import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TransactionsPage from '../TransactionsPage';

const mockCompany = {
  id: 'company-1',
  name: 'Test Kft.',
  tax_number: '12345678-2-41',
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

vi.mock('@/contexts/CompanyContext', () => ({
  useCompany: () => ({
    selectedCompany: mockCompany,
    companies: [mockCompany],
  }),
  useOptionalCompany: () => ({
    selectedCompany: mockCompany,
    companies: [mockCompany],
  }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn() }),
  ThemeProvider: ({ children }: any) => children,
}));

vi.mock('@/contexts/DateRangeContext', () => ({
  useDateRange: () => ({
    dateRange: { from: new Date('2026-01-01'), to: new Date('2026-12-31') },
    setDateRange: vi.fn(),
    dateFrom: new Date('2026-01-01'),
    dateTo: new Date('2026-12-31'),
    dateFromFormatted: '2026.01.01',
    dateToFormatted: '2026.12.31',
  }),
}));

vi.mock('@/hooks/useEaisybillPermissions', () => ({
  useEaisybillPermissions: () => ({
    canEdit: true,
    canDelete: true,
    canWrite: vi.fn().mockReturnValue(true),
    canRead: vi.fn().mockReturnValue(true),
    isSuperAdmin: true,
    role: 'owner',
  }),
}));

vi.mock('@/hooks/useExchangeRates', () => ({
  useExchangeRates: () => ({
    rates: { EUR: 400, USD: 360 },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useTransactionData', () => ({
  useTransactionData: () => ({
    selectedCompany: mockCompany,
    transactions: [],
    allTransactions: [],
    filteredTransactions: [],
    totalCount: 0,
    totalPages: 1,
    loading: false,
    filters: {
      currency: 'all',
      type: 'all',
      search: '',
      matchStatus: 'all',
    },
    setFilters: vi.fn(),
    clearFilters: vi.fn(),
    hasActiveFilters: false,
    uniqueCurrencies: ['HUF', 'EUR'],
    uniqueTypes: ['TRANSFER'],
    handleSort: vi.fn(),
    currentPage: 1,
    setCurrentPage: vi.fn(),
    pageSize: 50,
    handlePageSizeChange: vi.fn(),
    syncing: false,
    handleSync: vi.fn(),
    rematching: false,
    handleRematch: vi.fn(),
    handleExport: vi.fn(),
    handleCustomExport: vi.fn(),
    fetchAllFilteredTransactions: vi.fn().mockResolvedValue([]),
    handleBulkStatusChange: vi.fn(),
    handleBulkExport: vi.fn(),
    handleBulkDelete: vi.fn(),
    kpiData: {
      totalIncome: 1500000,
      totalExpense: 800000,
      netBalance: 700000,
      transactionCount: 25,
      matchedCount: 20,
    },
    filterOptions: {
      partners: [],
      bankAccounts: [],
      currencies: ['HUF', 'EUR'],
    },
    refetch: vi.fn(),
  }),
  fetchMatchedInvoiceNumbers: vi.fn().mockResolvedValue([]),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: any) => {
      if (typeof defaultValue === 'string') return defaultValue;
      return _key;
    },
    i18n: {
      language: 'hu',
    },
  }),
}));

vi.mock('@/components/transactions/TransactionTable', () => ({
  default: () => <div data-testid="transaction-table">Transaction Table Mock</div>,
}));

vi.mock('@/components/transactions/TransactionFilters', () => ({
  default: () => <div data-testid="transaction-filters">Transaction Filters Mock</div>,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  ReferenceArea: () => null,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('TransactionsPage Smoke Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders transactions page with filters, tabs, and tables', () => {
    render(<TransactionsPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('transaction-filters')).toBeInTheDocument();
    expect(screen.getByTestId('transaction-table')).toBeInTheDocument();
  });
});
