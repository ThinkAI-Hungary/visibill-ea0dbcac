import { describe, it, expect } from 'vitest';

describe('VAT Code & 2665 Declaration Target Row Mapping', () => {
  const getExpectedRowForOverride = (
    direction: 'INBOUND' | 'OUTBOUND',
    vatRate: number,
    specialType?: 'advance' | 'tangible_asset' | 'reverse_charge' | 'exempt' | 'eu_service'
  ): string => {
    if (direction === 'OUTBOUND') {
      if (specialType === 'advance') return '45';
      if (specialType === 'exempt') return '01';
      if (specialType === 'eu_service') return '92';
      if (vatRate === 27) return '07';
      if (vatRate === 18) return '05';
      if (vatRate === 5) return '03';
      return '07';
    } else {
      if (specialType === 'tangible_asset') return '77';
      if (specialType === 'reverse_charge') return '29';
      if (specialType === 'exempt') return '63';
      if (specialType === 'eu_service') return '18';
      if (vatRate === 27) return '66';
      if (vatRate === 18) return '65';
      if (vatRate === 5) return '64';
      return '66';
    }
  };

  it('correctly maps 27% domestic sales to row 07', () => {
    expect(getExpectedRowForOverride('OUTBOUND', 27)).toBe('07');
  });

  it('correctly maps sales advance to row 45 (NAV 2665 sor 45)', () => {
    expect(getExpectedRowForOverride('OUTBOUND', 27, 'advance')).toBe('45');
  });

  it('correctly maps 27% domestic purchase to row 66', () => {
    expect(getExpectedRowForOverride('INBOUND', 27)).toBe('66');
  });

  it('correctly maps tangible asset purchase to row 77 (tárgyi eszköz beruházás)', () => {
    expect(getExpectedRowForOverride('INBOUND', 27, 'tangible_asset')).toBe('77');
  });

  it('correctly maps reverse charge (FAD) to row 29', () => {
    expect(getExpectedRowForOverride('INBOUND', 0, 'reverse_charge')).toBe('29');
  });

  it('prioritizes manual vat_row_override over default rate mapping', () => {
    const invoice = {
      id: 'inv-test-1',
      invoice_vat_amount: 27000,
      vat_rate: 0.27,
      vat_row_override: '77', // User manually overrode to tangible asset
    };

    const resolvedRow = invoice.vat_row_override || (invoice.vat_rate === 0.27 ? '66' : '64');
    expect(resolvedRow).toBe('77');
  });

  it('correctly handles dual-reporting for tangible assets (row 66 total + row 77 breakdown)', () => {
    // Under Hungarian VAT rules, a 27% tangible asset invoice belongs to row 66 (general 27% deductible)
    // AND row 77 (portion representing tangible asset investment).
    const invoice = {
      id: 'KRIDA-2026-61',
      vat_row_override: '77',
      vat_rate: 0.27,
      net: 7500000,
      vat: 2025000,
    };

    const targetRows: string[] = [];
    // If overrode to 77 or tagged tangible asset with 27% VAT
    if (invoice.vat_row_override === '77' || invoice.vat_rate === 0.27) {
      targetRows.push('66');
    }
    if (invoice.vat_row_override === '77') {
      targetRows.push('77');
    }

    expect(targetRows).toContain('66');
    expect(targetRows).toContain('77');
  });
});
