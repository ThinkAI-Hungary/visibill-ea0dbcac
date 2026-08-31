/**
 * Payslip PDF generator (Facade).
 * Re-exports and delegates to the unified DocumentEngine under src/lib/documents/.
 */

export {
  type PayslipData as PayslipPdfData,
  generatePayslipPdf,
  downloadPayslipPdf,
  generatePayslipBlob,
  getPayslipPreviewUrl,
  buildPayslipDescriptor,
} from './documents/templates/payslipTemplate';
