import { describe, it, expect } from 'vitest';
import { calculateInvoiceProjectSummary, RawItemProjectData } from '@/lib/invoiceProjectSummary';

describe('calculateInvoiceProjectSummary', () => {
  it('returns empty summary when invoice has no items with projects', () => {
    const items: RawItemProjectData[] = [
      { id: '1', line_number: 1, gross_amount: 10000 },
      { id: '2', line_number: 2, gross_amount: 20000 },
    ];
    const summary = calculateInvoiceProjectSummary('inv-1', items, 30000);

    expect(summary.totalProjectCount).toBe(0);
    expect(summary.hasMultiProjects).toBe(false);
    expect(summary.singleProjectId).toBeNull();
    expect(summary.allocations).toHaveLength(0);
  });

  it('detects a single project when all items belong to one project', () => {
    const items: RawItemProjectData[] = [
      { id: '1', line_number: 1, project_id: 'proj-A', gross_amount: 50000 },
      { id: '2', line_number: 2, project_id: 'proj-A', gross_amount: 50000 },
    ];
    const summary = calculateInvoiceProjectSummary('inv-1', items, 100000);

    expect(summary.totalProjectCount).toBe(1);
    expect(summary.hasMultiProjects).toBe(false);
    expect(summary.singleProjectId).toBe('proj-A');
    expect(summary.allocations).toHaveLength(1);
    expect(summary.allocations[0].percentage).toBe(100);
    expect(summary.allocations[0].amount).toBe(100000);
  });

  it('detects multi-projects when an item has percentage allocations', () => {
    // E-TXLG-2026-340 test scenario: 1 line item split across 3 projects (33.34%, 33.33%, 33.33%)
    const items: RawItemProjectData[] = [
      {
        id: '1',
        line_number: 1,
        gross_amount: 190500,
        project_allocations: [
          { project_id: 'proj-1', percentage: 33.34 },
          { project_id: 'proj-2', percentage: 33.33 },
          { project_id: 'proj-3', percentage: 33.33 },
        ],
      },
    ];
    const summary = calculateInvoiceProjectSummary('inv-1', items, 190500);

    expect(summary.totalProjectCount).toBe(3);
    expect(summary.hasMultiProjects).toBe(true);
    expect(summary.singleProjectId).toBeNull();
    expect(summary.allocations).toHaveLength(3);

    const p1 = summary.allocations.find((a) => a.projectId === 'proj-1');
    const p2 = summary.allocations.find((a) => a.projectId === 'proj-2');
    const p3 = summary.allocations.find((a) => a.projectId === 'proj-3');

    expect(p1?.percentage).toBe(33.34);
    expect(p1?.amount).toBe(63513);
    expect(p2?.percentage).toBe(33.33);
    expect(p2?.amount).toBe(63494);
    expect(p3?.percentage).toBe(33.33);
    expect(p3?.amount).toBe(63494);
  });

  it('detects multi-projects when different items have different single projects', () => {
    const items: RawItemProjectData[] = [
      { id: '1', line_number: 1, project_id: 'proj-A', gross_amount: 40000 },
      { id: '2', line_number: 2, project_id: 'proj-B', gross_amount: 60000 },
    ];
    const summary = calculateInvoiceProjectSummary('inv-1', items, 100000);

    expect(summary.totalProjectCount).toBe(2);
    expect(summary.hasMultiProjects).toBe(true);
    expect(summary.singleProjectId).toBeNull();
    expect(summary.allocations).toHaveLength(2);

    const pA = summary.allocations.find((a) => a.projectId === 'proj-A');
    const pB = summary.allocations.find((a) => a.projectId === 'proj-B');
    expect(pA?.percentage).toBe(40);
    expect(pA?.amount).toBe(40000);
    expect(pB?.percentage).toBe(60);
    expect(pB?.amount).toBe(60000);
  });

  it('treats 1 item with 100% single allocation as single project', () => {
    const items: RawItemProjectData[] = [
      {
        id: '1',
        line_number: 1,
        gross_amount: 50000,
        project_allocations: [{ project_id: 'proj-solo', percentage: 100 }],
      },
    ];
    const summary = calculateInvoiceProjectSummary('inv-1', items, 50000);

    expect(summary.totalProjectCount).toBe(1);
    expect(summary.hasMultiProjects).toBe(false);
    expect(summary.singleProjectId).toBe('proj-solo');
    expect(summary.allocations[0].percentage).toBe(100);
  });
});
