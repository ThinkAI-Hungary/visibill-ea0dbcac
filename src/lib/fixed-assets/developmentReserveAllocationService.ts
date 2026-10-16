import type { DevelopmentReserve } from '@/types/fixed-assets';

export interface ProposedAllocation {
  reserveId: string;
  creationYear: number;
  availableAmount: number;
  allocatedAmount: number;
}

export interface FifoAllocationResult {
  allocations: ProposedAllocation[];
  totalAllocated: number;
  uncoveredAmount: number;
  isFullyCovered: boolean;
}

/**
 * Intelligens FIFO fejlesztési tartalék allokátor.
 * A legkorábban képzett (legkorábbi lejáratú) aktív keretekkel kezdi a merítést,
 * és ha egy keret kimerül, automatikusan a következő év keretét nyitja meg a kívánt összeg erejéig.
 */
export function calculateFifoReserveAllocation(
  reserves: DevelopmentReserve[],
  targetAmount: number
): FifoAllocationResult {
  if (!targetAmount || targetAmount <= 0 || !reserves || reserves.length === 0) {
    return {
      allocations: [],
      totalAllocated: 0,
      uncoveredAmount: Math.max(0, targetAmount || 0),
      isFullyCovered: false,
    };
  }

  // Csak az aktív (nem kimerült és nem lejárt) kereteket vesszük figyelembe
  const todayStr = new Date().toISOString().split('T')[0];
  const eligibleReserves = reserves
    .filter(r => (r.remaining_amount || 0) > 0 && r.expiration_date >= todayStr)
    // FIFO rendezés: legkorábbi képzési év elöl
    .sort((a, b) => {
      if (a.creation_year !== b.creation_year) {
        return a.creation_year - b.creation_year;
      }
      return a.expiration_date.localeCompare(b.expiration_date);
    });

  let remainingNeeded = targetAmount;
  const allocations: ProposedAllocation[] = [];

  for (const reserve of eligibleReserves) {
    if (remainingNeeded <= 0) break;

    const available = Number(reserve.remaining_amount) || 0;
    const take = Math.min(available, remainingNeeded);

    if (take > 0) {
      allocations.push({
        reserveId: reserve.id,
        creationYear: reserve.creation_year,
        availableAmount: available,
        allocatedAmount: Math.round(take),
      });
      remainingNeeded -= take;
    }
  }

  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);

  return {
    allocations,
    totalAllocated,
    uncoveredAmount: Math.max(0, Math.round(remainingNeeded)),
    isFullyCovered: remainingNeeded <= 0,
  };
}

/**
 * Fejlesztési tartalék levonások évenkénti formázott szövege (pl. "2023: 15M Ft, 2024: 10M Ft")
 */
export function formatReserveAllocationsSummary(
  allocations?: Array<{ creationYear?: number; allocated_amount?: number; amount?: number; reserve?: { creation_year: number } }>
): string {
  if (!allocations || allocations.length === 0) return '-';

  return allocations
    .map(a => {
      const year = a.creationYear ?? a.reserve?.creation_year;
      const amt = a.allocated_amount ?? a.amount ?? 0;
      return year ? `${year}: ${amt.toLocaleString('hu-HU')} Ft` : `${amt.toLocaleString('hu-HU')} Ft`;
    })
    .join('; ');
}
