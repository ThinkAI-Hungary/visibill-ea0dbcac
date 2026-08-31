/**
 * Unified Payroll & HR Query Keys
 */
export const payrollKeys = {
  all: (companyId?: string) => ['payroll', companyId] as const,
  salaries: (companyId: string, dateFrom?: string, dateTo?: string) =>
    ['salaries', companyId, dateFrom, dateTo] as const,
  employees: (companyId: string) =>
    ['payroll', 'employees', companyId] as const,
  employee: (empId: string) =>
    ['payroll', 'employee', empId] as const,
  employments: (empId: string) =>
    ['payroll', 'employments', empId] as const,
  allEmployments: (companyId?: string) =>
    ['payroll', 'all-employments', companyId] as const,
  employeeJobs: (companyId: string, employeeId: string) =>
    ['employee-jobs', companyId, employeeId] as const,
  cycles: (companyId: string) =>
    ['payroll', 'cycles', companyId] as const,
  cycle: (cycleId: string) =>
    ['payroll', 'cycle', cycleId] as const,
  items: (cycleId: string) =>
    ['payroll', 'items', cycleId] as const,
  calculations: (cycleId: string) =>
    ['payroll', 'calculations', cycleId] as const,
  declarations: (empIdOrCompanyId: string) =>
    ['payroll', 'declarations', empIdOrCompanyId] as const,
  filings: (companyId: string, filingType?: string) =>
    ['filings', companyId, filingType] as const,
  transfers: (companyId: string, period?: string) =>
    ['transfers', companyId, period] as const,
  leaves: (empId: string) =>
    ['payroll', 'leaves', empId] as const,
  leaveRequests: (companyId: string) =>
    ['leave-requests', companyId] as const,
  cafeteria: (empId: string, cycleId: string) =>
    ['payroll', 'cafeteria', empId, cycleId] as const,
  garnishments: (empId: string) =>
    ['payroll', 'garnishments', empId] as const,
  employeeGarnishments: (employeeId?: string) =>
    ['employee-garnishments', employeeId] as const,
  taxParameters: (year: number) =>
    ['payroll', 'taxParameters', year] as const,
  jobCodes: () =>
    ['payroll', 'jobCodes'] as const,
  timeEntries: (companyId: string, date?: string) =>
    ['timeEntries', companyId, date] as const,
  employeeRates: (companyId: string) =>
    ['employeeRates', companyId] as const,
  companySettings: (companyId: string) =>
    ['companySettings', companyId] as const,
  projectLaborCosts: (companyId: string) =>
    ['projectLaborCosts', companyId] as const,
};
