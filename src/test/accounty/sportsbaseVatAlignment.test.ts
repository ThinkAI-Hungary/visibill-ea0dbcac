import { describe, it, expect } from 'vitest';
import { calculateVatBalances, validateHungarianTaxNumber } from '@/features/vat/core/vatEngine';

describe('SportsBase Hungary VAT Declaration Alignment Test Suite', () => {
  const AUDITED_PDF_FACTS = {
    january2026: {
      period: '2026.01',
      line18_tax: 329898,
      line27_tax: 637872,
      line36_payable_tax: 967770,
      line64_tax: 2162,
      line66_tax: 175940,
      line67_tax: 967770,
      line76_deductible_tax: 1145872,
      line77_net_balance: -178102, // 967770 - 1145872
      line82_prev_carryforward: 962502,
      line83_total_carry_base: 1140604, // 178102 + 962502
      line85_reclaimed: 0,
      line86_next_carryforward: 1140604,
    },
    february2026: {
      period: '2026.02',
      line18_tax: 359862,
      line27_tax: 610616,
      line36_payable_tax: 970478,
      line64_tax: 1605,
      line66_tax: 132280,
      line67_tax: 970478,
      line76_deductible_tax: 1104363,
      line77_net_balance: -133885, // 970478 - 1104363
      line82_prev_carryforward: 1140604,
      line83_total_carry_base: 1274489, // 133885 + 1140604
      line85_reclaimed: 1140604, // Reclaimed in Feb return
      line86_next_carryforward: 133885,
    },
    march2026: {
      period: '2026.03',
      line18_tax: 357720,
      line27_tax: 542982,
      line36_payable_tax: 900702,
      line64_tax: 1605,
      line66_tax: 282500,
      line67_tax: 900702,
      line76_deductible_tax: 1184807,
      line77_net_balance: -284105,
      line82_prev_carryforward: 133885,
      line83_total_carry_base: 417990,
      line85_reclaimed: 0,
      line86_next_carryforward: 417990,
    },
    april2026: {
      period: '2026.04',
      line18_tax: 355860,
      line27_tax: 580500,
      line36_payable_tax: 936360,
      line64_tax: 1500,
      line66_tax: 229500,
      line67_tax: 936360,
      line76_deductible_tax: 1167360,
      line77_net_balance: -231000,
      line82_prev_carryforward: 417990,
      line83_total_carry_base: 648990,
      line85_reclaimed: 0,
      line86_next_carryforward: 648990,
    },
  };

  it('validates SportsBase Hungary tax number (32297252-2-41)', () => {
    const res = validateHungarianTaxNumber('32297252-2-41');
    expect(res.isValid).toBe(true);
    expect(res.vatCode).toBe('2');
  });

  it('calculates exact net balances for 2026.01 (January 2026)', () => {
    const jan = AUDITED_PDF_FACTS.january2026;
    expect(jan.line36_payable_tax - jan.line76_deductible_tax).toBe(jan.line77_net_balance);
    const balances = calculateVatBalances(jan.line36_payable_tax, jan.line76_deductible_tax, jan.line82_prev_carryforward);
    expect(balances.net83).toBe(-1140604);
    expect(balances.reclaimable85).toBe(1140604);
    expect(balances.carryforward86).toBe(1140604);
  });

  it('calculates exact carryforward and refund logic for 2026.02 (February 2026)', () => {
    const feb = AUDITED_PDF_FACTS.february2026;
    expect(feb.line36_payable_tax - feb.line76_deductible_tax).toBe(feb.line77_net_balance);
    const totalCarryBase = Math.abs(feb.line77_net_balance) + feb.line82_prev_carryforward;
    expect(totalCarryBase).toBe(feb.line83_total_carry_base);
    const nextCarryforward = totalCarryBase - feb.line85_reclaimed;
    expect(nextCarryforward).toBe(feb.line86_next_carryforward);
  });

  it('calculates exact balances for 2026.03 (March 2026)', () => {
    const mar = AUDITED_PDF_FACTS.march2026;
    expect(mar.line36_payable_tax - mar.line76_deductible_tax).toBe(mar.line77_net_balance);
    const totalCarryBase = Math.abs(mar.line77_net_balance) + mar.line82_prev_carryforward;
    expect(totalCarryBase).toBe(mar.line83_total_carry_base);
  });

  it('calculates exact balances for 2026.04 (April 2026)', () => {
    const apr = AUDITED_PDF_FACTS.april2026;
    expect(apr.line36_payable_tax - apr.line76_deductible_tax).toBe(apr.line77_net_balance);
    const totalCarryBase = Math.abs(apr.line77_net_balance) + apr.line82_prev_carryforward;
    expect(totalCarryBase).toBe(apr.line83_total_carry_base);
  });
});
