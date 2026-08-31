import { describe, it, expect } from 'vitest';
import { formatHungarianNumber } from '@/lib/documents/encoding/hungarianEncoding';
import {
  calculateFinancialMetrics,
  calculateSalaryMetrics,
  calculateAssetMovement,
  extractEquityRows,
  calculateTaxLossCarryforward,
  replaceTemplateVariables,
  isStepCompleted,
} from '../core/annualReportEngine';
import type { AnnualReport, ValidationResult } from '../types';

describe('AnnualReportEngine', () => {
  describe('calculateFinancialMetrics', () => {
    it('calculates metrics accurately from frozen balance sheet and P&L', () => {
      const bs = [
        { section: 'assets', type: 'total', current_balance: 10000000 },
        { section: 'liabilities', type: 'total', current_balance: 10000000 },
        { section: 'liabilities', row_code: 'D', current_balance: 6000000, prior_year_balance: 5000000 },
        { section: 'assets', row_code: 'B', current_balance: 4000000 },
        { section: 'liabilities', row_code: 'F', current_balance: 2000000 },
      ];
      const pnl = [
        { type: 'roman', balance: 1200000, multiplier: 1 },
      ];

      const metrics = calculateFinancialMetrics(bs, pnl);
      expect(metrics.totalAssets).toBe(10000000);
      expect(metrics.totalLiabilities).toBe(10000000);
      expect(metrics.equityTotal).toBe(6000000);
      expect(metrics.equityPrior).toBe(5000000);
      expect(metrics.equityChange).toBe('növekedett');
      expect(metrics.netIncome).toBe(1200000);
      expect(metrics.roe).toBe('20.0'); // 1.2M / 6M * 100
      expect(metrics.liquidity).toBe('2.00'); // 4M / 2M
      expect(metrics.liquidityEval).toBe('biztonsággal fedezik');
    });

    it('handles empty inputs gracefully with fallback net income', () => {
      const metrics = calculateFinancialMetrics(null, null, 500000);
      expect(metrics.totalAssets).toBe(0);
      expect(metrics.netIncome).toBe(500000);
      expect(metrics.liquidity).toBe('N/A');
    });
  });

  describe('calculateSalaryMetrics', () => {
    it('aggregates unique headcount, wages, and contributions', () => {
      const rows = [
        { munkavallalo_neve: 'Kovács János', tipus: 'bér', összeg: 500000 },
        { munkavallalo_neve: 'Kovács János', tipus: 'járulék', összeg: 65000 },
        { munkavallalo_neve: 'Nagy Éva', tipus: 'bér', összeg: 600000 },
        { munkavallalo_neve: 'Nagy Éva', tipus: 'járulék', összeg: 78000 },
      ];

      const result = calculateSalaryMetrics(rows);
      expect(result).not.toBeNull();
      expect(result?.headcount).toBe(2);
      expect(result?.totalWages).toBe(1100000);
      expect(result?.totalContrib).toBe(143000);
      expect(result?.total).toBe(1243000);
    });

    it('returns null for empty salary data', () => {
      expect(calculateSalaryMetrics([])).toBeNull();
      expect(calculateSalaryMetrics(null)).toBeNull();
    });
  });

  describe('calculateAssetMovement', () => {
    it('calculates active and disposed fixed asset movements', () => {
      const assets = [
        { status: 'active', acquisition_value: 1000000 },
        { status: 'active', acquisition_value: 500000 },
        { status: 'disposed', acquisition_value: 300000 },
      ];

      const result = calculateAssetMovement(assets);
      expect(result).not.toBeNull();
      expect(result?.total).toBe(3);
      expect(result?.active).toBe(2);
      expect(result?.disposed).toBe(1);
      expect(result?.totalAcquisition).toBe(1800000);
      expect(result?.activeAcquisition).toBe(1500000);
    });
  });

  describe('extractEquityRows', () => {
    it('extracts D rows from liabilities excluding total', () => {
      const bs = [
        { section: 'liabilities', row_code: 'D', type: 'total', name: 'Saját tőke összesen' },
        { section: 'liabilities', row_code: 'D.I', type: 'detail', name: 'Jegyzett tőke', current_balance: 3000000 },
        { section: 'liabilities', row_code: 'D.II', type: 'detail', name: 'Tőketartalék', current_balance: 1000000 },
        { section: 'assets', row_code: 'A.I', type: 'detail', name: 'Immateriális javak' },
      ];

      const rows = extractEquityRows(bs);
      expect(rows).toHaveLength(2);
      expect(rows[0].row_code).toBe('D.I');
      expect(rows[1].row_code).toBe('D.II');
    });
  });

  describe('calculateTaxLossCarryforward', () => {
    it('calculates 50% max allowable loss offset for positive income', () => {
      const allReports = [
        { id: '1', fiscal_year: 2024, net_income: -2000000 },
        { id: '2', fiscal_year: 2025, net_income: -1000000 },
        { id: '3', fiscal_year: 2026, net_income: 4000000 },
      ];

      const result = calculateTaxLossCarryforward(allReports, 2026, 4000000, [
        { section_key: 'tax_loss_applied', text: '1500000' },
      ]);

      expect(result.accumulatedPriorLosses).toBe(3000000);
      expect(result.maxLossOffset).toBe(2000000); // 50% of 4M
      expect(result.appliedLossOffset).toBe(1500000);
      expect(result.priorLossReports).toHaveLength(2);
    });
  });

  describe('replaceTemplateVariables', () => {
    it('substitutes company, year, and financial variables correctly', () => {
      const template = 'A [Cégnév] (adószám: [Adószám]) a [Tárgyév]. üzleti évben [Saját tőke] E Ft saját tőkével zárt.';
      const financialMetrics = calculateFinancialMetrics([], [], 1000000);
      financialMetrics.equityTotal = 8500000;

      const result = replaceTemplateVariables(template, {
        companyName: 'Teszt Kft.',
        companyTaxNumber: '12345678-2-41',
        fiscalYear: 2026,
        financialMetrics,
      });

      expect(result).toContain('Teszt Kft.');
      expect(result).toContain('12345678-2-41');
      expect(result).toContain('2026');
      expect(result).toContain(formatHungarianNumber(8500));
    });
  });

  describe('isStepCompleted', () => {
    const baseReport: AnnualReport = {
      id: 'rep-1',
      company_id: 'comp-1',
      preset_id: 'pre-1',
      fiscal_year: 2026,
      status: 'draft',
      representative_name: 'Teszt Elek',
      representative_role: 'ügyvezető',
      report_date: '2026-05-31',
      frozen_bs_data: [],
      frozen_pnl_data: [],
      frozen_at: '2026-05-31T12:00:00Z',
      validation_results: [],
      validated_at: '2026-05-31T12:05:00Z',
      notes_sections: [{ section_key: 'test', text: 'Tartalom' }],
      net_income: 1000000,
      dividend_amount: 500000,
      retained_earnings: 500000,
      dividend_resolution_date: '2026-05-31',
      dividend_resolution_number: '1/2026',
      created_at: '2026-05-31T10:00:00Z',
      updated_at: '2026-05-31T12:10:00Z',
    };

    const validations: ValidationResult[] = [
      { rule_id: 'V1', rule_name: 'Mérlegegyezőség', passed: true, severity: 'error', message: 'OK' },
    ];

    it('evaluates completion status for all 6 steps', () => {
      expect(isStepCompleted(1, baseReport, validations)).toBe(true);
      expect(isStepCompleted(2, baseReport, validations)).toBe(true);
      expect(isStepCompleted(3, baseReport, validations)).toBe(true);
      expect(isStepCompleted(4, baseReport, validations)).toBe(true);
      expect(isStepCompleted(5, baseReport, validations)).toBe(true);
      expect(isStepCompleted(6, baseReport, validations)).toBe(false);

      const finalizedReport = { ...baseReport, status: 'finalized' };
      expect(isStepCompleted(6, finalizedReport, validations)).toBe(true);
    });
  });
});
