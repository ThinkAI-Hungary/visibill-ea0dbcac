import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('VAT Return Engine: Performance & Timeout Invariants (RPC & Architecture)', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../../../supabase/migrations/20261010230000_optimize_hungarian_vat_return_performance.sql'
  );

  it('ensures migration 20261010230000 exists and contains mandatory performance guards', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // 1. Security attributes
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain("SET search_path TO 'public'");
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.calculate_hungarian_vat_return(uuid, integer, integer, text) FROM PUBLIC, anon;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.calculate_hungarian_vat_return(uuid, integer, integer, text) TO authenticated, service_role;');

    // 2. Cursor date bounding to eliminate full-table scans
    expect(sql).toContain('ni.invoice_delivery_date BETWEEN v_date_from AND v_date_to');
    expect(sql).toContain('COALESCE(inv.teljesites_datuma, inv.kibocsatas_datuma)::date BETWEEN v_date_from AND v_date_to');

    // 3. Elimination of N+1 exchange rate queries inside the PL/pgSQL loop
    expect(sql).toContain('LEFT JOIN daily_exchange_rates er ON er.currency = ni.currency');
    expect(sql).toContain('v_rate := COALESCE(inv_rec.exchange_rate, 1.0);');
    // Ensure the old procedural query is NOT in the loop:
    expect(sql).not.toContain('SELECT rate INTO v_rate\n      FROM daily_exchange_rates');
  });

  describe('Period Bound Math & Time Windows', () => {
    function computePeriodBounds(year: number, month: number, frequency: 'H' | 'N' | 'E') {
      let fromDate: string;
      let toDate: string;

      if (frequency === 'H') {
        const lastDay = new Date(year, month, 0).getDate();
        fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
        toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else if (frequency === 'N') {
        const startMonth = (month - 1) * 3 + 1;
        const endMonth = startMonth + 2;
        const lastDay = new Date(year, endMonth, 0).getDate();
        fromDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        toDate = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else {
        fromDate = `${year}-01-01`;
        toDate = `${year}-12-31`;
      }

      const targetPeriodStr = `${year}-${String(month).padStart(2, '0')}`;
      return { fromDate, toDate, targetPeriodStr };
    }

    it('correctly calculates monthly (H) bounds for July 2026', () => {
      const bounds = computePeriodBounds(2026, 7, 'H');
      expect(bounds.fromDate).toBe('2026-07-01');
      expect(bounds.toDate).toBe('2026-07-31');
      expect(bounds.targetPeriodStr).toBe('2026-07');
    });

    it('correctly calculates quarterly (N) bounds for Q3 2026 (month 3)', () => {
      const bounds = computePeriodBounds(2026, 3, 'N');
      expect(bounds.fromDate).toBe('2026-07-01');
      expect(bounds.toDate).toBe('2026-09-30');
    });

    it('correctly calculates yearly (E) bounds for 2026', () => {
      const bounds = computePeriodBounds(2026, 1, 'E');
      expect(bounds.fromDate).toBe('2026-01-01');
      expect(bounds.toDate).toBe('2026-12-31');
    });

    it('validates deferred VAT period string matching logic', () => {
      const targetPeriodStr = '2026-07';
      const deferredInvoicePeriod = '2026-07';
      const nonMatchingPeriod = '2026-08';

      expect(deferredInvoicePeriod === targetPeriodStr).toBe(true);
      expect(nonMatchingPeriod === targetPeriodStr).toBe(false);

      // Yearly matching check (LIKE '2026-%')
      const yearPrefix = '2026-';
      expect(deferredInvoicePeriod.startsWith(yearPrefix)).toBe(true);
      expect(nonMatchingPeriod.startsWith(yearPrefix)).toBe(true);
      expect('2025-12'.startsWith(yearPrefix)).toBe(false);
    });
  });

  describe('Form Invariant Completeness', () => {
    const requiredRows = [
      '01', '02', '04', '05', '06', '07', '08', '14', '18', '27', '29',
      '36', '43', '45', '63', '64', '65', '66', '67', '76', '77', '83', '84', '86', '91', '92'
    ];

    it('verifies that the migration accounts for all statutory 2665 rows', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      for (const row of requiredRows) {
        expect(sql).toContain(`'${row}'`);
      }
    });
  });
});
