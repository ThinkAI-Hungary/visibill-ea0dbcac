import { describe, it, expect } from 'vitest';
import {
  calculateSelfRevisionPenalty,
  getVatStatutoryDueDate,
} from '@/features/vat/utils/penaltyCalculator';
import {
  compareCurrentInvoicesWithSnapshot,
  computeVatSnapshotSha256,
} from '@/features/vat/services/vatSnapshotService';

describe('Hungarian VAT Self-Revision Penalty Calculator (Art. 211. §)', () => {
  it('calculates statutory due date correctly for monthly VAT', () => {
    // 2026 január havi bevallás határideje: 2026. február 20. (péntek)
    const dueDate = getVatStatutoryDueDate(2026, 1, 'H');
    expect(dueDate.toISOString().slice(0, 10)).toBe('2026-02-20');
  });

  it('calculates statutory due date shifting to next workday for weekends', () => {
    // 2026 június havi bevallás határideje: 2026. július 20. (hétfő)
    const dueDate = getVatStatutoryDueDate(2026, 6, 'H');
    expect(dueDate.toISOString().slice(0, 10)).toBe('2026-07-20');
  });

  it('calculates statutory due date correctly for quarterly VAT', () => {
    // 2026 Q1 -> április 20.
    const dueDateQ1 = getVatStatutoryDueDate(2026, 1, 'N');
    expect(dueDateQ1.toISOString().slice(0, 10)).toBe('2026-04-20');

    // 2026 Q4 -> 2027 január 20.
    const dueDateQ4 = getVatStatutoryDueDate(2026, 4, 'N');
    expect(dueDateQ4.toISOString().slice(0, 10)).toBe('2027-01-20');
  });

  it('returns 0 Ft penalty if tax difference is negative (taxpayer advantage)', () => {
    const res = calculateSelfRevisionPenalty({
      taxDifferenceHuf: -150000,
      year: 2026,
      periodMonth: 1,
      frequency: 'H',
      filingDate: new Date('2026-04-15'),
    });

    expect(res.penaltyAmountHuf).toBe(0);
    expect(res.taxDifferenceHuf).toBe(-150000);
    expect(res.explanation).toContain('adózó javára');
  });

  it('returns 0 Ft penalty if filed on or before statutory due date', () => {
    const res = calculateSelfRevisionPenalty({
      taxDifferenceHuf: 200000,
      year: 2026,
      periodMonth: 1,
      frequency: 'H',
      filingDate: new Date('2026-02-15'),
    });

    expect(res.penaltyAmountHuf).toBe(0);
    expect(res.delayDays).toBe(0);
  });

  it('calculates exact interest with 50% rate multiplier for first self-revision', () => {
    // 100 nap késedelem, 1 000 000 Ft adókülönbözet, 6.50% alapkamat 50%-a (3.25%)
    // Számítás: 1000000 * (100 / 365) * 0.0325 = 8904 Ft
    const dueDate = new Date('2026-02-20');
    const filingDate = new Date(dueDate.getTime() + 100 * 24 * 60 * 60 * 1000);

    const res = calculateSelfRevisionPenalty({
      taxDifferenceHuf: 1000000,
      year: 2026,
      periodMonth: 1,
      frequency: 'H',
      filingDate,
      baseInterestRate: 0.065,
      revisionOrder: 1,
    });

    expect(res.delayDays).toBe(100);
    expect(res.multiplier).toBe(0.5);
    expect(res.penaltyAmountHuf).toBe(8904);
  });

  it('calculates exact interest with 100% rate multiplier for repeated self-revision (revisionOrder >= 2)', () => {
    const dueDate = new Date('2026-02-20');
    const filingDate = new Date(dueDate.getTime() + 100 * 24 * 60 * 60 * 1000);

    const res = calculateSelfRevisionPenalty({
      taxDifferenceHuf: 1000000,
      year: 2026,
      periodMonth: 1,
      frequency: 'H',
      filingDate,
      baseInterestRate: 0.065,
      revisionOrder: 2,
    });

    expect(res.multiplier).toBe(1.0);
    expect(res.penaltyAmountHuf).toBe(17808); // 8904 * 2
  });
});

describe('VAT Snapshot & Revision Pool diff calculation', () => {
  it('computes stable SHA-256 hash', async () => {
    const hash1 = await computeVatSnapshotSha256('test-vat-payload');
    const hash2 = await computeVatSnapshotSha256('test-vat-payload');
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it('identifies late entry and modified invoices in revision pool', () => {
    const snapshot = {
      id: 'snap-1',
      company_id: 'comp-1',
      period_year: 2026,
      period_month: 1,
      frequency: 'H' as const,
      version_number: 1,
      version_type: 'ORIGINAL' as const,
      version_label: 'v1.0 (Eredeti)',
      status: 'SUBMITTED' as const,
      tax_base_payable: 1000000,
      tax_payable: 270000,
      tax_base_deductible: 500000,
      tax_deductible: 135000,
      net_vat_position: 135000,
      snapshot_hash_sha256: 'abc...',
      snapshot_data: {
        invoicesMap: {
          'sz-001': {
            invoice_number: 'SZ-001',
            partner_name: 'Beszállító Kft',
            net_amount: 500000,
            vat_amount: 135000,
          },
        },
      },
      submitted_at: '2026-02-18T10:00:00Z',
      submitted_by: 'user-1',
      created_at: '2026-02-18T10:00:00Z',
      updated_at: '2026-02-18T10:00:00Z',
    };

    const currentInvoices = [
      // Módosult számla: nettó 500k -> 600k (+27k ÁFA)
      {
        id: 'inv-1',
        invoice_number: 'SZ-001',
        partner_name: 'Beszállító Kft',
        net_amount: 600000,
        vat_amount: 162000,
      },
      // Új késedelmes számla: nettó 200k (+54k ÁFA)
      {
        id: 'inv-2',
        invoice_number: 'SZ-002',
        partner_name: 'Új Partner Zrt',
        net_amount: 200000,
        vat_amount: 54000,
      },
    ];

    const diff = compareCurrentInvoicesWithSnapshot({
      currentInvoices,
      latestSnapshot: snapshot,
      year: 2026,
      month: 1,
      frequency: 'H',
    });

    expect(diff.hasRevisions).toBe(true);
    expect(diff.totalItemsCount).toBe(2);
    expect(diff.totalTaxBaseDiff).toBe(300000); // 100k + 200k
    expect(diff.totalTaxAmountDiff).toBe(81000); // 27k + 54k
  });
});
