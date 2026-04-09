import { describe, it, expect } from 'vitest';
import {
  calculateHourlyCost,
  calculateTotalSalaryCost,
  calculateProjectLaborCost,
  isValidEntryDate,
  formatHourlyRate,
} from './payrollUtils';

describe('calculateHourlyCost', () => {
  it('should calculate standard hourly cost', () => {
    // 650,000 HUF / 168 hours = 3,869.05 HUF/hour
    expect(calculateHourlyCost(650000, 168)).toBe(3869.05);
  });

  it('should use default 168 hours when not specified', () => {
    expect(calculateHourlyCost(650000)).toBe(3869.05);
  });

  it('should return 0 for zero salary', () => {
    expect(calculateHourlyCost(0, 168)).toBe(0);
  });

  it('should return 0 for zero hours (division safety)', () => {
    expect(calculateHourlyCost(650000, 0)).toBe(0);
  });

  it('should return 0 for negative hours', () => {
    expect(calculateHourlyCost(650000, -10)).toBe(0);
  });

  it('should handle small salary values', () => {
    expect(calculateHourlyCost(100, 168)).toBe(0.6);
  });

  it('should handle custom working hours (e.g. 176 for 22 work days)', () => {
    expect(calculateHourlyCost(650000, 176)).toBe(3693.18);
  });
});

describe('calculateTotalSalaryCost', () => {
  it('should sum bér + adó + járulék', () => {
    const items = [
      { tipus: 'bér', összeg: 300000 },
      { tipus: 'adó', összeg: 150000 },
      { tipus: 'járulék', összeg: 200000 },
    ];
    expect(calculateTotalSalaryCost(items)).toBe(650000);
  });

  it('should exclude bruttó_bér from calculation', () => {
    const items = [
      { tipus: 'bér', összeg: 300000 },
      { tipus: 'adó', összeg: 150000 },
      { tipus: 'járulék', összeg: 200000 },
      { tipus: 'bruttó_bér', összeg: 450000 }, // should be excluded
    ];
    expect(calculateTotalSalaryCost(items)).toBe(650000);
  });

  it('should return 0 for empty array', () => {
    expect(calculateTotalSalaryCost([])).toBe(0);
  });

  it('should handle null tipus gracefully', () => {
    const items = [
      { tipus: null, összeg: 100000 },
      { tipus: 'bér', összeg: 300000 },
    ];
    expect(calculateTotalSalaryCost(items)).toBe(300000);
  });
});

describe('calculateProjectLaborCost', () => {
  it('should multiply hours by rate', () => {
    expect(calculateProjectLaborCost(8, 3869.05)).toBe(30952.4);
  });

  it('should return 0 for zero hours', () => {
    expect(calculateProjectLaborCost(0, 3869.05)).toBe(0);
  });

  it('should return 0 for zero rate', () => {
    expect(calculateProjectLaborCost(8, 0)).toBe(0);
  });
});

describe('isValidEntryDate', () => {
  it('should accept today', () => {
    expect(isValidEntryDate(new Date())).toBe(true);
  });

  it('should accept past dates', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isValidEntryDate(yesterday)).toBe(true);
  });

  it('should reject future dates', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isValidEntryDate(tomorrow)).toBe(false);
  });
});

describe('formatHourlyRate', () => {
  it('should return dash for null', () => {
    expect(formatHourlyRate(null)).toBe('—');
  });

  it('should return dash for zero', () => {
    expect(formatHourlyRate(0)).toBe('—');
  });

  it('should format a valid rate in HUF', () => {
    const result = formatHourlyRate(3869);
    // Should contain "3" and "869" and "Ft"
    expect(result).toContain('869');
    expect(result).toContain('Ft');
  });
});
