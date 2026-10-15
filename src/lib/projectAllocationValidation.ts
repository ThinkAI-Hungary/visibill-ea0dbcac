import type { ItemProjectAllocation } from '@/types/invoices';

export interface ProjectAllocationValidationResult {
  isValid: boolean;
  sum: number;
  remaining: number;
  isUnassigned: boolean;
  error: string | null;
}

/**
 * Validates a list of project cost allocations for an invoice line item.
 * 
 * Rules:
 * 1. Empty or null/undefined allocations means unassigned (valid).
 * 2. If allocations exist:
 *    - Each allocation must have a non-empty `project_id`.
 *    - Each `project_id` must be unique (no duplicate projects).
 *    - Each percentage must be a positive number (> 0 and <= 100).
 *    - The sum of percentages must equal exactly 100.00% (tolerance < 0.01%).
 */
export function validateProjectAllocations(
  allocations: ItemProjectAllocation[] | null | undefined
): ProjectAllocationValidationResult {
  if (!allocations || allocations.length === 0) {
    return {
      isValid: true,
      sum: 0,
      remaining: 100,
      isUnassigned: true,
      error: null,
    };
  }

  const seenProjectIds = new Set<string>();
  let rawSum = 0;

  for (let i = 0; i < allocations.length; i++) {
    const item = allocations[i];
    const projId = (item.project_id || '').trim();

    if (!projId) {
      return {
        isValid: false,
        sum: Math.round(rawSum * 100) / 100,
        remaining: Math.round((100 - rawSum) * 100) / 100,
        isUnassigned: false,
        error: 'Minden sornál kötelező kiválasztani egy projektet.',
      };
    }

    if (seenProjectIds.has(projId)) {
      return {
        isValid: false,
        sum: Math.round(rawSum * 100) / 100,
        remaining: Math.round((100 - rawSum) * 100) / 100,
        isUnassigned: false,
        error: 'Ugyanaz a projekt nem szerepelhet többször az elosztásban.',
      };
    }
    seenProjectIds.add(projId);

    const pct = Number(item.percentage);
    if (isNaN(pct) || pct <= 0) {
      return {
        isValid: false,
        sum: Math.round(rawSum * 100) / 100,
        remaining: Math.round((100 - rawSum) * 100) / 100,
        isUnassigned: false,
        error: 'Minden megadott százaléknak 0-nál nagyobbnak kell lennie.',
      };
    }

    if (pct > 100) {
      return {
        isValid: false,
        sum: Math.round((rawSum + pct) * 100) / 100,
        remaining: Math.round((100 - (rawSum + pct)) * 100) / 100,
        isUnassigned: false,
        error: 'Egyetlen tétel sem haladhatja meg a 100%-ot.',
      };
    }

    rawSum += pct;
  }

  const sum = Math.round(rawSum * 100) / 100;
  const remaining = Math.round((100 - sum) * 100) / 100;
  const isExact100 = Math.abs(sum - 100) < 0.01;

  if (!isExact100) {
    if (sum < 100) {
      return {
        isValid: false,
        sum,
        remaining,
        isUnassigned: false,
        error: `A megosztás összege (${sum}%) nem éri el a 100%-ot. Hiányzik még: ${remaining}%.`,
      };
    } else {
      return {
        isValid: false,
        sum,
        remaining,
        isUnassigned: false,
        error: `A megosztás összege (${sum}%) meghaladja a 100%-ot. Túllépés: ${Math.abs(remaining)}%.`,
      };
    }
  }

  return {
    isValid: true,
    sum: 100,
    remaining: 0,
    isUnassigned: false,
    error: null,
  };
}

/**
 * Splits 100% equally among the provided project IDs.
 * The remainder (if 100 is not cleanly divisible) is added to the first item to guarantee sum = 100.00%.
 */
export function distributeEqually(projectIds: string[]): ItemProjectAllocation[] {
  const count = projectIds.length;
  if (count === 0) return [];

  const basePct = Math.floor((100 / count) * 100) / 100;
  const remainder = Math.round((100 - basePct * count) * 100) / 100;

  return projectIds.map((projectId, index) => ({
    project_id: projectId,
    percentage: index === 0 ? Math.round((basePct + remainder) * 100) / 100 : basePct,
  }));
}

/**
 * Fills the remaining percentage up to 100% on the targeted index (or the last item).
 */
export function fillRemainder(
  allocations: ItemProjectAllocation[],
  targetIndex?: number
): ItemProjectAllocation[] {
  if (allocations.length === 0) return [];

  const idx = targetIndex !== undefined && targetIndex >= 0 && targetIndex < allocations.length
    ? targetIndex
    : allocations.length - 1;

  const otherSum = allocations.reduce((acc, curr, i) => {
    if (i === idx) return acc;
    return acc + (Number(curr.percentage) || 0);
  }, 0);

  const needed = Math.max(0, Math.round((100 - otherSum) * 100) / 100);

  return allocations.map((item, i) => {
    if (i === idx) {
      return { ...item, percentage: needed };
    }
    return item;
  });
}
