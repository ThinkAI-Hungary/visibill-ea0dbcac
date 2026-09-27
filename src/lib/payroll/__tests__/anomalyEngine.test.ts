import { describe, it, expect } from 'vitest';
import { runAnomalyRules, type AnomalyInput } from '../anomalyEngine';

describe('AnomalyEngine — Szabályalapú ellenőrzések', () => {
  const baseTaxParams = {
    minimumWage: 322800,
    guaranteedMinimum: 373200,
    szjaRate: 0.15,
    tbRate: 0.185,
    szochoRate: 0.13,
  };

  it('jelzi a hiányzó 08E bejelentést, ha a munkavállaló számfejtve van, de nincs beadva a 08E', () => {
    const input: AnomalyInput = {
      taxParams: baseTaxParams,
      employments: [
        {
          employmentId: 'emp-1',
          employeeId: 'e-1',
          employeeName: 'Kovács János',
          baseSalary: 450000,
          weeklyHours: 40,
          feorCode: '4112',
          jobTitle: 'Könyvelő',
          status: 'active',
          isInsured: true,
          startDate: '2026-01-01',
          endDate: null,
          filing08eStatus: 'draft', // Nincs beadva!
        },
      ],
      calculations: [
        {
          employmentId: 'emp-1',
          employeeName: 'Kovács János',
          grossSalary: 450000,
          szjaBase: 450000,
          szjaAmount: 67500,
          tbAmount: 83250,
          szochoAmount: 58500,
          netSalary: 299250,
          totalDeductions: 0,
          taxCredits: {},
          szochoCredits: {},
        },
      ],
    };

    const anomalies = runAnomalyRules(input);
    const missing08e = anomalies.find(a => a.ruleId === 'missing_08e_filing');

    expect(missing08e).toBeDefined();
    expect(missing08e?.severity).toBe('warning');
    expect(missing08e?.affectedEmployees).toContain('Kovács János');
  });

  it('nem jelez hibát a 08E bejelentésre, ha az már beadva vagy sent státuszú', () => {
    const input: AnomalyInput = {
      taxParams: baseTaxParams,
      employments: [
        {
          employmentId: 'emp-1',
          employeeId: 'e-1',
          employeeName: 'Kovács János',
          baseSalary: 450000,
          weeklyHours: 40,
          feorCode: '4112',
          jobTitle: 'Könyvelő',
          status: 'active',
          isInsured: true,
          startDate: '2026-01-01',
          endDate: null,
          filing08eStatus: 'beadva',
        },
      ],
      calculations: [
        {
          employmentId: 'emp-1',
          employeeName: 'Kovács János',
          grossSalary: 450000,
          szjaBase: 450000,
          szjaAmount: 67500,
          tbAmount: 83250,
          szochoAmount: 58500,
          netSalary: 299250,
          totalDeductions: 0,
          taxCredits: {},
          szochoCredits: {},
        },
      ],
    };

    const anomalies = runAnomalyRules(input);
    const missing08e = anomalies.find(a => a.ruleId === 'missing_08e_filing');

    expect(missing08e).toBeUndefined();
  });

  it('figyelmeztet, ha a munkaerőpiacra lépő SZOCHO-kedvezmény a 24. hónaphoz közeledik', () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 23); // 23 hónapja indult

    const input: AnomalyInput = {
      taxParams: baseTaxParams,
      employments: [
        {
          employmentId: 'emp-2',
          employeeId: 'e-2',
          employeeName: 'Nagy Anna',
          baseSalary: 400000,
          weeklyHours: 40,
          feorCode: '4112',
          jobTitle: 'Adminisztrátor',
          status: 'active',
          isInsured: true,
          startDate: d.toISOString().slice(0, 10),
          endDate: null,
          filing08eStatus: 'beadva',
          isSzochoDiscount: true,
          szochoDiscountType: 'market_entry',
          szochoDiscountStart: d.toISOString().slice(0, 10),
        },
      ],
      calculations: [],
    };

    const anomalies = runAnomalyRules(input);
    const exp24m = anomalies.find(a => a.ruleId === 'market_entry_24m_expiring');

    expect(exp24m).toBeDefined();
    expect(exp24m?.affectedEmployees).toContain('Nagy Anna');
  });

  it('észleli a minimálbér alatti alapbért teljes munkaidő esetén', () => {
    const input: AnomalyInput = {
      taxParams: baseTaxParams,
      employments: [
        {
          employmentId: 'emp-3',
          employeeId: 'e-3',
          employeeName: 'Szabó Péter',
          baseSalary: 250000, // < 322800
          weeklyHours: 40,
          feorCode: '9112',
          jobTitle: 'Takarító',
          status: 'active',
          isInsured: true,
          startDate: '2026-01-01',
          endDate: null,
        },
      ],
      calculations: [],
    };

    const anomalies = runAnomalyRules(input);
    const minWageAnomaly = anomalies.find(a => a.ruleId === 'minimum_wage');

    expect(minWageAnomaly).toBeDefined();
    expect(minWageAnomaly?.severity).toBe('critical');
  });
});
