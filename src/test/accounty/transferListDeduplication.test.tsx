import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import TransferListPage from '@/pages/Accounty/documents/TransferListPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock dependencies
const mockCompanyId = 'comp-123';
const mockTransfers = [
  {
    id: 't-1',
    companyId: mockCompanyId,
    employeeId: 'emp-kilner',
    employeeName: 'Kilner Gábor',
    bankAccount: '11773344-00000000',
    netSalary: 248178,
    period: '2026-09',
    status: 'approved',
  },
  {
    id: 't-2',
    companyId: mockCompanyId,
    employeeId: 'emp-kilner',
    employeeName: 'Kilner Gábor',
    bankAccount: '11773344-00000000',
    netSalary: 248178,
    period: '2026-09',
    status: 'approved',
  },
  {
    id: 't-3',
    companyId: mockCompanyId,
    employeeId: 'emp-kilner',
    employeeName: 'Kilner Gábor',
    bankAccount: '11773344-00000000',
    netSalary: 248178,
    period: '2026-09',
    status: 'approved',
  },
];

vi.mock('@/hooks/accounty', () => ({
  useTransfers: () => ({
    data: mockTransfers,
    isLoading: false,
  }),
  useGenerateDocuments: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useAccountyClients: () => ({
    data: [{ id: mockCompanyId, name: 'Kilner Gábor Ev.' }],
  }),
}));

vi.mock('@/hooks/usePayrollData', () => ({
  usePayrollCycles: () => ({
    data: [{ id: 'cycle-sep', year: 2026, month: 9, status: 'completed' }],
  }),
  usePayrollCalculations: () => ({
    data: [{ id: 'calc-1', net_salary: 248178 }],
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('TransferListPage Deduplication Guard', () => {
  it('deduplicates duplicate transfers so each employee appears exactly once with correct total', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/eaisybooks/${mockCompanyId}/2026-09-01_2026-09-30/payroll/documents/transfer`]}>
          <Routes>
            <Route
              path="/eaisybooks/:companyId/:dateRange/payroll/documents/transfer"
              element={<TransferListPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verify "Összes tétel" is 1 (not 3)
    const summaryCard1 = screen.getByText('Összes tétel').previousElementSibling;
    expect(summaryCard1?.textContent).toBe('1');

    // Verify "Utalásra kész" is 1 (not 3)
    const summaryCard2 = screen.getByText('Utalásra kész').previousElementSibling;
    expect(summaryCard2?.textContent).toBe('1');

    // Verify "Összes nettó" is 248 178 Ft (not 744 534 Ft)
    const summaryCard3 = screen.getByText('Összes nettó').previousElementSibling;
    expect(summaryCard3?.textContent).toContain('248\u00A0178');

    // Verify Kilner Gábor appears exactly once in the table
    const rows = screen.getAllByText('Kilner Gábor');
    expect(rows.length).toBe(1);
  });
});
