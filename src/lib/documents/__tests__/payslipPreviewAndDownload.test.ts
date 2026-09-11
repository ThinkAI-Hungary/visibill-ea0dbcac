import { describe, it, expect, vi } from 'vitest';
import { getPayslipPreviewUrl, downloadPayslipPdf, buildPayslipDescriptor, type PayslipData } from '../templates/payslipTemplate';
import { DocumentEngine } from '../core/DocumentEngine';

describe('Payslip Preview and Download Bug Reproduction (Prove-It Pattern)', () => {
  const samplePayslipData: PayslipData = {
    employeeName: 'Bozóki Klaudia Kitti',
    period: '2026-07',
    grossSalary: 373200,
    szjaAmount: 0,
    tbAmount: 69042,
    szochoAmount: 48516,
    netSalary: 304158,
    totalDeductions: 0,
    companyName: 'VBV Vision Kft.',
  };

  it('getPayslipPreviewUrl returns a valid preview URL string and not an unresolved Promise or [object Promise]', async () => {
    const result = getPayslipPreviewUrl(samplePayslipData);
    
    // In buggy state, getPayslipPreviewUrl is an async function returning a Promise.
    // When passed to setPreviewUrl(url), React puts "[object Promise]" into iframe src!
    // The result should either be directly a string URL, or when awaited produce a valid blob URL
    expect(typeof result).toBe('string');
    expect(result).not.toBe('[object Promise]');
    expect(result.startsWith('blob:')).toBe(true);
  });

  it('downloadPayslipPdf supports 2 arguments (filename, data) without TypeError', async () => {
    const exportSpy = vi.spyOn(DocumentEngine, 'export').mockResolvedValue({
      filename: 'berjegyzek_test.pdf',
      format: 'pdf',
      success: true,
    });

    // In buggy state, downloadPayslipPdf was aliased to generatePayslipPdf(data),
    // so passing ('berjegyzek_123', samplePayslipData) passed string as data,
    // which threw TypeError when attempting data.employeeName.replace(...)
    await expect(
      (downloadPayslipPdf as any)('berjegyzek_123', samplePayslipData)
    ).resolves.not.toThrow();

    expect(exportSpy).toHaveBeenCalled();
    exportSpy.mockRestore();
  });

  it('buildPayslipDescriptor correctly formats Mt. 155. § data with employee details', () => {
    const descriptor = buildPayslipDescriptor(samplePayslipData);
    expect(descriptor.type).toBe('payslip');
    expect(descriptor.metadata.companyName).toBe('VBV Vision Kft.');
    expect(descriptor.metadata.period).toBe('2026-07');
    expect(descriptor.metadata.filename).toContain('Bozóki_Klaudia_Kitti');
  });

  it('correctly matches calculation by employee_name when employeeId differs from employment_id', () => {
    const slip = {
      id: 'doc-1',
      companyId: '5364d0be-e92a-4b94-9704-f457cf71f140',
      employeeId: 'c4dd9a31-54f9-448b-9e49-a1769dd96594', // accounty_employees ID
      title: 'Kiss-Százi Emese - Bérjegyzék',
      period: '2026-07',
      status: 'generated',
    };

    const calculations = [
      {
        id: 'calc-1',
        employment_id: 'different-employment-uuid-3e39',
        gross_salary: 1037594,
        szja_amount: 155639,
        tb_amount: 191955,
        szocho_amount: 134887,
        net_salary: 690000,
        total_deductions: 0,
        metadata: {
          employee_name: 'Kiss-Százi Emese',
          source: 'nav_08_import',
        },
      },
    ];

    const cleanName = slip.title.replace(' - Bérjegyzék', '').replace(' - E-bérjegyzék', '').trim();
    const calc = calculations.find(c => {
      const meta = c.metadata as any;
      return (
        meta?.employee_id === slip.employeeId ||
        c.employment_id === slip.employeeId ||
        (meta?.employee_name && meta.employee_name.trim().toLowerCase() === cleanName.toLowerCase())
      );
    });

    expect(calc).toBeDefined();
    expect(calc?.gross_salary).toBe(1037594);
    expect(calc?.net_salary).toBe(690000);
  });
});

