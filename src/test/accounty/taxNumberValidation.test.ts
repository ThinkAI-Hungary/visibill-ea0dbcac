import { describe, it, expect } from 'vitest';
import { validateHungarianTaxNumber } from '../../pages/VatReturnPage';

describe('Hungarian Tax Number Validation', () => {
  it('should validate valid Hungarian tax numbers (e.g., EURODIFFERENT Kft)', () => {
    // 24676153-2-13 is valid
    const res = validateHungarianTaxNumber('24676153-2-13');
    expect(res.isValid).toBe(true);
    expect(res.isForeign).toBeFalsy();
    expect(res.vatCode).toBe('2');
    expect(res.status).toBe('active');
    expect(res.severity).toBe('success');
  });

  it('should validate valid Hungarian tax numbers (e.g., PADI Kft)', () => {
    // 14097324-2-03 is valid
    const res = validateHungarianTaxNumber('14097324-2-03');
    expect(res.isValid).toBe(true);
    expect(res.vatCode).toBe('2');
    expect(res.status).toBe('active');
  });

  it('should handle foreign or test tax numbers', () => {
    const resForeign = validateHungarianTaxNumber('FOREIGN:anthropicpbc');
    expect(resForeign.isValid).toBe(true);
    expect(resForeign.isForeign).toBe(true);
    expect(resForeign.status).toBe('active');

    const resTest = validateHungarianTaxNumber('TEST-123456');
    expect(resTest.isValid).toBe(true);
    expect(resTest.isForeign).toBe(true);
  });

  it('should catch invalid formats', () => {
    const resShort = validateHungarianTaxNumber('12345-2-13');
    expect(resShort.isValid).toBe(false);
    expect(resShort.severity).toBe('warning');

    const resNoHyphen = validateHungarianTaxNumber('12345678213');
    expect(resNoHyphen.isValid).toBe(false);
  });

  it('should catch invalid CDV digits', () => {
    // 14097324-2-03 is valid, so 14097325-2-03 must be invalid
    const res = validateHungarianTaxNumber('14097325-2-03');
    expect(res.isValid).toBe(false);
    expect(res.severity).toBe('error');
    expect(res.reason).toContain('CDV');
  });

  it('should correctly identify alanyi adómentes (code 1)', () => {
    // Let's create a valid tax number base (e.g. 24676153) but with code 1
    const res = validateHungarianTaxNumber('24676153-1-13');
    expect(res.isValid).toBe(true);
    expect(res.vatCode).toBe('1');
    expect(res.status).toBe('exempt');
    expect(res.severity).toBe('warning');
  });
});
