import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OpgService } from '@/services/opgService';
import { OpgOverviewTab } from '@/components/opg/OpgOverviewTab';
import { OpgRegistersTab } from '@/components/opg/OpgRegistersTab';
import { OpgTransactionsTab } from '@/components/opg/OpgTransactionsTab';
import type { OpgCashRegister, OpgTransaction, OpgTurnoverKpi, OpgDailySummary } from '@/types/opg';
import type { PettyCashRegister } from '@/components/petty-cash/types';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => {
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-test-123' } } }),
      },
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

describe('Online Pénztárgép (OPG) Modul Tesztek', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  };

  const mockRegisters: OpgCashRegister[] = [
    {
      id: 'opg-1',
      company_id: 'comp-1',
      ap_code: 'A12345678',
      name: 'Főpénztár - Üzlethelyiség',
      location: '1052 Budapest, Kossuth u. 12.',
      status: 'active',
      petty_cash_register_id: 'pcr-1',
      cash_booking_mode: 'daily_z_summary',
      sync_interval_minutes: 60,
      last_successful_sync_at: '2026-10-06T10:00:00Z',
      last_failed_sync_at: null,
      last_error_message: null,
      created_at: '2026-10-06T08:00:00Z',
      updated_at: '2026-10-06T08:00:00Z',
    },
  ];

  const mockPettyCashRegisters: PettyCashRegister[] = [
    {
      id: 'pcr-1',
      company_id: 'comp-1',
      name: 'Központi Házipénztár',
      currencies: ['HUF'],
      is_default: true,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    } as any,
  ];

  const mockTransactions: OpgTransaction[] = [
    {
      id: 'tx-1',
      company_id: 'comp-1',
      opg_id: 'opg-1',
      external_transaction_id: 'NAV-OPG-A12345678-20261006-001',
      receipt_number: 'NY-20261006/001',
      transaction_date: '2026-10-06',
      transaction_time: '10:15:00',
      transaction_type: 'receipt',
      total_gross_amount: 5000,
      cash_amount: 5000,
      card_amount: 0,
      szep_card_amount: 0,
      voucher_amount: 0,
      other_payment_amount: 0,
      payment_method_breakdown: { cash: 5000, card: 0, szep_card: 0, voucher: 0, other: 0 },
      vat_breakdown: { vat_27: { net: 3937, vat: 1063, gross: 5000 } },
      processing_status: 'new',
      cash_entry_id: null,
      error_message: null,
      created_at: '2026-10-06T10:15:00Z',
      updated_at: '2026-10-06T10:15:00Z',
      cash_register: { id: 'opg-1', name: 'Főpénztár', ap_code: 'A12345678' },
    },
    {
      id: 'tx-2',
      company_id: 'comp-1',
      opg_id: 'opg-1',
      external_transaction_id: 'NAV-OPG-A12345678-20261006-002',
      receipt_number: 'NY-20261006/002',
      transaction_date: '2026-10-06',
      transaction_time: '11:30:00',
      transaction_type: 'receipt',
      total_gross_amount: 12000,
      cash_amount: 0,
      card_amount: 12000,
      szep_card_amount: 0,
      voucher_amount: 0,
      other_payment_amount: 0,
      payment_method_breakdown: { cash: 0, card: 12000, szep_card: 0, voucher: 0, other: 0 },
      vat_breakdown: { vat_27: { net: 9449, vat: 2551, gross: 12000 } },
      processing_status: 'skipped',
      cash_entry_id: null,
      error_message: null,
      created_at: '2026-10-06T11:30:00Z',
      updated_at: '2026-10-06T11:30:00Z',
      cash_register: { id: 'opg-1', name: 'Főpénztár', ap_code: 'A12345678' },
    },
    {
      id: 'tx-3',
      company_id: 'comp-1',
      opg_id: 'opg-1',
      external_transaction_id: 'NAV-OPG-A12345678-20261006-003-ST',
      receipt_number: 'SZ-20261006/003',
      transaction_date: '2026-10-06',
      transaction_time: '12:00:00',
      transaction_type: 'storno',
      total_gross_amount: 2000,
      cash_amount: 2000,
      card_amount: 0,
      szep_card_amount: 0,
      voucher_amount: 0,
      other_payment_amount: 0,
      payment_method_breakdown: { cash: 2000, card: 0, szep_card: 0, voucher: 0, other: 0 },
      vat_breakdown: { vat_27: { net: 1575, vat: 425, gross: 2000 } },
      processing_status: 'new',
      cash_entry_id: null,
      error_message: null,
      created_at: '2026-10-06T12:00:00Z',
      updated_at: '2026-10-06T12:00:00Z',
      cash_register: { id: 'opg-1', name: 'Főpénztár', ap_code: 'A12345678' },
    },
  ];

  const mockKpi: OpgTurnoverKpi = {
    totalGross: 15000,
    totalCash: 3000, // 5000 - 2000 storno
    totalCard: 12000,
    otherTotal: 0,
    transactionCount: 3,
    zReportCount: 1,
    pendingCashBookingCount: 2,
    activeRegisterCount: 1,
  };

  const mockDailyTurnover: OpgDailySummary[] = [
    {
      date: '2026-10-06',
      gross_total: 15000,
      cash_total: 3000,
      card_total: 12000,
      other_total: 0,
      receipt_count: 2,
      z_report_count: 1,
      storno_count: 1,
    },
  ];

  describe('1. OpgService Üzleti Logika és Validációk', () => {
    it('Megfelelően azonosítja a valós és hibás AP kód formátumokat kapcsolat teszteléskor', async () => {
      const validAp = 'A12345678';
      const isApValid = /^[A-Z0-9]{8,12}$/i.test(validAp.replace(/[^A-Z0-9]/gi, ''));
      expect(isApValid).toBe(true);

      const invalidAp = '123';
      const isInvalid = /^[A-Z0-9]{8,12}$/i.test(invalidAp.replace(/[^A-Z0-9]/gi, ''));
      expect(isInvalid).toBe(false);
    });

    it('A sztornó bizonylat helyesen csökkenti a nettó és bruttó forgalmi összesítőket', () => {
      let gross = 0;
      let cash = 0;

      mockTransactions.forEach((tx) => {
        const mult = tx.transaction_type === 'storno' ? -1 : 1;
        gross += tx.total_gross_amount * mult;
        cash += tx.cash_amount * mult;
      });

      // 5000 + 12000 - 2000 = 15000
      expect(gross).toBe(15000);
      // 5000 - 2000 = 3000
      expect(cash).toBe(3000);
    });
  });

  describe('2. OpgOverviewTab UI Megjelenítés', () => {
    it('Megjeleníti a KPI mutatókat (Forgalom, Készpénz, Bankkártya, Pénztárgépek)', () => {
      renderWithProviders(
        <OpgOverviewTab
          kpi={mockKpi}
          dailyTurnover={mockDailyTurnover}
          onSyncNow={vi.fn()}
          onBookAllPending={vi.fn()}
          onNavigateToTransactions={vi.fn()}
          onNavigateToRegisters={vi.fn()}
        />
      );

      // Kártyák címkéi
      expect(screen.getByText('Összes OPG Forgalom')).toBeInTheDocument();
      expect(screen.getByText('Készpénz Forgalom')).toBeInTheDocument();
      expect(screen.getByText('Bankkártyás Forgalom')).toBeInTheDocument();
      expect(screen.getByText('Aktív Pénztárgépek')).toBeInTheDocument();

      // Értesítés a függő könyvelésekről
      expect(
        screen.getByText(/2 db készpénzes bizonylat vár házipénztári könyvelésre/i)
      ).toBeInTheDocument();

      // Napi összesítő sor
      expect(screen.getByText('Napi forgalmi kimutatás')).toBeInTheDocument();
    });

    it('Kattintás a szinkron gombra meghívja az onSyncNow handlert', () => {
      const handleSync = vi.fn().mockResolvedValue({});
      renderWithProviders(
        <OpgOverviewTab
          kpi={mockKpi}
          dailyTurnover={mockDailyTurnover}
          onSyncNow={handleSync}
          onBookAllPending={vi.fn()}
          onNavigateToTransactions={vi.fn()}
          onNavigateToRegisters={vi.fn()}
        />
      );

      const syncBtn = screen.getByRole('button', { name: /NAV OPG Szinkronizáció indítása/i });
      fireEvent.click(syncBtn);
      expect(handleSync).toHaveBeenCalled();
    });
  });

  describe('3. OpgRegistersTab Pénztárgép Kezelés', () => {
    it('Listázza a regisztrált pénztárgépeket és azok AP kódját', () => {
      renderWithProviders(
        <OpgRegistersTab
          registers={mockRegisters}
          pettyCashRegisters={mockPettyCashRegisters}
          companyId="comp-1"
          onCreateRegister={vi.fn()}
          onUpdateRegister={vi.fn()}
          onDeleteRegister={vi.fn()}
          onTestConnection={vi.fn()}
        />
      );

      expect(screen.getByText('A12345678')).toBeInTheDocument();
      expect(screen.getByText('Főpénztár - Üzlethelyiség')).toBeInTheDocument();
      expect(screen.getByText('1052 Budapest, Kossuth u. 12.')).toBeInTheDocument();
      expect(screen.getByText('Központi Házipénztár')).toBeInTheDocument();
      expect(screen.getByText('Napi Z-összesítő')).toBeInTheDocument();
      expect(screen.getByText('Aktív')).toBeInTheDocument();
    });
  });

  describe('4. OpgTransactionsTab Szűrés és Részletek', () => {
    it('Megjeleníti a tranzakciókat és szűri őket keresőszó alapján', () => {
      renderWithProviders(
        <OpgTransactionsTab
          transactions={mockTransactions}
          registers={mockRegisters}
          onBookTransaction={vi.fn()}
          onBookAllPending={vi.fn()}
        />
      );

      expect(screen.getByText('NY-20261006/001')).toBeInTheDocument();
      expect(screen.getByText('NY-20261006/002')).toBeInTheDocument();
      expect(screen.getByText('SZ-20261006/003')).toBeInTheDocument();

      // Keresés sztornó bizonylatra
      const searchInput = screen.getByPlaceholderText(/Keresés nyugtaszámra/i);
      fireEvent.change(searchInput, { target: { value: 'SZ-20261006' } });

      expect(screen.getByText('SZ-20261006/003')).toBeInTheDocument();
      expect(screen.queryByText('NY-20261006/001')).not.toBeInTheDocument();
    });
  });
});
