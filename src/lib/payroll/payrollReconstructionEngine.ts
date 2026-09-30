/**
 * Bérszámfejtési Rekonstrukciós Motor (Payroll Reconstruction Engine)
 * 
 * Felelőssége:
 * - 08-as XML adatokból (vagy havi bérösszesítőkből) előkészíti a bérszámfejtési
 *   ciklusokat, dolgozói rekordokat, jogviszonyokat és a kalkulációs eredményeket.
 * - Biztosítja az adatintegritást, duplicate check-et és az automatikus főkönyvi bérfeladási adatokat.
 */

import { Parsed08Document, Parsed08Employee } from './nav08XmlParser';
import type { PayrollEmployee, PayrollEmployment, PayrollCycle } from '@/hooks/usePayrollData';

export interface EmployeeMatchResult {
  parsed: Parsed08Employee;
  matchedEmployee?: PayrollEmployee;
  matchedEmployment?: PayrollEmployment;
  isNewEmployee: boolean;
  isNewEmployment: boolean;
}

export interface ReconstructionPlan {
  document: Parsed08Document;
  year: number;
  month: number;
  existingCycle?: PayrollCycle;
  cycleWillBeOverwritten: boolean;
  employeeMatches: EmployeeMatchResult[];
  
  // Összesítők
  newEmployeesCount: number;
  existingEmployeesCount: number;
  totalGross: number;
  totalSzja: number;
  totalTb: number;
  totalSzocho: number;
  totalNet: number;
  totalEmployerCost: number;
}

/**
 * Összeveti a parse-olt 08-as dokumentumot a meglévő adatbázis rekordokkal
 */
export function buildReconstructionPlan(
  doc: Parsed08Document,
  existingEmployees: PayrollEmployee[],
  existingEmployments: PayrollEmployment[],
  existingCycles: PayrollCycle[],
  options?: { isKiva?: boolean }
): ReconstructionPlan {
  const existingCycle = existingCycles.find(c => c.year === doc.year && c.month === doc.month);

  const employeeMatches: EmployeeMatchResult[] = doc.employees.map(parsed => {
    // Keresés TAJ vagy Adóazonosító alapján
    const matchedEmployee = existingEmployees.find(e => {
      const matchTaj = parsed.tajNumber && e.taj_number && e.taj_number.replace(/[\s-]/g, '') === parsed.tajNumber;
      const matchTax = parsed.taxId && e.tax_id && e.tax_id.replace(/[\s-]/g, '') === parsed.taxId;
      return matchTaj || matchTax;
    });

    let matchedEmployment: PayrollEmployment | undefined;
    if (matchedEmployee) {
      // Keresünk aktív jogviszonyt a dolgozóhoz (ugyanolyan job_code vagy egyetlen aktív jogviszony)
      matchedEmployment = existingEmployments.find(emp => 
        emp.employee_id === matchedEmployee.id && 
        (emp.status === 'active' || !emp.status) &&
        (emp.job_code === parsed.jobCode || !parsed.jobCode)
      ) || existingEmployments.find(emp =>
        emp.employee_id === matchedEmployee.id &&
        (emp.status === 'active' || !emp.status)
      );
    }

    return {
      parsed,
      matchedEmployee,
      matchedEmployment,
      isNewEmployee: !matchedEmployee,
      isNewEmployment: !matchedEmployment,
    };
  });

  const newEmployeesCount = employeeMatches.filter(m => m.isNewEmployee).length;
  const existingEmployeesCount = employeeMatches.filter(m => !m.isNewEmployee).length;

  const totalGross = doc.totalGrossSalary;
  const totalSzja = doc.totalSzja;
  const totalTb = doc.totalTb;
  const totalSzocho = options?.isKiva ? 0 : doc.totalSzocho;
  const totalNet = doc.totalNetSalary;
  const totalEmployerCost = totalGross + totalSzocho;

  return {
    document: doc,
    year: doc.year,
    month: doc.month,
    existingCycle,
    cycleWillBeOverwritten: !!existingCycle,
    employeeMatches,
    newEmployeesCount,
    existingEmployeesCount,
    totalGross,
    totalSzja,
    totalTb,
    totalSzocho,
    totalNet,
    totalEmployerCost,
  };
}

/**
 * Számfejtési kalkulációs rekord előkészítése
 */
export function preparePayrollCalculationRecord(
  cycleId: string,
  employmentId: string,
  parsed: Parsed08Employee,
  options?: { isKiva?: boolean }
) {
  const isEfo = Boolean(parsed.isEfo || parsed.employmentType === 'efo_alkalmi');
  return {
    cycle_id: cycleId,
    employment_id: employmentId,
    gross_salary: parsed.grossSalary,
    szja_base: isEfo ? 0 : parsed.taxBase,
    szja_amount: isEfo ? 0 : parsed.szjaAmount,
    tb_amount: isEfo ? 0 : parsed.tbAmount,
    szocho_amount: (options?.isKiva || isEfo) ? 0 : parsed.szochoAmount,
    net_salary: isEfo ? parsed.grossSalary : parsed.netSalary,
    tax_credits: {
      family_credit: parsed.familyCreditUsed || 0,
      under25_credit: parsed.under25CreditUsed || 0,
      personal_credit: parsed.personalCreditUsed || 0,
    },
    szocho_credits: {},
    deductions: {
      szja: isEfo ? 0 : parsed.szjaAmount,
      tb: isEfo ? 0 : parsed.tbAmount,
      total: isEfo ? 0 : parsed.totalDeductions,
    },
    cafeteria_tax: {},
    min_base_diff: isEfo ? 0 : undefined,
    min_base_employer_contribution: isEfo ? 0 : undefined,
    insured_days: isEfo ? 0 : undefined,
    metadata: {
      employee_name: `${parsed.lastName} ${parsed.firstName}`.trim(),
      taj_number: parsed.tajNumber,
      tax_id: parsed.taxId,
      job_code: parsed.jobCode,
      feor_code: parsed.feorCode,
      is_efo: isEfo,
      efo_days: parsed.efoDays,
      efo_wage: parsed.grossSalary,
      efo_tax: parsed.efoTax,
      efo_type: parsed.efoType,
      source: 'nav_08_import',
    },
  };
}
