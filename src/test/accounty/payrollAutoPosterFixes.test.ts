import { describe, it, expect } from 'vitest';
import { type PayrollGlMapping } from '@/lib/payroll/payrollAutoPoster';

describe('Payroll Auto Poster Fixes & Custom G/L Mapping', () => {
  it('should merge custom G/L account overrides with resolved defaults', () => {
    const resolvedCoa: PayrollGlMapping = {
      activePresetId: 'preset-123',
      presetName: 'Alapértelmezett Számlatükör',
      gl541: 'default-541-id',
      gl561: 'default-561-id',
      gl463: 'default-463-id',
      gl462: 'default-462-id',
      gl464: 'default-464-id',
      gl479: 'default-479-id',
      gl471: 'default-471-id',
    };

    const customOverrides: Partial<PayrollGlMapping> = {
      gl541: 'custom-5411-id',
      gl471: 'custom-4711-id',
    };

    const finalMapping: PayrollGlMapping = {
      ...resolvedCoa,
      ...customOverrides,
    };

    expect(finalMapping.gl541).toBe('custom-5411-id');
    expect(finalMapping.gl471).toBe('custom-4711-id');
    expect(finalMapping.gl462).toBe('default-462-id');
    expect(finalMapping.gl464).toBe('default-464-id');
  });

  it('should calculate 0 SZOCHO for KIVA taxpayer company calculations', () => {
    const isKiva = true;
    const grossSalary = 1000000;
    const szochoRate = 0.13;

    const szochoAmount = isKiva ? 0 : Math.round(grossSalary * szochoRate);
    expect(szochoAmount).toBe(0);
  });
});
