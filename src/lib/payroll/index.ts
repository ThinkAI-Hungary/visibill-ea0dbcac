/**
 * Accounty Bérszámfejtési Modul — Barrel export
 *
 * Minden payroll-specifikus üzleti logikát innen importálunk:
 * import { calculatePayroll, validateTajNumber, ... } from '@/lib/payroll';
 */

// Adómotor
export {
  calculatePayroll,
  calculateGross,
  calculateGarnishments,
  DEFAULT_2026_PARAMS,
  type TaxParameters,
  type EmployeeDeclarations,
  type GrossSalaryInput,
  type PayrollCalculationInput,
  type PayrollCalculationResult,
  type TaxCreditDetail,
  type Garnishment,
} from './taxEngine';

// Validátorok
export {
  validateTajNumber,
  formatTajNumber,
  validateTaxId,
  validateBankAccount,
  formatBankAccount,
  convertToIban,
  validateFeorCode,
  isSkilled,
  validateMinimumWage,
  formatAmount,
  validateCompanyTaxNumber,
  type MinWageValidation,
} from './validators';

// Szabadság kalkulátor
export {
  calculateLeaveBalance,
  calculateAgeSupplement,
  calculateChildSupplement,
  calculateDisabledChildSupplement,
  calculateSickLeave,
  calculateLeavePayout,
  type LeaveBalance,
  type EmployeeLeaveInput,
  type SickLeaveResult,
  type LeavePayoutResult,
} from './leaveCalculator';

// Bérpótlék kalkulátor
export {
  calculatePremiums,
  trackOvertime,
  monthlyToHourly,
  DEFAULT_PREMIUM_RATES,
  type PremiumRates,
  type PremiumInput,
  type PremiumResult,
  type PremiumItem,
  type OvertimeTrackerResult,
} from './premiumCalculator';

// NAV bevallás generátor
export {
  generateFiling08Xml,
  generateM30Xml,
  downloadXml,
  type Filing08Data,
  type Filing08EmployeeLine,
} from './filingGenerator';

// Bérjegyzék generátor
export {
  generatePayslipHtml,
  printPayslip,
  downloadPayslipHtml,
  type PayslipData,
} from './payslipGenerator';

// E-mail sablonok
export {
  generatePayrollRequestEmail,
  generatePayrollReminderEmail,
  type PayrollRequestEmailInput,
  type PayrollRequestEmailResult,
} from './emailTemplates';

// Cafeteria kalkulátor
export {
  calculateCafeteriaTax,
  formatCafeteriaSummary,
  DEFAULT_2026_SZEP_LIMITS,
  type SzepCardLimits,
  type CafeteriaAllocation,
  type CafeteriaTaxResult,
  type CafeteriaWarning,
  type YtdUsage,
} from './cafeteriaCalculator';
