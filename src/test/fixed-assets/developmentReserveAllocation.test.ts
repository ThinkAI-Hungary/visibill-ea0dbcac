import { describe, it, expect } from 'vitest';
import { calculateFifoReserveAllocation, formatReserveAllocationsSummary } from '@/lib/fixed-assets/developmentReserveAllocationService';
import type { DevelopmentReserve } from '@/types/fixed-assets';

describe('developmentReserveAllocationService (FIFO motor)', () => {
  const mockReserves: DevelopmentReserve[] = [
    {
      id: 'res-2024',
      company_id: 'c1',
      creation_year: 2024,
      reserve_amount: 15000000,
      utilized_amount: 0,
      remaining_amount: 15000000,
      expiration_date: '2028-12-31',
      created_at: '2024-01-01',
      updated_at: '2024-01-01',
      status: 'active',
    },
    {
      id: 'res-2022',
      company_id: 'c1',
      creation_year: 2022,
      reserve_amount: 10000000,
      utilized_amount: 5000000,
      remaining_amount: 5000000, // 5M Ft maradt
      expiration_date: '2026-12-31',
      created_at: '2022-01-01',
      updated_at: '2022-01-01',
      status: 'active',
    },
    {
      id: 'res-2023',
      company_id: 'c1',
      creation_year: 2023,
      reserve_amount: 12000000,
      utilized_amount: 2000000,
      remaining_amount: 10000000, // 10M Ft maradt
      expiration_date: '2027-12-31',
      created_at: '2023-01-01',
      updated_at: '2023-01-01',
      status: 'active',
    },
  ];

  it('automatikusan a legkorábbi (2022) évvel kezdi az allokációt', () => {
    // 3M Ft-ot kérünk: elegendő a 2022-es (amiből 5M szabad)
    const result = calculateFifoReserveAllocation(mockReserves, 3000000);

    expect(result.isFullyCovered).toBe(true);
    expect(result.totalAllocated).toBe(3000000);
    expect(result.uncoveredAmount).toBe(0);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].creationYear).toBe(2022);
    expect(result.allocations[0].allocatedAmount).toBe(3000000);
  });

  it('több évet érintő összegnél sorban kimeríti a legkorábbiakat és átlép a következő évre (2022 -> 2023 -> 2024)', () => {
    // 18M Ft-ot kérünk:
    // 2022-ből: 5M Ft (teljes kimerítés)
    // 2023-ból: 10M Ft (teljes kimerítés)
    // 2024-ből: 3M Ft (maradék)
    const result = calculateFifoReserveAllocation(mockReserves, 18000000);

    expect(result.isFullyCovered).toBe(true);
    expect(result.totalAllocated).toBe(18000000);
    expect(result.uncoveredAmount).toBe(0);
    expect(result.allocations).toHaveLength(3);

    expect(result.allocations[0]).toEqual({
      reserveId: 'res-2022',
      creationYear: 2022,
      availableAmount: 5000000,
      allocatedAmount: 5000000,
    });

    expect(result.allocations[1]).toEqual({
      reserveId: 'res-2023',
      creationYear: 2023,
      availableAmount: 10000000,
      allocatedAmount: 10000000,
    });

    expect(result.allocations[2]).toEqual({
      reserveId: 'res-2024',
      creationYear: 2024,
      availableAmount: 15000000,
      allocatedAmount: 3000000,
    });
  });

  it('ha az összes keret kevesebb mint a kért összeg, a maximumot allokálja és jelzi a hiányt', () => {
    // Összes szabad keret: 5M + 10M + 15M = 30M Ft
    // 35M Ft-ot kérünk
    const result = calculateFifoReserveAllocation(mockReserves, 35000000);

    expect(result.isFullyCovered).toBe(false);
    expect(result.totalAllocated).toBe(30000000);
    expect(result.uncoveredAmount).toBe(5000000);
    expect(result.allocations).toHaveLength(3);
  });

  it('formatReserveAllocationsSummary helyesen formázza az évenkénti bontást', () => {
    const allocations = [
      { creationYear: 2022, amount: 5000000 },
      { creationYear: 2023, amount: 10000000 },
    ];
    const text = formatReserveAllocationsSummary(allocations);
    expect(text).toBe('2022: 5\u00a0000\u00a0000 Ft; 2023: 10\u00a0000\u00a0000 Ft');
  });
});
