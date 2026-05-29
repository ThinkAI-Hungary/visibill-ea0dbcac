import { describe, it, expect } from 'vitest';
import { calculatePremiums, trackOvertime, monthlyToHourly, DEFAULT_PREMIUM_RATES, type PremiumInput } from '../premiumCalculator';

describe('calculatePremiums', () => {
  const hourlyRate = 2000; // ~346k / 173h
  const emptyInput: PremiumInput = {
    hourlyRate,
    shiftHours: 0,
    nightHours: 0,
    sundayHours: 0,
    holidayHours: 0,
    overtimeWeekdayHours: 0,
    overtimeRestHours: 0,
    standbyOnSiteHours: 0,
    standbyHomeHours: 0,
    customPremiums: [],
  };

  it('should return zero for no premium hours', () => {
    const result = calculatePremiums(emptyInput);
    expect(result.items).toHaveLength(0);
    expect(result.totalAmount).toBe(0);
  });

  it('should calculate night premium at 30%', () => {
    const input = { ...emptyInput, nightHours: 20 };
    const result = calculatePremiums(input);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe('night');
    expect(result.items[0].amount).toBe(Math.round(hourlyRate * 0.30 * 20));
  });

  it('should calculate sunday premium at 50%', () => {
    const input = { ...emptyInput, sundayHours: 8 };
    const result = calculatePremiums(input);
    expect(result.items[0].type).toBe('sunday');
    expect(result.items[0].amount).toBe(Math.round(hourlyRate * 0.50 * 8));
  });

  it('should calculate holiday premium at 100%', () => {
    const input = { ...emptyInput, holidayHours: 8 };
    const result = calculatePremiums(input);
    expect(result.items[0].type).toBe('holiday');
    expect(result.items[0].amount).toBe(Math.round(hourlyRate * 1.00 * 8));
  });

  it('should calculate weekday overtime at 50%', () => {
    const input = { ...emptyInput, overtimeWeekdayHours: 10 };
    const result = calculatePremiums(input);
    expect(result.items[0].type).toBe('overtime_weekday');
    expect(result.items[0].amount).toBe(Math.round(hourlyRate * 0.50 * 10));
  });

  it('should calculate rest-day overtime at 100%', () => {
    const input = { ...emptyInput, overtimeRestHours: 8 };
    const result = calculatePremiums(input);
    expect(result.items[0].type).toBe('overtime_rest');
    expect(result.items[0].amount).toBe(Math.round(hourlyRate * 1.00 * 8));
  });

  it('should accumulate all premiums', () => {
    const input: PremiumInput = {
      ...emptyInput,
      nightHours: 10,
      sundayHours: 8,
      overtimeWeekdayHours: 5,
    };
    const result = calculatePremiums(input);
    expect(result.items).toHaveLength(3);
    const expectedTotal = 
      Math.round(hourlyRate * 0.30 * 10) +  // night
      Math.round(hourlyRate * 0.50 * 8) +    // sunday
      Math.round(hourlyRate * 0.50 * 5);     // overtime
    expect(result.totalAmount).toBe(expectedTotal);
  });

  it('should handle custom KSZ premiums', () => {
    const input: PremiumInput = {
      ...emptyInput,
      customPremiums: [{ name: 'Veszélyességi pótlék', hours: 160, ratePct: 15 }],
    };
    const result = calculatePremiums(input);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Veszélyességi pótlék');
    expect(result.items[0].amount).toBe(Math.round(hourlyRate * 0.15 * 160));
  });
});

describe('trackOvertime', () => {
  it('should return ok for low usage', () => {
    const result = trackOvertime(50, 250);
    expect(result.warningLevel).toBe('ok');
    expect(result.remainingHours).toBe(200);
  });

  it('should warn at 75%+', () => {
    const result = trackOvertime(200, 250);
    expect(result.warningLevel).toBe('warning');
  });

  it('should be critical at 90%+', () => {
    const result = trackOvertime(230, 250);
    expect(result.warningLevel).toBe('critical');
  });

  it('should be exceeded over 100%', () => {
    const result = trackOvertime(260, 250);
    expect(result.warningLevel).toBe('exceeded');
    expect(result.remainingHours).toBe(0);
  });

  it('should support KSZ 400h limit', () => {
    const result = trackOvertime(301, 400);
    expect(result.warningLevel).toBe('warning');
    expect(result.remainingHours).toBe(99);
  });
});

describe('monthlyToHourly', () => {
  it('should convert monthly to hourly for 40h/week', () => {
    const rate = monthlyToHourly(322800);
    expect(rate).toBeGreaterThan(1800);
    expect(rate).toBeLessThan(1900);
  });

  it('should handle part-time (20h/week)', () => {
    const rate = monthlyToHourly(161400, 20);
    expect(rate).toBeGreaterThan(1800);
  });
});
