import { ItemProjectAllocation } from '@/types/invoices';

export interface RawItemProjectData {
  id: string;
  nav_invoice_id?: string | null;
  invoice_id?: string | null;
  line_number?: number | null;
  line_description?: string | null;
  project_id?: string | null;
  project_allocations?: ItemProjectAllocation[] | null;
  net_amount?: number | null;
  gross_amount?: number | null;
}

export interface ProjectAllocationBreakdown {
  projectId: string;
  percentage?: number;
  amount?: number;
}

export interface InvoiceProjectSummary {
  invoiceId: string;
  projectIds: string[];
  singleProjectId: string | null;
  hasMultiProjects: boolean;
  totalProjectCount: number;
  allocations: ProjectAllocationBreakdown[];
}

/**
 * Aggregates line item project assignments and multi-project percentage splits
 * to determine the project distribution of an invoice.
 */
export function calculateInvoiceProjectSummary(
  invoiceId: string,
  items: RawItemProjectData[],
  invoiceGrossAmount?: number | null
): InvoiceProjectSummary {
  const projectMap = new Map<string, { amount: number; percentageSum: number; count: number }>();
  let totalCalculatedAmount = 0;

  for (const item of items) {
    const rawGross = Math.abs(Number(item.gross_amount ?? item.net_amount) || 0);

    if (item.project_allocations && Array.isArray(item.project_allocations) && item.project_allocations.length > 0) {
      for (const alloc of item.project_allocations) {
        if (!alloc.project_id) continue;
        const pct = Number(alloc.percentage) || 0;
        const allocAmount = (rawGross * pct) / 100;
        totalCalculatedAmount += allocAmount;

        const current = projectMap.get(alloc.project_id) || { amount: 0, percentageSum: 0, count: 0 };
        current.amount += allocAmount;
        current.percentageSum += pct;
        current.count += 1;
        projectMap.set(alloc.project_id, current);
      }
    } else if (item.project_id) {
      totalCalculatedAmount += rawGross;
      const current = projectMap.get(item.project_id) || { amount: 0, percentageSum: 0, count: 0 };
      current.amount += rawGross;
      current.percentageSum += 100;
      current.count += 1;
      projectMap.set(item.project_id, current);
    }
  }

  const projectIds = Array.from(projectMap.keys());
  const totalProjectCount = projectIds.length;
  const hasMultiProjects = totalProjectCount > 1;
  const singleProjectId = totalProjectCount === 1 ? projectIds[0] : null;

  const totalBase = Math.abs(Number(invoiceGrossAmount) || totalCalculatedAmount || 0);

  const allocations: ProjectAllocationBreakdown[] = projectIds.map((pid) => {
    const data = projectMap.get(pid)!;
    const computedPercentage = totalBase > 0
      ? (data.amount / totalBase) * 100
      : data.percentageSum / (data.count || 1);

    return {
      projectId: pid,
      amount: data.amount > 0 ? Math.round(data.amount) : undefined,
      percentage: Math.round(computedPercentage * 100) / 100,
    };
  });

  return {
    invoiceId,
    projectIds,
    singleProjectId,
    hasMultiProjects,
    totalProjectCount,
    allocations,
  };
}
